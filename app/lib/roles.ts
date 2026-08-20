export const USER_ROLES = ["OPERATOR", "MANAGER", "ADMIN"] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Users with this role slug appear in calculation operator dropdowns. */
export const HSOLENIS_OPERATOR_ROLE_SLUG = "hsolenis-operator";

export function isManagerOrAdmin(role: UserRole): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

export function canReviewRuns(role: UserRole): boolean {
  return isManagerOrAdmin(role);
}

export function canManageOperators(role: UserRole): boolean {
  return isManagerOrAdmin(role);
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
