import { Prisma } from "../../generated/prisma/client";
import { melbournePermitYearMonth } from "~/lib/datetime";
import { getPrisma } from "~/lib/db.server";
import {
  PERMIT_CATEGORY,
  buildAnswersFromResponses,
  buildPermitCatalog,
  isPermitInspection,
  resolvePermitFieldRole,
  summarizeInspectionAnswers,
  type InspectionAnswerRecord,
  type InspectionCard,
  type InspectionDefinition,
  type InspectionSummary,
} from "~/lib/inspections";
import { workDescriptionFromAnswers } from "~/lib/permit-display";
import {
  createManagedInspection,
  getInspectionDefinition,
  getManagedInspection,
  listInspectionCards,
  listManagedInspections,
  type ManagedInspection,
  type ManagedInspectionDetail,
} from "~/lib/inspections.server";
import type {
  AuthorizedPerson,
  PermitAuthSlotKey,
  PermitAuthorization,
  PermitCloseout,
} from "~/lib/permit.schema";
import {
  emptyPermitAuthorization,
  formatPermitNumber,
  isPermitAuthSlotSigned,
  isPermitReadyToOpen,
  normalizeRequiredSignerCount,
  parseAuthorizedPersonnel,
  PERMIT_AUTH_SLOT_KEYS,
  userHasAlreadySignedPermit,
  DEFAULT_PERMIT_REQUIRED_SIGNERS,
} from "~/lib/permit.schema";
import { ensureInspectionSchema } from "~/lib/migrate.server";
import {
  PERMIT_SLOT_CODES,
  userHasRoleForSlot,
  type PermitSlotCode,
} from "~/lib/roles.server";

export type PermitRunStatus = "PENDING_AUTHORIZATION" | "OPEN" | "CLOSED";

export const PERMIT_AUTH_SLOT_TO_CODE: Record<PermitAuthSlotKey, PermitSlotCode> =
  {
    operationsRep: PERMIT_SLOT_CODES.operationsRep,
    maintenanceRep: PERMIT_SLOT_CODES.maintenanceRep,
    safeWorkCoordinator: PERMIT_SLOT_CODES.safeWorkCoordinator,
  };

export type PermitRunListItem = {
  id: string;
  permitNumber: string | null;
  status: PermitRunStatus;
  title: string;
  workDescription: string | null;
  inspectionId: string;
  equipmentRef: string | null;
  area: string | null;
  createdAt: Date;
  closedAt: Date | null;
  submittedByName: string | null;
  attentionCount: number;
};

export type PermitRunDetail = {
  id: string;
  permitNumber: string | null;
  status: PermitRunStatus;
  inspectionId: string;
  inspectionTitle: string;
  inspectionHref: string;
  requiredSignerCount: number;
  equipmentRef: string | null;
  inspectionVersion: number | null;
  answers: InspectionAnswerRecord[];
  summary: InspectionSummary;
  authorizedPersonnel: AuthorizedPerson[];
  authorization: PermitAuthorization;
  closeout: PermitCloseout | null;
  createdAt: Date;
  closedAt: Date | null;
  submittedByName: string | null;
  closedByName: string | null;
};

export async function listPermitCards(): Promise<{
  permits: InspectionCard[];
  source: "prisma" | "fallback";
}> {
  await repairStalePermitHrefs();
  const { inspections, source } = await listInspectionCards();
  return { permits: buildPermitCatalog(inspections), source };
}

/** Fix permit rows still pointing at /inspections/* after the permits split. */
async function repairStalePermitHrefs(): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    return;
  }
  try {
    await ensureInspectionSchema();
    const { INSPECTION_DEFINITIONS } = await import("~/lib/inspections");
    for (const definition of INSPECTION_DEFINITIONS) {
      if (!isPermitInspection(definition)) {
        continue;
      }
      await prisma.inspection.updateMany({
        where: {
          id: definition.id,
          OR: [
            { href: { not: definition.href } },
            { category: { not: PERMIT_CATEGORY } },
          ],
        },
        data: {
          href: definition.href,
          category: PERMIT_CATEGORY,
        },
      });
    }
  } catch {
    // Best-effort repair; catalog still overlays static hrefs.
  }
}

export async function listManagedPermits(): Promise<ManagedInspection[]> {
  const inspections = await listManagedInspections();
  return inspections.filter((inspection) => isPermitInspection(inspection));
}

export async function listManagedNonPermitInspections(): Promise<
  ManagedInspection[]
