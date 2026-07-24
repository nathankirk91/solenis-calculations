import assert from "node:assert/strict";

const { formatMelbourneDateTime } = await import("./datetime.ts");

assert.equal(
  formatMelbourneDateTime(new Date("2026-07-24T01:00:00.000Z")),
  "24 July 2026, 11:00 am",
);
assert.equal(formatMelbourneDateTime(null), null);

console.log("datetime tests passed");
