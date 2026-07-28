import { parseWithZod } from "@conform-to/zod/v4";
import type { SubmissionResult } from "@conform-to/react";
import { data, redirect } from "react-router";

import { getAppBaseUrl } from "~/lib/app-url.server";
import { createInspectionSchema } from "~/lib/inspection.schema";
import type { InspectionDefinition, InspectionSummary } from "~/lib/inspections";
import { createInspectionRun } from "~/lib/inspections.server";
import { ensureInspectionSchema } from "~/lib/migrate.server";
import { getActiveOperatorById } from "~/lib/operators.server";
import { notifyManagersPush } from "~/lib/push.server";
import type { AuthUser } from "~/lib/user.server";

export type InspectionSubmitActionData = {
  summary: InspectionSummary | null;
  runId: string | null;
  status: InspectionSummary["status"] | null;
  lastResult: SubmissionResult<string[]> | null;
  formError?: string;
};

export async function handleInspectionSubmit(args: {
  request: Request;
  user: AuthUser;
  definition: InspectionDefinition;
}): Promise<InspectionSubmitActionData | ReturnType<typeof data>> {
  const { request, user, definition } = args;
  const schema = createInspectionSchema(definition);
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    return data(
      {
        summary: null,
        runId: null,
        status: null,
        lastResult: submission.reply(),
      } satisfies InspectionSubmitActionData,
      { status: submission.status === "error" ? 400 : 200 },
    );
  }

  const operator = await getActiveOperatorById(submission.value.operatorId);
  if (!operator) {
    return data(
      {
        summary: null,
        runId: null,
        status: null,
        lastResult: submission.reply({
          fieldErrors: {
            operatorId: ["Select a valid operator."],
          },
        }),
      } satisfies InspectionSubmitActionData,
      { status: 400 },
    );
  }

  const { answers, summary, equipmentRef, notes, signature } = submission.value;

  let runId: string | null = null;
  try {
    await ensureInspectionSchema();
    const run = await createInspectionRun({
      inspectionId: definition.id,
      operatorId: operator.id,
      submittedById: user.id,
      equipmentRef,
      notes,
      signature,
      answers,
      summary,
    });
    runId = run?.id ?? null;
  } catch {
    return data(
      {
        summary,
        runId: null,
        status: null,
        lastResult: submission.reply(),
        formError:
          "Inspection recorded locally, but could not save. Try again.",
      } satisfies InspectionSubmitActionData,
      { status: 500 },
    );
  }

  if (!runId) {
    return data(
      {
        summary,
        runId: null,
        status: null,
        lastResult: submission.reply(),
        formError:
          "Inspection recorded locally, but could not save. Try again.",
      } satisfies InspectionSubmitActionData,
      { status: 500 },
    );
  }

  if (summary.status === "NEEDS_ATTENTION") {
    const url = `${getAppBaseUrl(request)}/inspections/submissions/${runId}`;
    const pushResult = await notifyManagersPush({
      title: "Inspection needs attention",
      message: `${definition.shortName}: ${summary.attentionCount} item(s) (${operator.name})`,
      url,
      tag: `inspection-${runId}`,
    });

    if (pushResult.sent === 0 && pushResult.reason) {
      console.warn("Web push skipped/failed:", pushResult.reason);
    }
  }

  throw redirect(`/inspections/submissions/${runId}`);
}
