import assert from "node:assert/strict";

const {
  FORKLIFT_DAILY_CHECK,
  buildAnswersFromResponses,
  summarizeInspectionAnswers,
} = await import("./inspections.ts");

function allOkResponses() {
  /** @type {Record<string, string>} */
  const responses = {};
  for (const question of FORKLIFT_DAILY_CHECK.questions) {
    responses[question.id] = "OK";
  }
  return responses;
}

{
  const answers = buildAnswersFromResponses(
    FORKLIFT_DAILY_CHECK,
    allOkResponses(),
  );
  const summary = summarizeInspectionAnswers(answers);
  assert.equal(summary.status, "PASSED");
  assert.equal(summary.attentionCount, 0);
  assert.equal(summary.answeredCount, 10);
  assert.equal(summary.attentionItems.length, 0);
}

{
  const responses = allOkResponses();
  responses["forklift-daily-check__brakes"] = "Needs attention";
  responses["forklift-daily-check__horn-lights"] = "N/A";

  const answers = buildAnswersFromResponses(FORKLIFT_DAILY_CHECK, responses);
  const summary = summarizeInspectionAnswers(answers);
  assert.equal(summary.status, "NEEDS_ATTENTION");
  assert.equal(summary.attentionCount, 1);
  assert.equal(summary.answeredCount, 10);
  assert.equal(
    summary.attentionItems[0]?.itemId,
    "forklift-daily-check__brakes",
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
