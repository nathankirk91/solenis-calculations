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
assert.equal(getAdipicToDetaMassRatio(POLYMER_AN04).toFixed(10), "1.4106181072");
assert.equal(POLYMER_AN04.adipicFieldCount, 6);
assert.equal(POLYMER_AN04.adipicFieldMaxKg, 480);
assert.equal(POLYMER_AN04.initialDetaLoadFields, 5);
assert.equal(POLYMER_973.adipicFieldCount, 4);
assert.equal(POLYMER_973.initialDetaLoadFields, 4);
assert.equal(sumLoads([900, 900, 800]), 2600);
assert.equal(sumLoads([1000, 1000, 1000, 1000]), 4000);

const full973 = calculatePolymerAdipicDetaExtra(POLYMER_973, {
  adipicAcidKg: 4000,
  detaChargedKg: 0,
});
assert.equal(full973.targetDetaKg, 3195);
assert.equal(full973.extraDetaKg, 3195);
assert.equal(full973.massRatioLabel, "1.2518778167");

const ninety973 = calculatePolymerAdipicDetaExtra(POLYMER_973, {
  adipicAcidKg: 4000,
  detaChargedKg: 2876,
});
assert.equal(ninety973.targetDetaKg, 3195);
assert.equal(ninety973.extraDetaKg, 319);

const fullAn04 = calculatePolymerAdipicDetaExtra(POLYMER_AN04, {
  adipicAcidKg: 5500,
  detaChargedKg: 0,
});
assert.equal(fullAn04.targetDetaKg, 3899);
assert.equal(fullAn04.extraDetaKg, 3899);
assert.equal(fullAn04.massRatioLabel, "1.4106181072");

const ninetyAn04 = calculatePolymerAdipicDetaExtra(POLYMER_AN04, {
  adipicAcidKg: 5500,
  detaChargedKg: 3510,
});
assert.equal(ninetyAn04.targetDetaKg, 3899);
assert.equal(ninetyAn04.extraDetaKg, 389);

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
