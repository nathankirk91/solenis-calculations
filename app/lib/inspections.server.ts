import { getPrisma } from "~/lib/db.server";
import {
  buildInspectionResponseRows,
  getInspectionById,
  type InspectionItemResult,
  type InspectionSummary,
} from "~/lib/inspections";

export type InspectionRunStatus = "PASSED" | "NEEDS_ATTENTION";

export type InspectionHistoryItem = {
  id: string;
  status: InspectionRunStatus;
  createdAt: Date;
  inspectionTitle: string;
  inspectionHref: string;
  inspectionId: string;
  operatorName: string | null;
  equipmentRef: string | null;
  notes: string | null;
  summary: InspectionSummary;
  responses: Record<string, InspectionItemResult>;
  responseRows: ReturnType<typeof buildInspectionResponseRows>;
};

function parseSummary(value: unknown): InspectionSummary {
  const summary = (value ?? {}) as Partial<InspectionSummary>;
  return {
    okCount: Number(summary.okCount ?? 0),
    attentionCount: Number(summary.attentionCount ?? 0),
    naCount: Number(summary.naCount ?? 0),
    totalChecked: Number(summary.totalChecked ?? 0),
    status: summary.status === "NEEDS_ATTENTION" ? "NEEDS_ATTENTION" : "PASSED",
    attentionItems: Array.isArray(summary.attentionItems)
      ? summary.attentionItems.map((item) => ({
          itemId: String(item.itemId ?? ""),
          label: String(item.label ?? ""),
          sectionTitle: String(item.sectionTitle ?? ""),
        }))
      : [],
  };
}

function parseResponses(
  value: unknown,
): Record<string, InspectionItemResult> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const responses: Record<string, InspectionItemResult> = {};
  for (const [key, result] of Object.entries(value)) {
    if (result === "ok" || result === "attention" || result === "na") {
      responses[key] = result;
    }
  }
  return responses;
}

export async function createInspectionRun(args: {
  inspectionId: string;
  operatorId: string;
  submittedById: string;
  equipmentRef: string | null;
  notes: string | null;
  responses: Record<string, InspectionItemResult>;
  summary: InspectionSummary;
}): Promise<{ id: string } | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  return prisma.inspectionRun.create({
    data: {
      inspectionId: args.inspectionId,
      operatorId: args.operatorId,
      submittedById: args.submittedById,
      status: args.summary.status,
      equipmentRef: args.equipmentRef,
      notes: args.notes,
      responses: args.responses,
      summary: args.summary,
    },
    select: { id: true },
  });
}

export async function listInspectionHistory(
  limit = 50,
): Promise<InspectionHistoryItem[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  const rows = await prisma.inspectionRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      inspection: { select: { id: true, title: true, href: true } },
      operator: { select: { name: true } },
    },
  });

  return rows.map((row) => {
    const responses = parseResponses(row.responses);
    const definition = getInspectionById(row.inspection.id);
    return {
      id: row.id,
      status: row.status,
      createdAt: row.createdAt,
      inspectionTitle: row.inspection.title,
      inspectionHref: row.inspection.href,
      inspectionId: row.inspection.id,
      operatorName: row.operator?.name ?? null,
      equipmentRef: row.equipmentRef,
      notes: row.notes,
      summary: parseSummary(row.summary),
      responses,
      responseRows: definition
        ? buildInspectionResponseRows(definition, responses)
        : [],
    };
  });
}

export async function getInspectionRunById(
  id: string,
): Promise<InspectionHistoryItem | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  const row = await prisma.inspectionRun.findUnique({
    where: { id },
    include: {
      inspection: { select: { id: true, title: true, href: true } },
      operator: { select: { name: true } },
    },
  });

  if (!row) {
    return null;
  }

  const responses = parseResponses(row.responses);
  const definition = getInspectionById(row.inspection.id);

  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    inspectionTitle: row.inspection.title,
    inspectionHref: row.inspection.href,
    inspectionId: row.inspection.id,
    operatorName: row.operator?.name ?? null,
    equipmentRef: row.equipmentRef,
    notes: row.notes,
    summary: parseSummary(row.summary),
    responses,
    responseRows: definition
      ? buildInspectionResponseRows(definition, responses)
      : [],
  };
}
