import bcrypt from "bcryptjs";

import { getPrisma } from "~/lib/db.server";
import type { UserRole } from "~/lib/roles";
import {
  ensureRolesAndSignOffDefaults,
  primarySystemRoleFromSlugs,
} from "~/lib/roles.server";

export type AuthRoleSummary = {
  id: string;
  slug: string;
  name: string;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  /** Primary access level (ADMIN / APPROVER / STANDARD). */
  role: UserRole;
  /** All assigned roles (system + custom). */
  roles: AuthRoleSummary[];
};

export type ManagedUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  roles: AuthRoleSummary[];
  createdAt: Date;
};

export async function verifyLogin(
  email: string,
  password: string,
): Promise<AuthUser> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      roleAssignments: {
        include: {
          role: {
            select: { id: true, slug: true, name: true, isActive: true },
          },
        },
      },
    },
  });

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid email or password.");
  }

  await ensureRolesAndSignOffDefaults();
  return toAuthUser(user);
}

export async function findAuthUserById(id: string): Promise<AuthUser | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      roleAssignments: {
        include: {
          role: {
            select: { id: true, slug: true, name: true, isActive: true },
          },
        },
      },
    },
  });
  return user ? toAuthUser(user) : null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/** @deprecated Prefer listManagedUsers. */
export type ManagedManager = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
};

/** @deprecated Prefer listManagedUsers. */
export async function listManagers(): Promise<ManagedManager[]> {
  const users = await listManagedUsers();
  return users
    .filter((user) => user.role === "APPROVER")
    .map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    }));
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }
  await ensureRolesAndSignOffDefaults();

  const rows = await prisma.user.findMany({
    orderBy: [{ name: "asc" }, { email: "asc" }],
    include: {
      roleAssignments: {
        include: {
          role: {
            select: { id: true, slug: true, name: true, isActive: true },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const roles = activeRoles(row.roleAssignments);
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: primarySystemRoleFromSlugs(roles.map((role) => role.slug)),
      roles,
      createdAt: row.createdAt,
    };
  });
}

export async function createManagedUser(args: {
  name: string;
  email: string;
  password: string;
  roleIds: string[];
  assignedById?: string | null;
}): Promise<ManagedUser> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }
  await ensureRolesAndSignOffDefaults();

  const name = args.name.trim();
  const email = args.email.trim().toLowerCase();
  const password = args.password;
  const roleIds = uniqueIds(args.roleIds);

  if (!name) {
    throw new Error("Name is required.");
  }
  if (!email || !email.includes("@")) {
    throw new Error("A valid email is required.");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  if (roleIds.length === 0) {
    throw new Error("Select at least one role.");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw new Error("A user with that email already exists.");
  }

  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds }, isActive: true },
    select: { id: true, slug: true, name: true },
  });
  if (roles.length !== roleIds.length) {
    throw new Error("One or more selected roles are invalid.");
  }

  const primaryRole = primarySystemRoleFromSlugs(roles.map((role) => role.slug));
  const passwordHash = await hashPassword(password);

  const created = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: primaryRole,
      roleAssignments: {
        create: roles.map((role) => ({
          roleId: role.id,
          assignedById: args.assignedById ?? null,
        })),
      },
    },
    include: {
      roleAssignments: {
        include: {
          role: {
            select: { id: true, slug: true, name: true, isActive: true },
          },
        },
      },
    },
  });

  const assigned = activeRoles(created.roleAssignments);
  return {
    id: created.id,
    email: created.email,
    name: created.name,
    role: primaryRole,
    roles: assigned,
    createdAt: created.createdAt,
  };
}

export async function updateManagedUser(args: {
  userId: string;
  name: string;
  email: string;
  /** When set (non-empty), replaces the user's password. */
  password?: string;
  roleIds: string[];
  assignedById?: string | null;
}): Promise<ManagedUser> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }
  await ensureRolesAndSignOffDefaults();

  const name = args.name.trim();
  const email = args.email.trim().toLowerCase();
  const password = args.password?.trim() ?? "";
  const roleIds = uniqueIds(args.roleIds);

  if (!name) {
    throw new Error("Name is required.");
  }
  if (!email || !email.includes("@")) {
    throw new Error("A valid email is required.");
  }
  if (password && password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  if (roleIds.length === 0) {
    throw new Error("Select at least one role.");
  }

  const existing = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("User not found.");
  }

  const emailTaken = await prisma.user.findFirst({
    where: { email, id: { not: args.userId } },
    select: { id: true },
  });
  if (emailTaken) {
    throw new Error("A user with that email already exists.");
  }

  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds }, isActive: true },
    select: { id: true, slug: true, name: true },
  });
  if (roles.length !== roleIds.length) {
    throw new Error("One or more selected roles are invalid.");
  }

  const primaryRole = primarySystemRoleFromSlugs(roles.map((role) => role.slug));
  const passwordHash = password ? await hashPassword(password) : null;

  await prisma.$transaction([
    prisma.userRoleAssignment.deleteMany({ where: { userId: args.userId } }),
    prisma.userRoleAssignment.createMany({
      data: roles.map((role) => ({
        userId: args.userId,
        roleId: role.id,
        assignedById: args.assignedById ?? null,
      })),
    }),
    prisma.user.update({
      where: { id: args.userId },
      data: {
        name,
        email,
        role: primaryRole,
        ...(passwordHash ? { passwordHash } : {}),
      },
    }),
  ]);

  const updated = await prisma.user.findUniqueOrThrow({
    where: { id: args.userId },
    include: {
      roleAssignments: {
        include: {
          role: {
            select: { id: true, slug: true, name: true, isActive: true },
          },
        },
      },
    },
  });

  const assigned = activeRoles(updated.roleAssignments);
  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: primaryRole,
    roles: assigned,
    createdAt: updated.createdAt,
  };
}

/** @deprecated Prefer updateManagedUser. */
export async function updateManagedUserRoles(args: {
  userId: string;
  roleIds: string[];
  assignedById?: string | null;
}): Promise<ManagedUser> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }
  const existing = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { name: true, email: true },
  });
  if (!existing) {
    throw new Error("User not found.");
  }
  return updateManagedUser({
    userId: args.userId,
    name: existing.name ?? "",
    email: existing.email,
    roleIds: args.roleIds,
    assignedById: args.assignedById,
  });
}

/** @deprecated Prefer createManagedUser. */
export async function createManager(args: {
  name: string;
  email: string;
  password: string;
}): Promise<ManagedManager> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }
  await ensureRolesAndSignOffDefaults();
  const managerRole = await prisma.role.findUnique({
    where: { slug: "approver" },
    select: { id: true },
  });
  const created = await createManagedUser({
    ...args,
    roleIds: managerRole ? [managerRole.id] : [],
  });
  return {
    id: created.id,
    email: created.email,
    name: created.name,
    createdAt: created.createdAt,
  };
}

function activeRoles(
  assignments: Array<{
    role: { id: string; slug: string; name: string; isActive: boolean };
  }>,
): AuthRoleSummary[] {
  return assignments
    .filter((item) => item.role.isActive)
    .map((item) => ({
      id: item.role.id,
      slug: item.role.slug,
      name: item.role.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function uniqueIds(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toAuthUser(user: {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  roleAssignments?: Array<{
    role: { id: string; slug: string; name: string; isActive: boolean };
  }>;
}): AuthUser {
  const roles = activeRoles(user.roleAssignments ?? []);
  const role =
    roles.length > 0
      ? primarySystemRoleFromSlugs(roles.map((item) => item.slug))
      : user.role;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    roles,
  };
}
