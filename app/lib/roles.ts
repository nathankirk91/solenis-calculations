export const USER_ROLES = ["OPERATOR", "MANAGER", "ADMIN"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isManagerOrAdmin(role: UserRole): boolean {
  return role === "MANAGER" || role === "ADMIN";
}

export function canReviewRuns(role: UserRole): boolean {
  return isManagerOrAdmin(role);
}
