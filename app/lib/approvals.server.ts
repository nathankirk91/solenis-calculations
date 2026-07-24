import { getPrisma } from "~/lib/db.server";
import {
  parsePendingRunLoads,
  type PendingRunLoads,
} from "~/lib/pending-run-loads";

export type { PendingRunLoads };
export { parsePendingRunLoads };

export type PendingRunSummary = {
  id: string;
  createdAt: Date;
  calculationTitle: string;
  calculationHref: string;
  operatorName: string | null;
  submittedByEmail: string | null;
  outputs: {
    extraDetaKg?: number;
    targetDetaKg?: number;
    detaChargedKg?: number;
    adipicAcidKg?: number;
    massRatioLabel?: string;
  };
  loads: PendingRunLoads;
};

export async function countPendingRuns(): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) {
    return 0;
  }

  return prisma.calculationRun.count({
    where: { status: "PENDING" },
  });
}

export async function listPendingRuns(): Promise<PendingRunSummary[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  const rows = await prisma.calculationRun.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      calculation: { select: { title: true, href: true } },
      operator: { select: { name: true } },
      submittedBy: { select: { email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    calculationTitle: row.calculation.title,
    calculationHref: row.calculation.href,
    operatorName: row.operator?.name ?? null,
    submittedByEmail: row.submittedBy?.email ?? null,
    outputs: (row.outputs ?? {}) as PendingRunSummary["outputs"],
    loads: parsePendingRunLoads(row.inputs),
  }));
}

export async function approveRun(runId: string, reviewerId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const updated = await prisma.calculationRun.updateMany({
    where: { id: runId, status: "PENDING" },
    data: {
      status: "APPROVED",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNote: null,
    },
  });

  if (updated.count === 0) {
    throw new Error("This calculation is no longer pending.");
  }
}

export async function rejectRun(
  runId: string,
  reviewerId: string,
  reviewNote?: string,
) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const note = reviewNote?.trim() || null;

  const updated = await prisma.calculationRun.updateMany({
    where: { id: runId, status: "PENDING" },
    data: {
      status: "REJECTED",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNote: note,
    },
  });

  if (updated.count === 0) {
    throw new Error("This calculation is no longer pending.");
  }
}

export async function createPendingCalculationRun(args: {
  calculationId: string;
  operatorId: string;
  submittedById: string;
  inputs: unknown;
  outputs: unknown;
}): Promise<{ id: string } | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  return prisma.calculationRun.create({
    data: {
      calculationId: args.calculationId,
      operatorId: args.operatorId,
      submittedById: args.submittedById,
      status: "PENDING",
      inputs: args.inputs as object,
      outputs: args.outputs as object,
    },
    select: { id: true },
  });
}
