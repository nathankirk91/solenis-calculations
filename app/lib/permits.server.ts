import { Prisma } from "../../generated/prisma/client";
import { getPrisma } from "~/lib/db.server";
import {
  PERMIT_CATEGORY,
  buildAnswersFromResponses,
  buildPermitCatalog,
  isPermitInspection,
  parseStringArray,
  summarizeInspectionAnswers,
  type InspectionAnswerRecord,
  type InspectionCard,
  type InspectionDefinition,
  type InspectionSummary,
} from "~/lib/inspections";
import {
  createManagedInspection,
  getInspectionDefinition,
  listInspectionCards,
  listManagedInspections,
  type ManagedInspection,
  type ManagedInspectionDetail,
} from "~/lib/inspections.server";
import type {
  PermitAuthSlotKey,
  PermitAuthorization,
  PermitCloseout,
} from "~/lib/permit.schema";
import {
  distinctPermitSignerIds,
  emptyPermitAuthorization,
  isPermitAuthSlotSigned,
  isPermitFullyAuthorized,
  PERMIT_AUTH_SLOT_KEYS,
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
  status: PermitRunStatus;
  title: string;
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
  status: PermitRunStatus;
  inspectionId: string;
  inspectionTitle: string;
  inspectionHref: string;
  equipmentRef: string | null;
  inspectionVersion: number | null;
  answers: InspectionAnswerRecord[];
  summary: InspectionSummary;
  authorizedPersonnel: string[];
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
}): Promise<ManagedInspection> {
  const created = await createManagedInspection({
    title: args.title,
    description: args.description,
    category: PERMIT_CATEGORY,
    equipmentLabel: args.equipmentLabel,
  });

  const prisma = getPrisma();
  if (prisma) {
    await prisma.inspection.update({
      where: { id: created.id },
      data: {
        category: PERMIT_CATEGORY,
        href: `/permits/${created.slug}`,
      },
    });
  }

  return {
    ...created,
    category: PERMIT_CATEGORY,
    href: `/permits/${created.slug}`,
  };
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
  authorizedPersonnel: string[];
  authorization?: PermitAuthorization;
}): Promise<{ id: string } | null> {
  await ensureInspectionSchema();
  const prisma = getPrisma();
  if (!prisma) {
    return null;
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

  const row = await prisma.permitRun.create({
    data: {
      inspectionId: args.inspectionId,
      submittedById: args.submittedById,
      status: "PENDING_AUTHORIZATION",
      equipmentRef: args.equipmentRef,
      inspectionVersion: version,
      responses: args.answers as unknown as Prisma.InputJsonValue,
      summary: args.summary as unknown as Prisma.InputJsonValue,
      authorizedPersonnel: args.authorizedPersonnel,
      authorization: (args.authorization ??
        emptyPermitAuthorization()) as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  return row;
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
      const areaAnswer = answers.find((answer) =>
        answer.questionId.endsWith("__area"),
      );
      const summary = parseSummary(row.summary);
      return {
        id: row.id,
        status: row.status,
        title: row.inspection.title,
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
        inspection: { select: { id: true, title: true, href: true } },
        submittedBy: { select: { name: true, email: true } },
        closedBy: { select: { name: true, email: true } },
      },
    });
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      status: row.status,
      inspectionId: row.inspectionId,
      inspectionTitle: row.inspection.title,
      inspectionHref: row.inspection.href,
      equipmentRef: row.equipmentRef,
      inspectionVersion: row.inspectionVersion,
      answers: parseAnswers(row.responses),
      summary: parseSummary(row.summary),
      authorizedPersonnel: parseStringArray(row.authorizedPersonnel),
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
  fewerThanTwoSignersReason?: string;
}): Promise<PermitRunDetail> {
  await ensureInspectionSchema();
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const existing = await prisma.permitRun.findUnique({
    where: { id: args.permitRunId },
    select: { id: true, status: true, authorization: true },
  });
  if (!existing) {
    throw new Error("Permit not found.");
  }
  if (existing.status !== "PENDING_AUTHORIZATION") {
    throw new Error("This permit is not awaiting authorization.");
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

  if (isPermitFullyAuthorized(authorization)) {
    const distinct = distinctPermitSignerIds(authorization);
    if (distinct.length < 2) {
      const reason = args.fewerThanTwoSignersReason?.trim() ?? "";
      if (!reason) {
        throw new Error(
          "A minimum of two separate people must sign, unless no other employees are available — document the reason.",
        );
      }
      authorization.fewerThanTwoSignersReason = reason;
    } else {
      delete authorization.fewerThanTwoSignersReason;
    }
  }

  const nextStatus = isPermitFullyAuthorized(authorization)
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
