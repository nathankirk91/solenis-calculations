import { getPrisma } from "~/lib/db.server";

export type OperatorOption = {
  id: string;
  name: string;
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
