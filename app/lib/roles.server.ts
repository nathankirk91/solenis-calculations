import { getPrisma } from "~/lib/db.server";
import type { UserRole } from "~/lib/roles";
import {
  HSOLENIS_OPERATOR_ROLE_SLUG,
  isAccessLevelRole,
} from "~/lib/roles";

export const SYSTEM_ROLE_SLUGS = {
  admin: "admin",
  approver: "approver",
  standard: "standard",
} as const;

export { HSOLENIS_OPERATOR_ROLE_SLUG, isAccessLevelRole };

export const PERMIT_SLOT_CODES = {
  operationsRep: "operations_rep",
  maintenanceRep: "maintenance_rep",
  safeWorkCoordinator: "safe_work_coordinator",
} as const;

export type PermitSlotCode =
  (typeof PERMIT_SLOT_CODES)[keyof typeof PERMIT_SLOT_CODES];

export type RoleRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type PermitSignOffSlotRecord = {
  id: string;
  code: PermitSlotCode | string;
  label: string;
  sortOrder: number;
  allowedRoleIds: string[];
  allowedRoles: Array<{ id: string; slug: string; name: string }>;
};

const DEFAULT_ROLES: Array<{
  id: string;
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
  sortOrder: number;
}> = [
  {
    id: "role-admin",
    slug: SYSTEM_ROLE_SLUGS.admin,
    name: "Admin",
    description: "Full access including users and roles.",
    isSystem: true,
    sortOrder: 1,
  },
  {
    id: "role-manager",
    slug: SYSTEM_ROLE_SLUGS.approver,
    name: "Approver",
    description: "Approvals and form management.",
    isSystem: true,
    sortOrder: 2,
  },
  {
    id: "role-operator",
    slug: SYSTEM_ROLE_SLUGS.standard,
    name: "Standard access",
    description: "Plant-floor login for calculations, inspections, and permits.",
    isSystem: true,
    sortOrder: 3,
  },
  {
    id: "role-hsolenis-operator",
    slug: HSOLENIS_OPERATOR_ROLE_SLUG,
    name: "hSolenis Operator",
    description:
      "Shown in calculation operator dropdowns when assigned to a user.",
    isSystem: true,
    sortOrder: 4,
  },
];

const DEFAULT_SLOTS: Array<{
  id: string;
  code: PermitSlotCode;
  label: string;
  sortOrder: number;
}> = [
  {
    id: "slot-operations-rep",
    code: PERMIT_SLOT_CODES.operationsRep,
    label: "Operations representative / Account manager",
    sortOrder: 1,
  },
  {
    id: "slot-maintenance-rep",
    code: PERMIT_SLOT_CODES.maintenanceRep,
    label: "Maintenance representative / Account technician",
    sortOrder: 2,
  },
  {
    id: "slot-safe-work-coordinator",
    code: PERMIT_SLOT_CODES.safeWorkCoordinator,
    label: "Safe work coordinator",
    sortOrder: 3,
  },
];

export function primarySystemRoleFromSlugs(slugs: string[]): UserRole {
  if (slugs.includes(SYSTEM_ROLE_SLUGS.admin) || slugs.includes("admin")) {
    return "ADMIN";
  }
  if (
    slugs.includes(SYSTEM_ROLE_SLUGS.approver) ||
    slugs.includes("manager")
  ) {
    return "APPROVER";
  }
  return "STANDARD";
}

