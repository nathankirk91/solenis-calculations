import { getPrisma } from "~/lib/db.server";
import {
  parsePendingRunLoads,
  type PendingRunLoads,
} from "~/lib/pending-run-loads";

export type CalculationRunStatus = "PENDING" | "APPROVED" | "REJECTED";

export type CalculationHistoryItem = {
  id: string;
  status: CalculationRunStatus;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
  calculationTitle: string;
  calculationHref: string;
  operatorName: string | null;
  reviewedByName: string | null;
  reviewedByEmail: string | null;
  outputs: {
    extraDetaKg?: number;
    targetDetaKg?: number;
    detaChargedKg?: number;
    adipicAcidKg?: number;
    massRatioLabel?: string;
  };
  loads: PendingRunLoads;
};

export async function listCalculationHistory(
  limit = 50,
): Promise<CalculationHistoryItem[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  const rows = await prisma.calculationRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      calculation: { select: { title: true, href: true } },
      operator: { select: { name: true } },
      reviewedBy: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    reviewedAt: row.reviewedAt,
    reviewNote: row.reviewNote,
    calculationTitle: row.calculation.title,
    calculationHref: row.calculation.href,
    operatorName: row.operator?.name ?? null,
    reviewedByName: row.reviewedBy?.name ?? null,
    reviewedByEmail: row.reviewedBy?.email ?? null,
    outputs: (row.outputs ?? {}) as CalculationHistoryItem["outputs"],
    loads: parsePendingRunLoads(row.inputs),
  }));
}
