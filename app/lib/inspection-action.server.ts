import { parseWithZod } from "@conform-to/zod/v4";
import type { SubmissionResult } from "@conform-to/react";
import { data, redirect } from "react-router";

import { getAppBaseUrl } from "~/lib/app-url.server";
import { createInspectionSchema } from "~/lib/inspection.schema";
import {
  readShiftAnswer,
  type InspectionDefinition,
  type InspectionSummary,
} from "~/lib/inspections";
import {
  createInspectionActions,
  createInspectionRun,
  isFirstInspectionOfWeek,
} from "~/lib/inspections.server";
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
  const formData = await request.formData();

  const rawEquipmentRef = String(formData.get("equipmentRef") ?? "").trim();
  const equipmentRefForWeekCheck =
    definition.fixedEquipmentRef?.trim() || rawEquipmentRef || null;
  const responseMap: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    const match = /^responses\[(.+)\]$/.exec(key);
    if (match) {
      responseMap[match[1]] = String(value);
    }
  }
  const shift = readShiftAnswer(definition.questions, responseMap);
  const firstOfWeek = definition.questions.some((q) => q.firstOfWeekOnly)
    ? await isFirstInspectionOfWeek({
        inspectionId: definition.id,
        equipmentRef: equipmentRefForWeekCheck,
        shift,
      })
    : true;

  const schema = createInspectionSchema(definition, {
    isFirstInspectionOfWeek: firstOfWeek,
  });
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

  const { answers, summary, equipmentRef, notes, signature, actions } =
    submission.value;

  let runId: string | null = null;
  let createdActionCount = 0;
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
    if (runId && actions.length > 0) {
      createdActionCount = await createInspectionActions({
        createdOnRunId: runId,
        inspectionId: definition.id,
        equipmentRef,
        descriptions: actions,
        createdByOperatorId: operator.id,
        createdByUserId: user.id,
      });
    }
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

  const url = `${getAppBaseUrl(request)}/inspections/submissions/${runId}`;

  if (summary.status === "NEEDS_ATTENTION") {
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

  if (createdActionCount > 0) {
    const pushResult = await notifyManagersPush({
      title:
        createdActionCount === 1
          ? "New inspection action"
          : "New inspection actions",
      message: `${definition.shortName}: ${createdActionCount} open action${createdActionCount === 1 ? "" : "s"} (${operator.name})`,
      url,
      tag: `inspection-actions-${runId}`,
    });

    if (pushResult.sent === 0 && pushResult.reason) {
      console.warn("Web push skipped/failed:", pushResult.reason);
    }
  }

  throw redirect(`/inspections/submissions/${runId}`);
}