> {
  const inspections = await listManagedInspections();
  return inspections.filter((inspection) => !isPermitInspection(inspection));
}

export async function createManagedPermit(args: {
  title: string;
  description?: string;
  equipmentLabel?: string;
  requiredSignerCount?: number;
}): Promise<ManagedInspection> {
  const created = await createManagedInspection({
    title: args.title,
    description: args.description,
    category: PERMIT_CATEGORY,
    equipmentLabel: args.equipmentLabel,
    requiredSignerCount: args.requiredSignerCount ?? 2,
  });

  const prisma = getPrisma();
  if (prisma) {
    await prisma.inspection.update({
      where: { id: created.id },
      data: {
        category: PERMIT_CATEGORY,
        href: `/permits/${created.slug}`,
        requiredSignerCount: args.requiredSignerCount ?? 2,
      },
    });
  }

  return {
    ...created,
    category: PERMIT_CATEGORY,
    href: `/permits/${created.slug}`,
    requiredSignerCount: args.requiredSignerCount ?? 2,
  };
}

/**
 * Copy an existing permit form (title/description/questions) so managers can
 * start Hot Work / Line Break / etc. without rebuilding the checklist by hand.
 */
export async function duplicateManagedPermit(args: {
  sourceInspectionId: string;
  title?: string;
}): Promise<ManagedInspection> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const source = await getManagedInspection(args.sourceInspectionId);
  if (!source || !isPermitInspection(source)) {
    throw new Error("Permit form not found.");
  }

  const questions = source.inheritsQuestions
    ? (
        await getManagedInspection(
          source.questionSourceId ?? args.sourceInspectionId,
        )
      )?.questions
    : source.questions;
  if (!questions) {
    throw new Error("Could not load questions to copy.");
  }

  const title =
    args.title?.trim() ||
    (source.title.toLowerCase().includes("copy")
      ? source.title
      : `${source.title} (copy)`);

  const created = await createManagedPermit({
    title,
    description: source.description,
    equipmentLabel: source.equipmentLabel ?? undefined,
    requiredSignerCount: source.requiredSignerCount ?? 2,
  });

  for (const question of [...questions].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )) {
    const permitFieldRole =
      resolvePermitFieldRole(question) ?? question.permitFieldRole ?? null;
    await prisma.inspectionQuestion.create({
      data: {
        inspectionId: created.id,
        label: question.label,
        helpText: question.helpText ?? null,
        sectionTitle: question.sectionTitle ?? null,
        type: question.type,
        options:
          question.options.length > 0 ? question.options : Prisma.DbNull,
        attentionValues:
          question.type === "TEXT" ||
          question.type === "NUMBER" ||
          question.type === "DATE" ||
          question.type === "TIME"
            ? Prisma.DbNull
            : question.attentionValues,
        required: question.required,
        showLastValue: question.showLastValue,
        applicableEquipmentRefs:
          question.applicableEquipmentRefs.length > 0
            ? question.applicableEquipmentRefs
            : Prisma.DbNull,
        applicableShifts:
          question.applicableShifts.length > 0
            ? question.applicableShifts
            : Prisma.DbNull,
        firstOfWeekOnly: question.firstOfWeekOnly,
        permitFieldRole,
        isActive: true,
        sortOrder: question.sortOrder,
      },
    });
  }

  const duplicated = await listManagedPermits();
  const found = duplicated.find((permit) => permit.id === created.id);
  if (!found) {
    throw new Error("Duplicated permit form could not be loaded.");
  }
  return found;
}

export async function getPermitDefinition(
  idOrSlug: string,
): Promise<InspectionDefinition | null> {
  const definition = await getInspectionDefinition(idOrSlug);
  if (!definition || !isPermitInspection(definition)) {
    return null;
  }
  return definition;
}

