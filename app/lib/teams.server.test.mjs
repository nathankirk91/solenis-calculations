import assert from "node:assert/strict";

const { buildTeamsApprovalPayload, getAppBaseUrl } = await import(
  "./teams.server.ts"
);

const payload = buildTeamsApprovalPayload({
  calculationTitle: "Polymer 973 — Adipic Acid:DETA Ratio",
  operatorName: "Operator A",
  extraDetaKg: 319,
  targetDetaKg: 3195,
  detaChargedKg: 2876,
  adipicAcidKg: 4000,
  detaLoads: [900, 900, 800, 276],
  adipicBags: [1000, 1000, 1000, 1000],
  approvalsUrl: "https://example.com/approvals",
  submittedAt: new Date("2026-07-24T01:00:00.000Z"),
});

assert.equal(payload.type, "message");
assert.equal(payload.title, "Calculation pending approval");
assert.match(payload.text, /Extra DETA 319 kg/);
assert.equal(payload.attachments[0].contentType, "application/vnd.microsoft.card.adaptive");
assert.equal(
  payload.attachments[0].content.actions[0].url,
  "https://example.com/approvals",
);

const facts = payload.attachments[0].content.body.find(
  (block) => block.type === "FactSet",
);
assert.ok(facts);
assert.equal(
  facts.facts.find((fact) => fact.title === "Operator")?.value,
  "Operator A",
);
assert.equal(
  facts.facts.find((fact) => fact.title === "Submitted")?.value,
  "24 July 2026, 11:00 am",
);

assert.equal(
  getAppBaseUrl(new Request("https://app.example/calculations/x")),
  "https://app.example",
);

console.log("teams payload tests passed");
console.log("--- draft Teams payload ---");
console.log(JSON.stringify(payload, null, 2));
