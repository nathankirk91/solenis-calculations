import assert from "node:assert/strict";

const { parsePendingRunLoads } = await import("./pending-run-loads.ts");

const parsed = parsePendingRunLoads({
  operatorId: "op-1",
  detaLoads: [900, 850, 920],
  adipicBags: [995, 1002, 988, 1010],
  detaChargedKg: 2670,
  adipicAcidKg: 3995,
});

assert.deepEqual(parsed.detaLoads, [900, 850, 920]);
assert.deepEqual(parsed.adipicBags, [995, 1002, 988, 1010]);
assert.equal(parsed.detaChargedKg, 2670);
assert.equal(parsed.adipicAcidKg, 3995);

const fromArraysOnly = parsePendingRunLoads({
  detaLoads: ["100", 200],
  adipicBags: [480, 490],
});
assert.deepEqual(fromArraysOnly.detaLoads, [100, 200]);
assert.equal(fromArraysOnly.detaChargedKg, 300);
assert.equal(fromArraysOnly.adipicAcidKg, 970);

assert.deepEqual(parsePendingRunLoads(null).detaLoads, []);

console.log("pending-run-loads tests passed");
