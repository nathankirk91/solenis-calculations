import { parseWithZod } from "@conform-to/zod/v4";
import type { SubmissionResult } from "@conform-to/react";
import { data, redirect } from "react-router";

import { getAppBaseUrl } from "~/lib/app-url.server";
import { getPrisma } from "~/lib/db.server";
import { createPermitIssueSchema } from "~/lib/permit.schema";
import type { InspectionDefinition, InspectionSummary } from "~/lib/inspections";
import { createPermitRun } from "~/lib/permits.server";
import { ensureInspectionSchema } from "~/lib/migrate.server";
import { notifyManagersPush } from "~/lib/push.server";
import {
  PERMIT_SLOT_CODES,
  userHasRoleForSlot,
  type PermitSlotCode,
} from "~/lib/roles.server";
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

  const {
    answers,
    summary,
    equipmentRef,
    authorizedPersonnel,
    authorization,
  } = submission.value;

  let resolvedAuthorization;
  try {
    resolvedAuthorization = await resolveAuthorizationSignOffs(authorization);
  } catch (error) {
    return data(
      {
        summary: null,
        runId: null,
        status: null,
        lastResult: submission.reply({
          formErrors: [
            error instanceof Error
              ? error.message
              : "One or more sign-offs are invalid.",
          ],
        }),
        formError:
          error instanceof Error
            ? error.message
            : "One or more sign-offs are invalid.",
      } satisfies PermitSubmitActionData,
      { status: 400 },
    );
  }

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
      authorization: resolvedAuthorization,
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
  if (summary.status === "NEEDS_ATTENTION") {
    const pushResult = await notifyManagersPush({
      title: "Permit needs attention",
      message: `${definition.shortName}: ${summary.attentionCount} item(s)`,
      url,
      tag: `permit-${runId}`,
    });
    if (pushResult.sent === 0 && pushResult.reason) {
      console.warn("Web push skipped/failed:", pushResult.reason);
    }
  }

  throw redirect(`/permits/runs/${runId}`);
}

async function resolveAuthorizationSignOffs(authorization: {
  operationsRep: { userId: string; signature: string };
  maintenanceRep: { userId: string; signature: string };
  safeWorkCoordinator: { userId: string; signature: string };
}) {
  const slots: Array<{
    key: keyof typeof authorization;
    code: PermitSlotCode;
  }> = [
    { key: "operationsRep", code: PERMIT_SLOT_CODES.operationsRep },
    { key: "maintenanceRep", code: PERMIT_SLOT_CODES.maintenanceRep },
    {
      key: "safeWorkCoordinator",
      code: PERMIT_SLOT_CODES.safeWorkCoordinator,
    },
  ];

  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const resolved = {} as {
    operationsRep: { userId: string; name: string; signature: string };
    maintenanceRep: { userId: string; name: string; signature: string };
    safeWorkCoordinator: { userId: string; name: string; signature: string };
  };

  for (const slot of slots) {
    const person = authorization[slot.key];
    const allowed = await userHasRoleForSlot({
      userId: person.userId,
      slotCode: slot.code,
    });
    if (!allowed) {
      throw new Error(
        `Selected user is not allowed to sign ${slot.code.replace(/_/g, " ")}.`,
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: person.userId },
      select: { id: true, name: true, email: true },
    });
    if (!dbUser) {
      throw new Error("Selected sign-off user was not found.");
    }

    resolved[slot.key] = {
      userId: dbUser.id,
      name: dbUser.name?.trim() || dbUser.email,
      signature: person.signature,
    };
  }

  return resolved;
}
