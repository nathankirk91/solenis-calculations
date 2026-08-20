import { getPrisma } from "~/lib/db.server";
import { HSOLENIS_OPERATOR_ROLE_SLUG } from "~/lib/roles";
import { ensureRolesAndSignOffDefaults } from "~/lib/roles.server";

export type OperatorOption = {
  id: string;
  name: string;
};

function displayName(user: { name: string | null; email: string }): string {
  return user.name?.trim() || user.email;
}

export async function listActiveOperators(): Promise<OperatorOption[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  await ensureRolesAndSignOffDefaults();

  const role = await prisma.role.findUnique({
    where: { slug: HSOLENIS_OPERATOR_ROLE_SLUG },
    select: { id: true },
  });
  if (!role) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      roleAssignments: { some: { roleId: role.id } },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true },
  });

  return users.map((user) => ({
    id: user.id,
    name: displayName(user),
  }));
}

export async function getActiveOperatorById(
  id: string,
): Promise<OperatorOption | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  await ensureRolesAndSignOffDefaults();

  const role = await prisma.role.findUnique({
    where: { slug: HSOLENIS_OPERATOR_ROLE_SLUG },
    select: { id: true },
  });
  if (!role) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      id,
      roleAssignments: { some: { roleId: role.id } },
    },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: displayName(user),
  };
}
