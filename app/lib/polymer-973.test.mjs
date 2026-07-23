import assert from "node:assert/strict";

const { calculatePolymer973ExtraDeta, DETA_PER_ADIPIC } = await import(
  "./polymer-973.ts"
);

// Full bag example: 4000 kg Adipic → 3195.2 kg DETA target
const full = calculatePolymer973ExtraDeta({
  adipicAcidKg: 4000,
  detaChargedKg: 0,
});
assert.equal(full.targetDetaKg, 3195.2);
assert.equal(full.extraDetaKg, 3195.2);

// ~90% DETA already charged
const ninety = calculatePolymer973ExtraDeta({
  adipicAcidKg: 4000,
  detaChargedKg: 2875.68,
});
assert.equal(ninety.targetDetaKg, 3195.2);
assert.equal(ninety.extraDetaKg, 319.52);

// Variable adipic from bulk bags
const variable = calculatePolymer973ExtraDeta({
  adipicAcidKg: 4125,
  detaChargedKg: 2900,
});
const expectedTarget = 4125 * DETA_PER_ADIPIC;
assert.ok(Math.abs(variable.targetDetaKg - expectedTarget) < 0.001);
assert.ok(
  Math.abs(variable.extraDetaKg - (expectedTarget - 2900)) < 0.001,
);

console.log("polymer-973 tests passed");
