import assert from "node:assert/strict";

/**
 * Integration: permit issue schema validates checklist responses and
 * transforms applicable answers into a summary.
 */
const { SAFE_WORK_PERMIT } = await import("../../app/lib/inspections.ts");
const {
  createPermitIssueSchema,
  formatPermitNumber,
  parseAuthorizedPersonnel,
} = await import("../../app/lib/permit.schema.ts");
const { melbournePermitYearMonth } = await import(
  "../../app/lib/datetime.ts"
);

const SAMPLE_SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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
  assert.equal(formatPermitNumber("2608", 2), "2608002");
  assert.equal(formatPermitNumber("2608", 12), "2608012");
  assert.equal(
    melbournePermitYearMonth(new Date("2026-08-02T14:00:00.000Z")),
    "2608",
  );
}

{
  assert.deepEqual(parseAuthorizedPersonnel(["Alex"]), [
    { name: "Alex", signature: "" },
  ]);
  assert.deepEqual(
    parseAuthorizedPersonnel([
      { name: "Alex", signature: SAMPLE_SIGNATURE },
      { name: "Sam", signature: "" },
    ]),
    [
      { name: "Alex", signature: SAMPLE_SIGNATURE },
      { name: "Sam", signature: "" },
    ],
  );
}

{
  const schema = createPermitIssueSchema(SAFE_WORK_PERMIT);
  const parsed = schema.safeParse({
    equipmentRef: "P-100",
    authorizedPersonnel: [
      { name: "Alex Operator", signature: SAMPLE_SIGNATURE },
    ],
    responses: fillRequired(SAFE_WORK_PERMIT),
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.equipmentRef, "P-100");
  assert.deepEqual(parsed.data.authorizedPersonnel, [
    { name: "Alex Operator", signature: SAMPLE_SIGNATURE },
  ]);
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
    authorizedPersonnel: [
      { name: "Alex Operator", signature: SAMPLE_SIGNATURE },
    ],
    responses,
  });
  assert.equal(parsed.success, false);
}

{
  const schema = createPermitIssueSchema(SAFE_WORK_PERMIT);
  const parsed = schema.safeParse({
    equipmentRef: "P-100",
    authorizedPersonnel: [{ name: "  ", signature: "" }],
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
  const missingSignature = schema.safeParse({
    equipmentRef: "P-100",
    authorizedPersonnel: [{ name: "Alex Operator", signature: "" }],
    responses: fillRequired(SAFE_WORK_PERMIT),
  });
  assert.equal(missingSignature.success, false);
  assert.ok(
    missingSignature.error.issues.some(
      (issue) =>
        Array.isArray(issue.path) &&
        issue.path[0] === "authorizedPersonnel" &&
        issue.path[2] === "signature",
    ),
  );

  const optionalSecond = schema.safeParse({
    equipmentRef: "P-100",
    authorizedPersonnel: [
      { name: "Alex Operator", signature: SAMPLE_SIGNATURE },
      { name: "Sam Helper", signature: "" },
    ],
    responses: fillRequired(SAFE_WORK_PERMIT),
  });
  assert.equal(optionalSecond.success, true);
  assert.equal(optionalSecond.data.authorizedPersonnel.length, 2);
  assert.equal(optionalSecond.data.authorizedPersonnel[1].signature, "");
}

{
  const schema = createPermitIssueSchema(SAFE_WORK_PERMIT);
  const parsed = schema.safeParse({
    equipmentRef: "P-100",
    authorizedPersonnel: [
      { name: "Alex Operator", signature: SAMPLE_SIGNATURE },
    ],
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
