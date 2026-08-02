import assert from "node:assert/strict";

/**
 * Integration: permit issue schema validates checklist responses and
 * transforms applicable answers into a summary.
 */
const { SAFE_WORK_PERMIT } = await import("../../app/lib/inspections.ts");
const { createPermitIssueSchema } = await import(
  "../../app/lib/permit.schema.ts"
);

function fillRequired(definition, overrides = {}) {
  /** @type {Record<string, string>} */
  const responses = {};
  for (const question of definition.questions) {
    if (!question.required) {
      continue;
    }
    if (question.type === "YES_NO") {
      responses[question.id] = question.attentionValues.includes("Yes")
        ? "No"
        : "Yes";
    } else if (question.type === "RADIO") {
      const ok = question.options.find(
        (option) => !question.attentionValues.includes(option),
      );
      responses[question.id] = ok ?? question.options[0];
    } else if (question.type === "CHECKBOX") {
      responses[question.id] = question.options[0] ?? "";
    } else if (question.type === "NUMBER") {
      responses[question.id] = "1";
    } else if (question.type === "DATE") {
      responses[question.id] = "2026-07-28";
    } else if (question.type === "TIME") {
      responses[question.id] = question.id.endsWith("__end-time")
        ? "16:00"
        : "08:00";
    } else {
      responses[question.id] = "ok";
    }
  }
  return { ...responses, ...overrides };
}

{
  const schema = createPermitIssueSchema(SAFE_WORK_PERMIT);
  const parsed = schema.safeParse({
    equipmentRef: "P-100",
    authorizedPersonnel: ["Alex Operator"],
    responses: fillRequired(SAFE_WORK_PERMIT),
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.equipmentRef, "P-100");
  assert.deepEqual(parsed.data.authorizedPersonnel, ["Alex Operator"]);
  assert.equal(parsed.data.summary.status, "PASSED");
  assert.ok(parsed.data.answers.length > 0);
  assert.equal(
    parsed.data.answers.some((row) =>
      row.questionId.endsWith("__permit-duration"),
    ),
    false,
  );
}

{
  const schema = createPermitIssueSchema(SAFE_WORK_PERMIT);
  const responses = fillRequired(SAFE_WORK_PERMIT);
  const required = SAFE_WORK_PERMIT.questions.find(
    (question) => question.required,
  );
  assert.ok(required);
  delete responses[required.id];

  const parsed = schema.safeParse({
    equipmentRef: "P-100",
    authorizedPersonnel: ["Alex Operator"],
    responses,
  });
  assert.equal(parsed.success, false);
}

{
  const schema = createPermitIssueSchema(SAFE_WORK_PERMIT);
  const parsed = schema.safeParse({
    equipmentRef: "P-100",
    authorizedPersonnel: ["  ", ""],
    responses: fillRequired(SAFE_WORK_PERMIT),
  });
  assert.equal(parsed.success, false);
  assert.ok(
    parsed.error.issues.some(
      (issue) =>
        Array.isArray(issue.path) && issue.path[0] === "authorizedPersonnel",
    ),
  );
}

{
  const schema = createPermitIssueSchema(SAFE_WORK_PERMIT);
  const parsed = schema.safeParse({
    equipmentRef: "P-100",
    authorizedPersonnel: ["Alex Operator"],
    responses: fillRequired(SAFE_WORK_PERMIT, {
      "safe-work-permit__start-time": "07:00",
      "safe-work-permit__end-time": "20:00",
    }),
  });
  assert.equal(parsed.success, false);
  assert.ok(
    parsed.error.issues.some((issue) =>
      String(issue.message).includes("12 hours"),
    ),
  );
}

console.log("permit-schema integration tests passed");
