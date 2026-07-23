import assert from "node:assert/strict";

const {
  ADIPIC_TO_DETA_MASS_RATIO,
  calculatePolymer973ExtraDeta,
  DETA_PER_ADIPIC,
  sumLoads,
} = await import("./polymer-973.ts");

assert.equal(ADIPIC_TO_DETA_MASS_RATIO.toFixed(10), "1.2518778167");
assert.equal(sumLoads([900, 900, 800]), 2600);
assert.equal(sumLoads([1000, 1000, 1000, 1000]), 4000);

// 4 × 1000 kg Adipic → 3195 kg DETA target (rounded)
const full = calculatePolymer973ExtraDeta({
  adipicAcidKg: 4000,
  detaChargedKg: 0,
});
assert.equal(full.targetDetaKg, 3195);
assert.equal(full.extraDetaKg, 3195);
assert.equal(full.massRatioLabel, "1.2518778167");

// ~90% DETA already charged
const ninety = calculatePolymer973ExtraDeta({
  adipicAcidKg: 4000,
  detaChargedKg: 2876,
});
assert.equal(ninety.targetDetaKg, 3195);
assert.equal(ninety.extraDetaKg, 319);

// Variable adipic from bulk bags
const adipic = 995 + 1002 + 988 + 1010;
const deta = 900 + 850 + 920;
const variable = calculatePolymer973ExtraDeta({
  adipicAcidKg: adipic,
  detaChargedKg: deta,
});
const expectedTarget = Math.round(adipic * DETA_PER_ADIPIC);
assert.equal(variable.adipicAcidKg, adipic);
assert.equal(variable.detaChargedKg, deta);
assert.equal(variable.targetDetaKg, expectedTarget);
assert.equal(variable.extraDetaKg, expectedTarget - deta);

console.log("polymer-973 tests passed");
