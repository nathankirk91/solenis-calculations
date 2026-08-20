export const USER_ROLES = ["STANDARD", "APPROVER", "ADMIN"] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Users with this role slug appear in calculation operator dropdowns. */
export const HSOLENIS_OPERATOR_ROLE_SLUG = "hsolenis-operator";

export const SYSTEM_ACCESS_LEVEL_SLUGS = {
  admin: "admin",
  approver: "approver",
  standard: "standard",
} as const;

/** Role slugs for built-in access levels (not listed on the Roles page). */
export const ACCESS_LEVEL_SLUGS = new Set<string>([
  SYSTEM_ACCESS_LEVEL_SLUGS.admin,
  SYSTEM_ACCESS_LEVEL_SLUGS.approver,
  SYSTEM_ACCESS_LEVEL_SLUGS.standard,
  // Legacy slugs before rename
  "manager",
  "operator",
]);

export function isAccessLevelRole(slug: string): boolean {
  return ACCESS_LEVEL_SLUGS.has(slug);
}

export const ACCESS_LEVEL_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  APPROVER: "Approver",
  STANDARD: "Standard access",
};

export function accessLevelLabel(role: UserRole): string {
  return ACCESS_LEVEL_LABELS[role];
}

export function isApproverOrAdmin(role: UserRole): boolean {
  return role === "APPROVER" || role === "ADMIN";
}

/** @deprecated Prefer isApproverOrAdmin. */
export function isManagerOrAdmin(role: UserRole): boolean {
  return isApproverOrAdmin(role);
}

export function canReviewRuns(role: UserRole): boolean {
  return isApproverOrAdmin(role);
}

export function canManageOperators(role: UserRole): boolean {
  return isApproverOrAdmin(role);
}

/** @deprecated Prefer canManageUsers. */
export function canManageManagers(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canManageUsers(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canManageRoles(role: UserRole): boolean {
  return role === "ADMIN";
}