export async function createPermitRun(args: {
  inspectionId: string;
  submittedById: string | null;
  equipmentRef: string | null;
  answers: InspectionAnswerRecord[];
  summary: InspectionSummary;
  authorizedPersonnel: AuthorizedPerson[];
  authorization?: PermitAuthorization;
}): Promise<{ id: string; permitNumber: string }> {
  await ensureInspectionSchema();
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id: args.inspectionId },
    select: {
      id: true,
      version: true,
      category: true,
      templateInspectionId: true,
      template: { select: { version: true } },
    },
  });
  if (!inspection || !isPermitInspection(inspection)) {
    throw new Error("Permit form not found.");
  }

  const version =
    inspection.templateInspectionId != null
      ? (inspection.template?.version ?? inspection.version)
      : inspection.version;

  const permitNumber = await allocateNextPermitNumber();

  const row = await prisma.permitRun.create({
    data: {
      permitNumber,
      inspectionId: args.inspectionId,
      submittedById: args.submittedById,
      status: "PENDING_AUTHORIZATION",
      equipmentRef: args.equipmentRef,
      inspectionVersion: version,
      responses: args.answers as unknown as Prisma.InputJsonValue,
      summary: args.summary as unknown as Prisma.InputJsonValue,
      authorizedPersonnel:
        args.authorizedPersonnel as unknown as Prisma.InputJsonValue,
      authorization: (args.authorization ??
        emptyPermitAuthorization()) as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, permitNumber: true },
  });

  return {
    id: row.id,
    permitNumber: row.permitNumber ?? permitNumber,
  };
}

/** Shared YYMMXXX sequence for all permit types (Safe Work, Hot Work, Line Break). */
export async function allocateNextPermitNumber(
  date: Date = new Date(),
): Promise<string> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const yearMonth = melbournePermitYearMonth(date);
  const rows = await prisma.$queryRaw<Array<{ last_value: number }>>`
    INSERT INTO "permit_number_sequences" ("year_month", "last_value", "updated_at")
    VALUES (${yearMonth}, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("year_month") DO UPDATE
      SET "last_value" = "permit_number_sequences"."last_value" + 1,
          "updated_at" = CURRENT_TIMESTAMP
    RETURNING "last_value"
  `;
  const sequence = rows[0]?.last_value;
  if (!sequence || sequence < 1) {
    throw new Error("Could not allocate a permit number.");
  }
  return formatPermitNumber(yearMonth, sequence);
}

export async function listOpenPermitRuns(args?: {
  limit?: number;
}): Promise<PermitRunListItem[]> {
  return listPermitRuns({ status: "OPEN", limit: args?.limit ?? 50 });
}

export async function listPendingAuthorizationPermitRuns(args?: {
  limit?: number;
}): Promise<PermitRunListItem[]> {
  return listPermitRuns({
    status: "PENDING_AUTHORIZATION",
    limit: args?.limit ?? 50,
  });
}

export async function listPermitRuns(args?: {
  status?: PermitRunStatus | "ALL";
  limit?: number;
}): Promise<PermitRunListItem[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  try {
    await ensureInspectionSchema();
    const status = args?.status ?? "ALL";
    const rows = await prisma.permitRun.findMany({
      where: status === "ALL" ? undefined : { status },
      orderBy: { createdAt: "desc" },
      take: args?.limit ?? 100,
      select: {
        id: true,
        permitNumber: true,
        status: true,
        equipmentRef: true,
        createdAt: true,
        closedAt: true,
        responses: true,
        summary: true,
        inspection: { select: { id: true, title: true } },
        submittedBy: { select: { name: true, email: true } },
      },
    });

    return rows.map((row) => {
      const answers = parseAnswers(row.responses);
      const areaAnswer = answers.find(
        (answer) => answer.permitFieldRole === "area",
      );
      const summary = parseSummary(row.summary);
      return {
        id: row.id,
        permitNumber: row.permitNumber,
        status: row.status,
        title: row.inspection.title,
        workDescription: workDescriptionFromAnswers(answers),
        inspectionId: row.inspection.id,
        equipmentRef: row.equipmentRef,
        area: areaAnswer?.answer?.trim() || null,
        createdAt: row.createdAt,
        closedAt: row.closedAt,
        submittedByName: row.submittedBy?.name ?? row.submittedBy?.email ?? null,
        attentionCount: summary.attentionCount,
      };
    });
  } catch {
    return [];
  }
}

