import assert from "node:assert/strict";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Load TS via strip-types hook available in Node 22.6+
const { calculatePolymer973Charges } = await import("./polymer-973.ts");

const fromTotal = calculatePolymer973Charges({
  basis: "total",
  amountKg: 1000,
  molarRatio: 1,
});

assert.equal(fromTotal.totalKg, 1000);
assert.ok(Math.abs(fromTotal.molarRatioAdipicToDeta - 1) < 0.001);
assert.ok(fromTotal.adipicAcidKg > fromTotal.detaKg);

const fromAdipic = calculatePolymer973Charges({
  basis: "adipic",
  amountKg: fromTotal.adipicAcidKg,
  molarRatio: 1,
});

assert.ok(Math.abs(fromAdipic.detaKg - fromTotal.detaKg) < 0.01);

const fromDeta = calculatePolymer973Charges({
  basis: "deta",
  amountKg: fromTotal.detaKg,
  molarRatio: 1,
});

assert.ok(Math.abs(fromDeta.adipicAcidKg - fromTotal.adipicAcidKg) < 0.01);

console.log("polymer-973 tests passed");
