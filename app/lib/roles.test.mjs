import assert from "node:assert/strict";

const {
  USER_ROLES,
  isManagerOrAdmin,
  canReviewRuns,
  canManageOperators,
  canManageManagers,
  canManageUsers,
  canManageRoles,
} = await import("./roles.ts");

assert.deepEqual(USER_ROLES, ["OPERATOR", "MANAGER", "ADMIN"]);

assert.equal(isManagerOrAdmin("OPERATOR"), false);
assert.equal(isManagerOrAdmin("MANAGER"), true);
assert.equal(isManagerOrAdmin("ADMIN"), true);

assert.equal(canReviewRuns("OPERATOR"), false);
assert.equal(canReviewRuns("MANAGER"), true);
assert.equal(canReviewRuns("ADMIN"), true);

assert.equal(canManageOperators("OPERATOR"), false);
assert.equal(canManageOperators("MANAGER"), true);
assert.equal(canManageOperators("ADMIN"), true);

assert.equal(canManageManagers("OPERATOR"), false);
assert.equal(canManageManagers("MANAGER"), false);
assert.equal(canManageManagers("ADMIN"), true);

assert.equal(canManageUsers("OPERATOR"), false);
assert.equal(canManageUsers("MANAGER"), false);
assert.equal(canManageUsers("ADMIN"), true);

assert.equal(canManageRoles("OPERATOR"), false);
assert.equal(canManageRoles("MANAGER"), false);
assert.equal(canManageRoles("ADMIN"), true);

console.log("roles tests passed");
