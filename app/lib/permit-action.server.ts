import { parseWithZod } from "@conform-to/zod/v4";
import type { SubmissionResult } from "@conform-to/react";
import { data, redirect } from "react-router";

import { getAppBaseUrl } from "~/lib/app-url.server";
import { createPermitIssueSchema } from "~/lib/permit.schema";
import type { InspectionDefinition, InspectionSummary } from "~/lib/inspections";
import { createPermitRun } from "~/lib/permits.server";
import { ensureInspectionSchema } from "~/lib/migrate.server";
import { notifyManagersPush, notifyUsersPush } from "~/lib/push.server";
import { listUsersEligibleForAnyPermitSignOff } from "~/lib/roles.server";
import type { AuthUser } from "~/lib/user.server";

export type PermitSubmitActionData = {
  summary: InspectionSummary | null;
  runId: string | null;
  status: InspectionSummary["status"] | null;
  lastResult: SubmissionResult<string[]> | null;
  formError?: string;
};

export async function handlePermitIssueSubmit(args: {
  request: Request;
  user: AuthUser;
  definition: InspectionDefinition;
}): Promise<PermitSubmitActionData | ReturnType<typeof data>> {
  const { request, user, definition } = args;
  const formData = await request.formData();
  const schema = createPermitIssueSchema(definition);
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    return data(
      {
        summary: null,
        runId: null,
        status: null,
        lastResult: submission.reply(),
      } satisfies PermitSubmitActionData,
      { status: submission.status === "error" ? 400 : 200 },
    );
  }

  const { answers, summary, equipmentRef, authorizedPersonnel } =
    submission.value;

  let runId: string | null = null;
  try {
    await ensureInspectionSchema();
    const run = await createPermitRun({
      inspectionId: definition.id,
      submittedById: user.id,
      equipmentRef,
      answers,
      summary,
      authorizedPersonnel,
    });
    runId = run?.id ?? null;
  } catch {
    return data(
      {
        summary,
        runId: null,
        status: null,
        lastResult: submission.reply(),
        formError: "Permit could not be saved. Try again.",
      } satisfies PermitSubmitActionData,
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
        formError: "Permit could not be saved. Try again.",
      } satisfies PermitSubmitActionData,
      { status: 500 },
    );
  }

  const url = `${getAppBaseUrl(request)}/permits/runs/${runId}`;
  const signers = await listUsersEligibleForAnyPermitSignOff();
  const pushResult = await notifyUsersPush(
    signers.map((signer) => signer.id),
    {
      title: "Permit pending authorization",
      message: `${definition.shortName} needs your sign-off`,
      url,
      tag: `permit-auth-${runId}`,
    },
  );
  if (pushResult.sent === 0 && pushResult.reason) {
    console.warn("Permit auth push skipped/failed:", pushResult.reason);
  }

  if (summary.status === "NEEDS_ATTENTION") {
    const managerPush = await notifyManagersPush({
      title: "Permit needs attention",
      message: `${definition.shortName}: ${summary.attentionCount} item(s)`,
      url,
      tag: `permit-${runId}`,
    });
    if (managerPush.sent === 0 && managerPush.reason) {
      console.warn("Web push skipped/failed:", managerPush.reason);
    }
  }

  throw redirect(`/permits/runs/${runId}`);
}
