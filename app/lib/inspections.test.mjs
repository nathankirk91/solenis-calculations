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
        showLastValue: false,
        applicableEquipmentRefs: [],
        sortOrder: 1,
      },
      {
        id: "q2",
        label: "Notes",
        type: "TEXT",
        options: [],
        attentionValues: [],
        required: false,
        showLastValue: false,
        applicableEquipmentRefs: [],
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

{
  const { buildLastAnswerMap, formatLastAnswerDisplay } = await import(
    "./inspections.ts"
  );

  const map = buildLastAnswerMap([
    {
      questionId: "forklift-daily-check__service-date",
      answer: "2026-07-15",
    },
    { questionId: "forklift-daily-check__hour-meter", answer: "4025.3" },
    { questionId: "empty", answer: "   " },
    { questionId: "", answer: "ignored" },
  ]);

  assert.deepEqual(map, {
    "forklift-daily-check__service-date": "2026-07-15",
    "forklift-daily-check__hour-meter": "4025.3",
  });
  assert.equal(
    formatLastAnswerDisplay("2026-07-15", "DATE"),
    "15 July 2026",
  );
  assert.equal(formatLastAnswerDisplay("4025.3", "NUMBER"), "4025.3");
}

{
  const {
    FORKLIFT_DAILY_CHECK_TEMPLATE,
    FORKLIFT_UNIT_FORMS,
    getFallbackInspectionByIdOrSlug,
  } = await import("./inspections.ts");

  assert.equal(FORKLIFT_DAILY_CHECK_TEMPLATE.isAvailable, false);
  assert.equal(FORKLIFT_UNIT_FORMS.length, 6);
  for (const form of FORKLIFT_UNIT_FORMS) {
    assert.equal(
      form.templateInspectionId,
      FORKLIFT_DAILY_CHECK_TEMPLATE.id,
    );
    assert.ok(form.fixedEquipmentRef);
    assert.equal(form.isAvailable, true);
    assert.equal(form.questions.length, 0);
  }
  const unit = getFallbackInspectionByIdOrSlug("forklift-daily-check-h57168");
  assert.equal(unit?.fixedEquipmentRef, "H57168");
  assert.equal(unit?.templateInspectionId, "forklift-daily-check");
  const serviceDate = FORKLIFT_DAILY_CHECK_TEMPLATE.questions.find((question) =>
    question.id.endsWith("__service-date"),
  );
  assert.equal(serviceDate?.showLastValue, true);
}

{
  const {
    FORKLIFT_DAILY_CHECK_TEMPLATE,
    filterQuestionsForEquipment,
    questionAppliesToEquipment,
  } = await import("./inspections.ts");

  const limited = {
    ...FORKLIFT_DAILY_CHECK_TEMPLATE.questions[0],
    applicableEquipmentRefs: ["H57168", "H15659"],
  };
  assert.equal(questionAppliesToEquipment(limited, "H57168"), true);
  assert.equal(questionAppliesToEquipment(limited, "H20287"), false);
  assert.equal(
    questionAppliesToEquipment(
      { applicableEquipmentRefs: [] },
      "H20287",
    ),
    true,
  );

  const filtered = filterQuestionsForEquipment(
    [
      { ...limited, id: "a" },
      {
        ...limited,
        id: "b",
        applicableEquipmentRefs: [],
      },
      {
        ...limited,
        id: "c",
        applicableEquipmentRefs: ["H20287"],
      },
    ],
    "H57168",
  );
  assert.deepEqual(
    filtered.map((question) => question.id),
    ["a", "b"],
  );
}

console.log("inspections tests passed");
