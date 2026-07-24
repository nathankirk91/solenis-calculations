import assert from "node:assert/strict";

const {
  POLYMER_973,
  POLYMER_AN04,
  calculatePolymerAdipicDetaExtra,
  getAdipicToDetaMassRatio,
  getDetaPerAdipic,
  sumLoads,
} = await import("./polymer-adipic-deta.ts");

assert.equal(getAdipicToDetaMassRatio(POLYMER_973).toFixed(10), "1.2518778167");
assert.equal(sumLoads([900, 900, 800]), 2600);
assert.equal(sumLoads([1000, 1000, 1000, 1000]), 4000);

const full = calculatePolymerAdipicDetaExtra(POLYMER_973, {
  adipicAcidKg: 4000,
  detaChargedKg: 0,
});
assert.equal(full.targetDetaKg, 3195);
assert.equal(full.extraDetaKg, 3195);
assert.equal(full.massRatioLabel, "1.2518778167");

const ninety = calculatePolymerAdipicDetaExtra(POLYMER_973, {
  adipicAcidKg: 4000,
  detaChargedKg: 2876,
});
assert.equal(ninety.targetDetaKg, 3195);
assert.equal(ninety.extraDetaKg, 319);

const adipic = 995 + 1002 + 988 + 1010;
const deta = 900 + 850 + 920;
const variable = calculatePolymerAdipicDetaExtra(POLYMER_AN04, {
  adipicAcidKg: adipic,
  detaChargedKg: deta,
});
const expectedTarget = Math.round(adipic * getDetaPerAdipic(POLYMER_AN04));
assert.equal(variable.adipicAcidKg, adipic);
assert.equal(variable.detaChargedKg, deta);
assert.equal(variable.targetDetaKg, expectedTarget);
assert.equal(variable.extraDetaKg, expectedTarget - deta);

console.log("polymer-adipic-deta tests passed");
