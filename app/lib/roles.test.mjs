import assert from "node:assert/strict";

const {
  USER_ROLES,
  ACCESS_LEVEL_LABELS,
  isApproverOrAdmin,
  isManagerOrAdmin,
  canReviewRuns,
  canManageOperators,
  canManageManagers,
  canManageUsers,
  canManageRoles,
  HSOLENIS_OPERATOR_ROLE_SLUG,
  accessLevelLabel,
} = await import("./roles.ts");

assert.deepEqual(USER_ROLES, ["STANDARD", "APPROVER", "ADMIN"]);

assert.equal(ACCESS_LEVEL_LABELS.ADMIN, "Admin");
assert.equal(ACCESS_LEVEL_LABELS.APPROVER, "Approver");
assert.equal(ACCESS_LEVEL_LABELS.STANDARD, "Standard access");
assert.equal(accessLevelLabel("APPROVER"), "Approver");

assert.equal(isApproverOrAdmin("STANDARD"), false);
assert.equal(isApproverOrAdmin("APPROVER"), true);
assert.equal(isApproverOrAdmin("ADMIN"), true);
assert.equal(isManagerOrAdmin("APPROVER"), true);

assert.equal(canReviewRuns("STANDARD"), false);
assert.equal(canReviewRuns("APPROVER"), true);
assert.equal(canReviewRuns("ADMIN"), true);

assert.equal(canManageOperators("STANDARD"), false);
assert.equal(canManageOperators("APPROVER"), true);
assert.equal(canManageOperators("ADMIN"), true);

assert.equal(canManageManagers("STANDARD"), false);
assert.equal(canManageManagers("APPROVER"), false);
assert.equal(canManageManagers("ADMIN"), true);

assert.equal(canManageUsers("STANDARD"), false);
assert.equal(canManageUsers("APPROVER"), false);
assert.equal(canManageUsers("ADMIN"), true);

assert.equal(canManageRoles("STANDARD"), false);
assert.equal(canManageRoles("APPROVER"), false);
assert.equal(canManageRoles("ADMIN"), true);

assert.equal(HSOLENIS_OPERATOR_ROLE_SLUG, "hsolenis-operator");

console.log("roles tests passed");