async function ensureAccessLevelEnumAndRoleSlugs(): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'user_role' AND e.enumlabel = 'OPERATOR'
      ) THEN
        ALTER TYPE "user_role" RENAME VALUE 'OPERATOR' TO 'STANDARD';
      END IF;
    END $$
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'user_role' AND e.enumlabel = 'MANAGER'
      ) THEN
        ALTER TYPE "user_role" RENAME VALUE 'MANAGER' TO 'APPROVER';
      END IF;
    END $$
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'STANDARD'::"user_role"
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "roles"
    SET slug = 'standard', name = 'Standard access',
        description = 'Plant-floor login for calculations, inspections, and permits.'
    WHERE slug = 'operator'
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "roles"
    SET slug = 'approver', name = 'Approver',
        description = 'Approvals and form management.'
    WHERE slug = 'manager'
  `);
}

export async function ensureRolesAndSignOffDefaults(): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    return;
  }

  await ensureAccessLevelEnumAndRoleSlugs();

  for (const role of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { slug: role.slug },
      update: {
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isActive: true,
        sortOrder: role.sortOrder,
      },
      create: {
        id: role.id,
        slug: role.slug,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isActive: true,
        sortOrder: role.sortOrder,
      },
    });
  }

  const rolesBySlug = Object.fromEntries(
    (
      await prisma.role.findMany({
        where: { slug: { in: DEFAULT_ROLES.map((role) => role.slug) } },
        select: { id: true, slug: true },
      })
    ).map((role) => [role.slug, role.id]),
  );

  for (const slot of DEFAULT_SLOTS) {
    await prisma.permitSignOffSlot.upsert({
      where: { code: slot.code },
      update: {
        label: slot.label,
        sortOrder: slot.sortOrder,
      },
      create: {
        id: slot.id,
        code: slot.code,
        label: slot.label,
        sortOrder: slot.sortOrder,
      },
    });
  }

  // Remove legacy built-in permit sign-off roles (now configured via Permit settings).
  await prisma.$executeRawUnsafe(`
    DELETE FROM "permit_sign_off_slot_roles"
    WHERE "role_id" IN (
      SELECT "id" FROM "roles"
      WHERE "slug" IN ('operations-rep', 'maintenance-rep', 'safe-work-coordinator')
    )
  `);
  await prisma.$executeRawUnsafe(`
    DELETE FROM "user_role_assignments"
    WHERE "role_id" IN (
      SELECT "id" FROM "roles"
      WHERE "slug" IN ('operations-rep', 'maintenance-rep', 'safe-work-coordinator')
    )
  `);
  await prisma.$executeRawUnsafe(`
    DELETE FROM "roles"
    WHERE "slug" IN ('operations-rep', 'maintenance-rep', 'safe-work-coordinator')
  `);

  // Backfill assignments from legacy users.role when a user has none yet.
  const users = await prisma.user.findMany({
    select: {
      id: true,
      role: true,
      roleAssignments: { select: { roleId: true } },
    },
  });

  for (const user of users) {
    if (user.roleAssignments.length > 0) {
      continue;
    }
    const slug =
      user.role === "ADMIN"
        ? SYSTEM_ROLE_SLUGS.admin
        : user.role === "APPROVER"
          ? SYSTEM_ROLE_SLUGS.approver
          : SYSTEM_ROLE_SLUGS.standard;
    const roleId = rolesBySlug[slug];
    if (!roleId) {
      continue;
    }
    await prisma.userRoleAssignment.create({
      data: { userId: user.id, roleId },
    });
  }
}

export async function listRoles(args?: {
  activeOnly?: boolean;
  excludeAccessLevels?: boolean;
}): Promise<RoleRecord[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }
  await ensureRolesAndSignOffDefaults();
  const rows = await prisma.role.findMany({
    where: args?.activeOnly ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows
    .filter((row) => !args?.excludeAccessLevels || !isAccessLevelRole(row.slug))
    .map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  }));
}

export async function createRole(args: {
  name: string;
  description?: string;
}): Promise<RoleRecord> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }
  await ensureRolesAndSignOffDefaults();

  const name = args.name.trim();
  if (!name) {
    throw new Error("Role name is required.");
  }

  const slug = slugifyRoleName(name);
  const existing = await prisma.role.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    throw new Error("A role with that name already exists.");
  }

  const maxSort = await prisma.role.aggregate({ _max: { sortOrder: true } });
  const row = await prisma.role.create({
    data: {
      slug,
      name,
      description: args.description?.trim() || "",
      isSystem: false,
      isActive: true,
      sortOrder: (maxSort._max.sortOrder ?? 20) + 1,
    },
  });

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

export async function updateRole(args: {
  roleId: string;
  name: string;
  description?: string;
  isActive: boolean;
}): Promise<RoleRecord> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const existing = await prisma.role.findUnique({
    where: { id: args.roleId },
  });
  if (!existing) {
    throw new Error("Role not found.");
  }

  const name = args.name.trim();
  if (!name) {
    throw new Error("Role name is required.");
  }

  // System roles keep fixed slugs; custom roles may rename slug with name.
  const slug = existing.isSystem ? existing.slug : slugifyRoleName(name);
  if (!existing.isSystem) {
    const clash = await prisma.role.findFirst({
      where: { slug, id: { not: args.roleId } },
      select: { id: true },
    });
    if (clash) {
      throw new Error("A role with that name already exists.");
    }
  }

  const row = await prisma.role.update({
    where: { id: args.roleId },
    data: {
      name,
      slug,
      description: args.description?.trim() || "",
      isActive: existing.isSystem ? true : args.isActive,
    },
  });

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

export async function deleteRole(roleId: string): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }
  const existing = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, isSystem: true },
  });
  if (!existing) {
    throw new Error("Role not found.");
  }
  if (existing.isSystem) {
    throw new Error("Built-in roles cannot be deleted.");
  }
  await prisma.role.delete({ where: { id: roleId } });
}

export async function listPermitSignOffSlots(): Promise<
  PermitSignOffSlotRecord[]
> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }
  await ensureRolesAndSignOffDefaults();
  const rows = await prisma.permitSignOffSlot.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      allowedRoles: {
        include: {
          role: {
            select: { id: true, slug: true, name: true, isActive: true },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    sortOrder: row.sortOrder,
    allowedRoleIds: row.allowedRoles.map((item) => item.roleId),
    allowedRoles: row.allowedRoles
      .filter((item) => item.role.isActive)
      .map((item) => ({
        id: item.role.id,
        slug: item.role.slug,
        name: item.role.name,
      })),
  }));
}

export async function updatePermitSignOffSlotRoles(args: {
  slotCode: string;
  roleIds: string[];
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }
  await ensureRolesAndSignOffDefaults();

  const slot = await prisma.permitSignOffSlot.findUnique({
    where: { code: args.slotCode },
    select: { id: true },
  });
  if (!slot) {
    throw new Error("Sign-off slot not found.");
  }

  const uniqueRoleIds = [...new Set(args.roleIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueRoleIds.length === 0) {
    throw new Error("Select at least one role for this sign-off.");
  }

  const validRoles = await prisma.role.findMany({
    where: { id: { in: uniqueRoleIds }, isActive: true },
    select: { id: true },
  });
  if (validRoles.length !== uniqueRoleIds.length) {
    throw new Error("One or more selected roles are invalid.");
  }

  await prisma.$transaction([
    prisma.permitSignOffSlotRole.deleteMany({ where: { slotId: slot.id } }),
    prisma.permitSignOffSlotRole.createMany({
      data: uniqueRoleIds.map((roleId) => ({
        slotId: slot.id,
        roleId,
      })),
    }),
  ]);
}

export async function listUsersEligibleForAnyPermitSignOff(): Promise<
  Array<{ id: string; name: string | null; email: string }>
> {
  const [operations, maintenance, coordinator] = await Promise.all([
    listUsersEligibleForSlot(PERMIT_SLOT_CODES.operationsRep),
    listUsersEligibleForSlot(PERMIT_SLOT_CODES.maintenanceRep),
    listUsersEligibleForSlot(PERMIT_SLOT_CODES.safeWorkCoordinator),
  ]);
  const byId = new Map<
    string,
    { id: string; name: string | null; email: string }
  >();
  for (const user of [...operations, ...maintenance, ...coordinator]) {
    byId.set(user.id, user);
  }
  return [...byId.values()].sort((a, b) => {
    const aLabel = (a.name ?? a.email).toLowerCase();
    const bLabel = (b.name ?? b.email).toLowerCase();
    return aLabel.localeCompare(bLabel);
  });
}

export async function listUsersEligibleForSlot(
  slotCode: string,
): Promise<Array<{ id: string; name: string | null; email: string }>> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }
  await ensureRolesAndSignOffDefaults();

  const slot = await prisma.permitSignOffSlot.findUnique({
    where: { code: slotCode },
    select: {
      allowedRoles: { select: { roleId: true } },
    },
  });
  if (!slot || slot.allowedRoles.length === 0) {
    return [];
  }

  const roleIds = slot.allowedRoles.map((item) => item.roleId);
  const users = await prisma.user.findMany({
    where: {
      roleAssignments: {
        some: { roleId: { in: roleIds } },
      },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true },
  });
  return users;
}

export async function userHasRoleForSlot(args: {
  userId: string;
  slotCode: string;
}): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma) {
    return false;
  }
  const slot = await prisma.permitSignOffSlot.findUnique({
    where: { code: args.slotCode },
    select: { allowedRoles: { select: { roleId: true } } },
  });
  if (!slot || slot.allowedRoles.length === 0) {
    return false;
  }
  const count = await prisma.userRoleAssignment.count({
    where: {
      userId: args.userId,
      roleId: { in: slot.allowedRoles.map((item) => item.roleId) },
    },
  });
  return count > 0;
}

function slugifyRoleName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || `role-${Date.now()}`;
}