export async function getPermitRunById(
  id: string,
): Promise<PermitRunDetail | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  try {
    await ensureInspectionSchema();
    const row = await prisma.permitRun.findUnique({
      where: { id },
      select: {
        id: true,
        permitNumber: true,
        status: true,
        inspectionId: true,
        equipmentRef: true,
        inspectionVersion: true,
        responses: true,
        summary: true,
        authorizedPersonnel: true,
        authorization: true,
        closeout: true,
        createdAt: true,
        closedAt: true,
        inspection: {
          select: {
            id: true,
            title: true,
            href: true,
            requiredSignerCount: true,
          },
        },
        submittedBy: { select: { name: true, email: true } },
        closedBy: { select: { name: true, email: true } },
      },
    });
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      permitNumber: row.permitNumber,
      status: row.status,
      inspectionId: row.inspectionId,
      inspectionTitle: row.inspection.title,
      inspectionHref: row.inspection.href,
      requiredSignerCount: normalizeRequiredSignerCount(
        row.inspection.requiredSignerCount ?? DEFAULT_PERMIT_REQUIRED_SIGNERS,
      ),
      equipmentRef: row.equipmentRef,
      inspectionVersion: row.inspectionVersion,
      answers: parseAnswers(row.responses),
      summary: parseSummary(row.summary),
      authorizedPersonnel: parseAuthorizedPersonnel(row.authorizedPersonnel),
      authorization: parseAuthorization(row.authorization),
      closeout: parseCloseout(row.closeout),
      createdAt: row.createdAt,
      closedAt: row.closedAt,
      submittedByName: row.submittedBy?.name ?? row.submittedBy?.email ?? null,
      closedByName: row.closedBy?.name ?? row.closedBy?.email ?? null,
    };
  } catch {
    return null;
  }
}

export async function listUnsignedSlotsForUser(args: {
  userId: string;
  authorization: PermitAuthorization;
}): Promise<PermitAuthSlotKey[]> {
  // One person may sign only one role on a given permit.
  if (userHasAlreadySignedPermit(args.authorization, args.userId)) {
    return [];
  }

  const unsigned: PermitAuthSlotKey[] = [];
  for (const key of PERMIT_AUTH_SLOT_KEYS) {
    if (isPermitAuthSlotSigned(args.authorization[key])) {
      continue;
    }
    const allowed = await userHasRoleForSlot({
      userId: args.userId,
      slotCode: PERMIT_AUTH_SLOT_TO_CODE[key],
    });
    if (allowed) {
      unsigned.push(key);
    }
  }
  return unsigned;
}

export async function signOffPermitSlot(args: {
  permitRunId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  slotKey: PermitAuthSlotKey;
  signature: string;
  siteVerified: boolean;
}): Promise<PermitRunDetail> {
  await ensureInspectionSchema();
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const existing = await prisma.permitRun.findUnique({
    where: { id: args.permitRunId },
    select: {
      id: true,
      status: true,
      authorization: true,
      inspection: { select: { requiredSignerCount: true } },
    },
  });
  if (!existing) {
    throw new Error("Permit not found.");
  }
  if (existing.status === "CLOSED") {
    throw new Error("This permit is closed.");
  }
  if (
    existing.status !== "PENDING_AUTHORIZATION" &&
    existing.status !== "OPEN"
  ) {
    throw new Error("This permit cannot accept sign-off.");
  }

  if (!args.siteVerified) {
    throw new Error(
      "Approvers must visually inspect the job site before signing.",
    );
  }

  const authorization = parseAuthorization(existing.authorization);
  if (isPermitAuthSlotSigned(authorization[args.slotKey])) {
    throw new Error("This sign-off has already been completed.");
  }

  if (userHasAlreadySignedPermit(authorization, args.userId)) {
    throw new Error(
      "You have already signed this permit and cannot sign another role.",
    );
  }

  const allowed = await userHasRoleForSlot({
    userId: args.userId,
    slotCode: PERMIT_AUTH_SLOT_TO_CODE[args.slotKey],
  });
  if (!allowed) {
    throw new Error("You are not allowed to sign this role.");
  }

  const signature = args.signature.trim();
  if (!signature) {
    throw new Error("Signature / initials are required.");
  }

  authorization[args.slotKey] = {
    userId: args.userId,
    name: args.userName?.trim() || args.userEmail,
    signature,
    siteVerifiedAt: new Date().toISOString(),
  };

  const requiredSignerCount = normalizeRequiredSignerCount(
    existing.inspection.requiredSignerCount ?? DEFAULT_PERMIT_REQUIRED_SIGNERS,
  );

  // Opens when enough distinct people have signed; remaining slots can still be added later.
  const nextStatus =
    existing.status === "OPEN" ||
    isPermitReadyToOpen(authorization, requiredSignerCount)
      ? "OPEN"
      : "PENDING_AUTHORIZATION";

  await prisma.permitRun.update({
    where: { id: args.permitRunId },
    data: {
      authorization: authorization as unknown as Prisma.InputJsonValue,
      status: nextStatus,
    },
  });

  const detail = await getPermitRunById(args.permitRunId);
  if (!detail) {
    throw new Error("Permit not found after sign-off.");
  }
  return detail;
}

