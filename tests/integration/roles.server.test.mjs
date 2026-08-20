import assert from "node:assert/strict";

const { primarySystemRoleFromSlugs } = await import(
  "../../app/lib/roles.server.ts"
);

assert.equal(primarySystemRoleFromSlugs(["standard"]), "STANDARD");
assert.equal(primarySystemRoleFromSlugs(["operator"]), "STANDARD");
assert.equal(primarySystemRoleFromSlugs(["approver", "standard"]), "APPROVER");
assert.equal(primarySystemRoleFromSlugs(["manager", "operator"]), "APPROVER");
assert.equal(
  primarySystemRoleFromSlugs(["admin", "approver", "standard"]),
  "ADMIN",
);
assert.equal(
  primarySystemRoleFromSlugs(["operations-rep", "standard"]),
  "STANDARD",
);
assert.equal(primarySystemRoleFromSlugs([]), "STANDARD");

console.log("roles.server integration tests passed");
