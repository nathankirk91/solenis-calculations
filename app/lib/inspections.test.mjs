import assert from "node:assert/strict";

const {
  FORKLIFT_DAILY_CHECK,
  summarizeInspectionResponses,
} = await import("./inspections.ts");

function allOkResponses() {
  /** @type {Record<string, "ok" | "attention" | "na">} */
  const responses = {};
  for (const section of FORKLIFT_DAILY_CHECK.sections) {
    for (const item of section.items) {
      responses[item.id] = "ok";
    }
  }
  return responses;
}

{
  const summary = summarizeInspectionResponses(
    FORKLIFT_DAILY_CHECK,
    allOkResponses(),
  );
  assert.equal(summary.status, "PASSED");
  assert.equal(summary.attentionCount, 0);
  assert.equal(summary.okCount, 10);
  assert.equal(summary.attentionItems.length, 0);
}

{
  const responses = allOkResponses();
  responses.brakes = "attention";
  responses["horn-lights"] = "na";

  const summary = summarizeInspectionResponses(FORKLIFT_DAILY_CHECK, responses);
  assert.equal(summary.status, "NEEDS_ATTENTION");
  assert.equal(summary.attentionCount, 1);
  assert.equal(summary.naCount, 1);
  assert.equal(summary.okCount, 8);
  assert.equal(summary.attentionItems[0]?.itemId, "brakes");
}

console.log("inspections tests passed");
