import assert from "node:assert/strict";

const { primarySystemRoleFromSlugs } = await import(
  "../../app/lib/roles.server.ts"
);

assert.equal(primarySystemRoleFromSlugs(["operator"]), "OPERATOR");
assert.equal(primarySystemRoleFromSlugs(["manager", "operator"]), "MANAGER");
assert.equal(
  primarySystemRoleFromSlugs(["admin", "manager", "operator"]),
  "ADMIN",
);
assert.equal(
  primarySystemRoleFromSlugs(["operations-rep", "operator"]),
  "OPERATOR",
);
assert.equal(primarySystemRoleFromSlugs([]), "OPERATOR");

console.log("roles.server integration tests passed");
