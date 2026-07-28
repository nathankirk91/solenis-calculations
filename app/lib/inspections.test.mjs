import assert from "node:assert/strict";

const {
  FORKLIFT_DAILY_CHECK,
  buildAnswersFromResponses,
  summarizeInspectionAnswers,
} = await import("./inspections.ts");

function passResponses(definition) {
  /** @type {Record<string, string>} */
  const responses = {};
  for (const question of definition.questions) {
    if (question.type === "YES_NO") {
      responses[question.id] = question.attentionValues.includes("Yes")
        ? "No"
        : "Yes";
    } else if (question.type === "RADIO") {
      const ok = question.options.find(
        (option) => !question.attentionValues.includes(option),
      );
      responses[question.id] = ok ?? question.options[0];
    } else if (question.type === "NUMBER") {
      responses[question.id] = "100";
    } else if (question.type === "DATE") {
      responses[question.id] = "2026-07-28";
    } else if (question.required) {
      responses[question.id] = "—";
    }
  }
  return responses;
}

{
  const answers = buildAnswersFromResponses(
    FORKLIFT_DAILY_CHECK,
    passResponses(FORKLIFT_DAILY_CHECK),
  );
  const summary = summarizeInspectionAnswers(answers);
  assert.equal(summary.status, "PASSED");
  assert.equal(summary.attentionCount, 0);
  assert.ok(summary.answeredCount > 0);
  assert.equal(summary.attentionItems.length, 0);
}

{
  const responses = passResponses(FORKLIFT_DAILY_CHECK);
  responses["forklift-daily-check__footbrake"] = "No";
  responses["forklift-daily-check__danger-tag"] = "No";

  const answers = buildAnswersFromResponses(FORKLIFT_DAILY_CHECK, responses);
  const summary = summarizeInspectionAnswers(answers);
  assert.equal(summary.status, "NEEDS_ATTENTION");
  assert.equal(summary.attentionCount, 1);
  assert.equal(
    summary.attentionItems[0]?.itemId,
    "forklift-daily-check__footbrake",
  );
}

{
  const responses = passResponses(FORKLIFT_DAILY_CHECK);
  responses["forklift-daily-check__danger-tag"] = "Yes";

  const summary = summarizeInspectionAnswers(
    buildAnswersFromResponses(FORKLIFT_DAILY_CHECK, responses),
  );
  assert.equal(summary.status, "NEEDS_ATTENTION");
  assert.equal(summary.attentionCount, 1);
  assert.equal(
    summary.attentionItems[0]?.itemId,
    "forklift-daily-check__danger-tag",
  );
}

{
  const yesNoDefinition = {
    ...FORKLIFT_DAILY_CHECK,
    questions: [
      {
        id: "q1",
        label: "Walkways clear?",
        type: "YES_NO",
        options: ["Yes", "No"],
        attentionValues: ["No"],
        required: true,
        sortOrder: 1,
      },
      {
        id: "q2",
        label: "Notes",
        type: "TEXT",
        options: [],
        attentionValues: [],
        required: false,
        sortOrder: 2,
      },
    ],
  };

  const answers = buildAnswersFromResponses(yesNoDefinition, {
    q1: "No",
    q2: "Spill near bay 2",
  });
  const summary = summarizeInspectionAnswers(answers);
  assert.equal(summary.status, "NEEDS_ATTENTION");
  assert.equal(summary.attentionCount, 1);
  assert.equal(answers[1]?.flagged, false);
  assert.equal(answers[1]?.answer, "Spill near bay 2");
}

console.log("inspections tests passed");
