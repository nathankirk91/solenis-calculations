import { parseWithZod } from "@conform-to/zod/v4";
import type { SubmissionResult } from "@conform-to/react";
import { data } from "react-router";

import { createPendingCalculationRun } from "~/lib/approvals.server";
import { getActiveOperatorById } from "~/lib/operators.server";
import {
  calculatePolymerAdipicDetaExtra,
  type PolymerAdipicDetaProduct,
  type PolymerAdipicDetaResult,
} from "~/lib/polymer-adipic-deta";
import { createPolymerAdipicDetaSchema } from "~/lib/polymer-adipic-deta.schema";
import {
  getAppBaseUrl,
  notifyTeamsPendingApproval,
} from "~/lib/teams.server";
import type { AuthUser } from "~/lib/user.server";

export type PolymerSubmitActionData = {
  result: PolymerAdipicDetaResult | null;
  runId: string | null;
  status: "PENDING" | null;
  lastResult: SubmissionResult<string[]> | null;
  formError?: string;
};

export async function handlePolymerAdipicDetaSubmit(args: {
  request: Request;
  user: AuthUser;
  product: PolymerAdipicDetaProduct;
}): Promise<PolymerSubmitActionData | ReturnType<typeof data>> {
  const { request, user, product } = args;
  const schema = createPolymerAdipicDetaSchema(product);
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    return data(
      {
        result: null,
        runId: null,
        status: null,
        lastResult: submission.reply(),
      } satisfies PolymerSubmitActionData,
      { status: submission.status === "error" ? 400 : 200 },
    );
  }

  const operator = await getActiveOperatorById(submission.value.operatorId);
  if (!operator) {
    return data(
      {
        result: null,
        runId: null,
        status: null,
        lastResult: submission.reply({
          fieldErrors: {
            operatorId: ["Select a valid operator."],
          },
        }),
      } satisfies PolymerSubmitActionData,
      { status: 400 },
    );
  }

  const outputs = calculatePolymerAdipicDetaExtra(product, {
    detaChargedKg: submission.value.detaChargedKg,
    adipicAcidKg: submission.value.adipicAcidKg,
  });

  let runId: string | null = null;
  try {
    const run = await createPendingCalculationRun({
      calculationId: product.id,
      operatorId: operator.id,
      submittedById: user.id,
      inputs: submission.value,
      outputs,
    });
    runId = run?.id ?? null;
  } catch {
    return data(
      {
        result: outputs,
        runId: null,
        status: null,
        lastResult: submission.reply(),
        formError:
          "Calculated successfully, but could not save for approval. Try again.",
      } satisfies PolymerSubmitActionData,
      { status: 500 },
    );
  }

  if (runId) {
    const approvalsUrl = `${getAppBaseUrl(request)}/approvals`;
    // Must await on Vercel serverless — fire-and-forget is frozen before fetch completes.
    // notifyTeamsPendingApproval never throws, so submit still succeeds on Teams failures.
    const teamsResult = await notifyTeamsPendingApproval({
      calculationTitle: product.title,
      operatorName: operator.name,
      extraDetaKg: outputs.extraDetaKg,
      targetDetaKg: outputs.targetDetaKg,
      detaChargedKg: outputs.detaChargedKg,
      adipicAcidKg: outputs.adipicAcidKg,
      detaLoads: submission.value.detaLoads,
      adipicBags: submission.value.adipicBags,
      approvalsUrl,
      submittedAt: new Date(),
    });
    if (!teamsResult.sent) {
      console.warn("Teams notification skipped/failed:", teamsResult.reason);
    }
  }

  return {
    result: outputs,
    runId,
    status: runId ? ("PENDING" as const) : null,
    lastResult: submission.reply(),
  } satisfies PolymerSubmitActionData;
}
