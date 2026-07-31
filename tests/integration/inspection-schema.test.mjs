import assert from "node:assert/strict";

/**
 * Integration: inspection Zod schema + question applicability filters.
 * Ensures required validation and submit transforms only consider questions
 * that apply for the selected shift / first-of-week context.
 */
const {
  FORKLIFT_DAILY_CHECK_TEMPLATE,
  filterQuestionsForContext,
  filterQuestionsForEquipment,
  readShiftAnswer,
} = await import("../../app/lib/inspections.ts");
const { createInspectionSchema } = await import(
  "../../app/lib/inspection.schema.ts"
);

function basePayload(responses) {
  return {
    operatorId: "op-1",
    equipmentRef: "H57168",
    notes: "",
    actions: [],
    signature: "JD",
    responses,
  };
}

function fillRequired(questions, responses = {}) {
  /** @type {Record<string, string>} */
  const filled = { ...responses };
  for (const question of questions) {
    if (filled[question.id] != null && String(filled[question.id]).trim() !== "") {
      continue;
    }
    if (!question.required) {
      continue;
    }
    if (question.type === "YES_NO") {
      filled[question.id] = question.attentionValues.includes("Yes")
        ? "No"
        : "Yes";
    } else if (question.type === "RADIO") {
      const ok = question.options.find(
        (option) => !question.attentionValues.includes(option),
      );
      filled[question.id] = ok ?? question.options[0];
    } else if (question.type === "CHECKBOX") {
      filled[question.id] = question.options[0] ?? "";
    } else if (question.type === "NUMBER") {
      filled[question.id] = "100";
    } else if (question.type === "DATE") {
      filled[question.id] = "2026-07-28";
    } else if (question.type === "TIME") {
      filled[question.id] = "07:30";
    } else {
      filled[question.id] = "ok";
    }
  }
  return filled;
}

const template = FORKLIFT_DAILY_CHECK_TEMPLATE;
const weekly = template.questions.find((question) =>
  question.id.endsWith("__scrubber-drained"),
);
assert.ok(weekly, "expected first-of-week Day-only scrubber question");

const unitQuestions = filterQuestionsForEquipment(
  template.questions,
  "H57168",
);

{
  // Afternoon + not first week: weekly Day question must not be required.
  const schema = createInspectionSchema(
    { ...template, questions: unitQuestions },
    { isFirstInspectionOfWeek: false },
  );
  const applicable = filterQuestionsForContext(unitQuestions, {
    shift: "Afternoon",
    isFirstInspectionOfWeek: false,
  });
  assert.equal(
    applicable.some((question) => question.id === weekly.id),
    false,
  );

  const responses = fillRequired(applicable, {
    "forklift-daily-check__shift": "Afternoon",
  });
  // Intentionally omit the weekly question answer.
  delete responses[weekly.id];

  const parsed = schema.safeParse(basePayload(responses));
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.responses[weekly.id], undefined);
  assert.ok(
    !parsed.data.answers.some((answer) => answer.questionId === weekly.id),
  );
}

{
  // Day + first week: weekly question is required.
  const schema = createInspectionSchema(
    { ...template, questions: unitQuestions },
    { isFirstInspectionOfWeek: true },
  );
  const applicable = filterQuestionsForContext(unitQuestions, {
    shift: "Day",
    isFirstInspectionOfWeek: true,
  });
  assert.ok(applicable.some((question) => question.id === weekly.id));

  const responses = fillRequired(
    applicable.filter((question) => question.id !== weekly.id),
    { "forklift-daily-check__shift": "Day" },
  );
  delete responses[weekly.id];

  const parsed = schema.safeParse(basePayload(responses));
  assert.equal(parsed.success, false);
  const issue = parsed.error.issues.find(
    (row) =>
      Array.isArray(row.path) &&
      row.path[0] === "responses" &&
      row.path[1] === weekly.id,
  );
  assert.ok(issue, "expected required error on weekly question");
}

{
  // Successful Day + first week submit includes weekly answer in transform.
  const schema = createInspectionSchema(
    { ...template, questions: unitQuestions },
    { isFirstInspectionOfWeek: true },
  );
  const applicable = filterQuestionsForContext(unitQuestions, {
    shift: "Day",
    isFirstInspectionOfWeek: true,
  });
  const responses = fillRequired(applicable, {
    "forklift-daily-check__shift": "Day",
  });
  const parsed = schema.safeParse(basePayload(responses));
  assert.equal(parsed.success, true);
  assert.equal(
    readShiftAnswer(unitQuestions, parsed.data.responses),
    "Day",
  );
  assert.ok(parsed.data.responses[weekly.id]);
  assert.equal(parsed.data.summary.status, "PASSED");
  assert.ok(parsed.data.summary.answeredCount > 0);
}

{
  // Fixed equipment from unit form wins over payload equipmentRef.
  const schema = createInspectionSchema(
    {
      ...template,
      fixedEquipmentRef: "H20287",
      questions: filterQuestionsForEquipment(template.questions, "H20287"),
    },
    { isFirstInspectionOfWeek: true },
  );
  const questions = filterQuestionsForEquipment(template.questions, "H20287");
  const applicable = filterQuestionsForContext(questions, {
    shift: "Day",
    isFirstInspectionOfWeek: true,
  });
  const responses = fillRequired(applicable, {
    "forklift-daily-check__shift": "Day",
  });
  const parsed = schema.safeParse({
    ...basePayload(responses),
    equipmentRef: "H57168",
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.equipmentRef, "H20287");
}

console.log("inspection-schema integration tests passed");
