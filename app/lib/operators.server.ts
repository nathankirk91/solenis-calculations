import { getPrisma } from "~/lib/db.server";

export type OperatorOption = {
  id: string;
  name: string;
};

export type ManagedOperator = OperatorOption & {
  isActive: boolean;
  sortOrder: number;
};

export async function listActiveOperators(): Promise<OperatorOption[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  return prisma.operator.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}

export async function listManagedOperators(): Promise<ManagedOperator[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  return prisma.operator.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, isActive: true, sortOrder: true },
  });
}

export async function getActiveOperatorById(
  id: string,
): Promise<OperatorOption | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  return prisma.operator.findFirst({
    where: { id, isActive: true },
    select: { id: true, name: true },
  });
}

export async function createOperator(name: string): Promise<OperatorOption> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Operator name is required.");
  }

  const existingActive = await prisma.operator.findFirst({
    where: {
      name: { equals: trimmed, mode: "insensitive" },
      isActive: true,
    },
    select: { id: true },
  });

  if (existingActive) {
    throw new Error("An active operator with that name already exists.");
  }

  const inactive = await prisma.operator.findFirst({
    where: {
      name: { equals: trimmed, mode: "insensitive" },
      isActive: false,
    },
    select: { id: true },
  });

  if (inactive) {
    const restored = await prisma.operator.update({
      where: { id: inactive.id },
      data: { isActive: true, name: trimmed },
      select: { id: true, name: true },
    });
    return restored;
  }

  const maxSort = await prisma.operator.aggregate({
    _max: { sortOrder: true },
  });

  return prisma.operator.create({
    data: {
      name: trimmed,
      isActive: true,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
    select: { id: true, name: true },
  });
}

export async function removeOperator(id: string): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const updated = await prisma.operator.updateMany({
    where: { id, isActive: true },
    data: { isActive: false },
  });

  if (updated.count === 0) {
    throw new Error("Operator not found or already removed.");
  }
}