export async function closePermitRun(args: {
  permitRunId: string;
  closedById: string;
  closeout: PermitCloseout;
}): Promise<PermitRunDetail> {
  await ensureInspectionSchema();
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const existing = await prisma.permitRun.findUnique({
    where: { id: args.permitRunId },
    select: { id: true, status: true },
  });
  if (!existing) {
    throw new Error("Permit not found.");
  }
  if (existing.status === "CLOSED") {
    throw new Error("This permit is already closed.");
  }
  if (existing.status !== "OPEN") {
    throw new Error("Permit must be fully authorized before close-out.");
  }

  await prisma.permitRun.update({
    where: { id: args.permitRunId },
    data: {
      status: "CLOSED",
      closeout: args.closeout as unknown as Prisma.InputJsonValue,
      closedAt: new Date(),
      closedById: args.closedById,
    },
  });

  const detail = await getPermitRunById(args.permitRunId);
  if (!detail) {
    throw new Error("Permit not found after close-out.");
  }
  return detail;
}

function parseSummary(value: unknown): InspectionSummary {
  const summary = (value ?? {}) as Partial<InspectionSummary>;
  const attentionItems = Array.isArray(summary.attentionItems)
    ? summary.attentionItems.map((item) => ({
        itemId: String(item.itemId ?? ""),
        label: String(item.label ?? ""),
        sectionTitle: String(item.sectionTitle ?? ""),
        answer: item.answer ? String(item.answer) : undefined,
      }))
    : [];
  return {
    answeredCount: Number(summary.answeredCount ?? 0),
    attentionCount: Number(summary.attentionCount ?? attentionItems.length),
    status: summary.status === "NEEDS_ATTENTION" ? "NEEDS_ATTENTION" : "PASSED",
    attentionItems,
  };
}

function parseAnswers(value: unknown): InspectionAnswerRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    const row = item as Partial<InspectionAnswerRecord>;
    return {
      questionId: String(row.questionId ?? ""),
      label: String(row.label ?? ""),
      sectionTitle: row.sectionTitle ? String(row.sectionTitle) : null,
      type:
        row.type === "YES_NO" ||
        row.type === "TEXT" ||
        row.type === "RADIO" ||
        row.type === "NUMBER" ||
        row.type === "DATE" ||
        row.type === "TIME" ||
        row.type === "CHECKBOX"
          ? row.type
          : "TEXT",
      answer: String(row.answer ?? ""),
      flagged: Boolean(row.flagged),
      permitFieldRole: resolvePermitFieldRole({
        id: String(row.questionId ?? ""),
        label: String(row.label ?? ""),
        permitFieldRole: row.permitFieldRole,
      }),
    };
  });
}

function parseAuthorization(value: unknown): PermitAuthorization {
  const raw = (value ?? {}) as Partial<PermitAuthorization> & {
    fewerThanTwoSignersReason?: string;
  };
  const person = (entry: unknown) => {
    const row = (entry ?? {}) as {
      userId?: string;
      name?: string;
      signature?: string;
      siteVerifiedAt?: string;
    };
    return {
      userId: String(row.userId ?? ""),
      name: String(row.name ?? ""),
      signature: String(row.signature ?? ""),
      ...(row.siteVerifiedAt
        ? { siteVerifiedAt: String(row.siteVerifiedAt) }
        : {}),
    };
  };
  const authorization: PermitAuthorization = {
    operationsRep: person(raw.operationsRep),
    maintenanceRep: person(raw.maintenanceRep),
    safeWorkCoordinator: person(raw.safeWorkCoordinator),
  };
  const reason = String(raw.fewerThanTwoSignersReason ?? "").trim();
  if (reason) {
    authorization.fewerThanTwoSignersReason = reason;
  }
  return authorization;
}

function parseCloseout(value: unknown): PermitCloseout | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as Partial<PermitCloseout>;
  const date = String(row.date ?? "").trim();
  const time = String(row.time ?? "").trim();
  const operatorsInitials = String(row.operatorsInitials ?? "").trim();
  const maintenanceInitials = String(row.maintenanceInitials ?? "").trim();
  if (!date && !time && !operatorsInitials && !maintenanceInitials) {
    return null;
  }
  return { date, time, operatorsInitials, maintenanceInitials };
}

export type { ManagedInspectionDetail };

/** Re-export helpers used by tests / callers. */
export { buildAnswersFromResponses, summarizeInspectionAnswers };
