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
    } else if (question.type === "CHECKBOX") {
      const ok = question.options.find(
        (option) => !question.attentionValues.includes(option),
      );
      if (question.required) {
        responses[question.id] = ok ?? question.options[0] ?? "";
      }
    } else if (question.type === "NUMBER") {
      responses[question.id] = "100";
    } else if (question.type === "DATE") {
      responses[question.id] = "2026-07-28";
    } else if (question.type === "TIME") {
      responses[question.id] = "07:30";
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
        applicableShifts: [],
        firstOfWeekOnly: false,
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
        applicableShifts: [],
        firstOfWeekOnly: false,
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
  const { defaultAttentionValues, looksLikeAttentionOption } = await import(
    "./inspections.ts"
  );

  assert.equal(looksLikeAttentionOption("Afternoon"), false);
  assert.equal(looksLikeAttentionOption("No"), true);
  assert.equal(looksLikeAttentionOption("Needs attention"), true);
  assert.deepEqual(defaultAttentionValues("RADIO", ["Day", "Afternoon"]), []);
  assert.deepEqual(
    defaultAttentionValues("RADIO", ["OK", "Needs attention", "N/A"]),
    ["Needs attention"],
  );
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

{
  const {
    FORKLIFT_DAILY_CHECK_TEMPLATE,
    filterQuestionsForContext,
    findShiftQuestion,
    questionAppliesToShift,
    questionAppliesToWeek,
    readShiftAnswer,
  } = await import("./inspections.ts");

  const weekly = FORKLIFT_DAILY_CHECK_TEMPLATE.questions.find((question) =>
    question.id.endsWith("__scrubber-drained"),
  );
  assert.ok(weekly);
  assert.deepEqual(weekly.applicableShifts, ["Day"]);
  assert.equal(weekly.firstOfWeekOnly, true);
  assert.equal(weekly.required, true);

  assert.equal(questionAppliesToShift(weekly, "Day"), true);
  assert.equal(questionAppliesToShift(weekly, "Afternoon"), false);
  assert.equal(questionAppliesToShift(weekly, null), false);
  assert.equal(questionAppliesToShift({ applicableShifts: [] }, "Afternoon"), true);
  assert.equal(questionAppliesToWeek(weekly, true), true);
  assert.equal(questionAppliesToWeek(weekly, false), false);

  const shiftQuestion = findShiftQuestion(FORKLIFT_DAILY_CHECK_TEMPLATE.questions);
  assert.equal(shiftQuestion?.id, "forklift-daily-check__shift");
  assert.equal(
    readShiftAnswer(FORKLIFT_DAILY_CHECK_TEMPLATE.questions, {
      "forklift-daily-check__shift": "Day",
    }),
    "Day",
  );

  const dayFirst = filterQuestionsForContext(
    FORKLIFT_DAILY_CHECK_TEMPLATE.questions,
    { shift: "Day", isFirstInspectionOfWeek: true },
  );
  assert.ok(dayFirst.some((question) => question.id === weekly.id));

  const afternoon = filterQuestionsForContext(
    FORKLIFT_DAILY_CHECK_TEMPLATE.questions,
    { shift: "Afternoon", isFirstInspectionOfWeek: true },
  );
  assert.equal(
    afternoon.some((question) => question.id === weekly.id),
    false,
  );

  const dayLater = filterQuestionsForContext(
    FORKLIFT_DAILY_CHECK_TEMPLATE.questions,
    { shift: "Day", isFirstInspectionOfWeek: false },
  );
  assert.equal(
    dayLater.some((question) => question.id === weekly.id),
    false,
  );
}

{
  const {
    FORKLIFT_UNIT_FORMS,
    DAILY_STARTUP,
    DAILY_SHUTDOWN,
    FORKLIFT_DAILY_CHECK_TEMPLATE,
    FORKLIFT_INSPECTIONS_HREF,
    SAFE_WORK_PERMIT,
    buildHomeInspectionCatalog,
    buildPermitCatalog,
    isForkliftUnitInspection,
    isPermitInspection,
    parseCheckboxAnswer,
    serializeCheckboxAnswer,
    isAnswerFlagged,
  } = await import("./inspections.ts");

  assert.equal(isForkliftUnitInspection(FORKLIFT_UNIT_FORMS[0]), true);
  assert.equal(isForkliftUnitInspection(FORKLIFT_DAILY_CHECK_TEMPLATE), false);
  assert.equal(isForkliftUnitInspection(DAILY_STARTUP), false);
  assert.equal(isPermitInspection(SAFE_WORK_PERMIT), true);
  assert.equal(isPermitInspection(DAILY_STARTUP), false);

  const catalog = buildHomeInspectionCatalog([
    ...FORKLIFT_UNIT_FORMS.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      category: row.category,
      href: row.href,
      isAvailable: row.isAvailable,
    })),
    {
      id: DAILY_STARTUP.id,
      slug: DAILY_STARTUP.slug,
      title: DAILY_STARTUP.title,
      description: DAILY_STARTUP.description,
      category: DAILY_STARTUP.category,
      href: DAILY_STARTUP.href,
      isAvailable: true,
    },
    {
      id: DAILY_SHUTDOWN.id,
      slug: DAILY_SHUTDOWN.slug,
      title: DAILY_SHUTDOWN.title,
      description: DAILY_SHUTDOWN.description,
      category: DAILY_SHUTDOWN.category,
      href: DAILY_SHUTDOWN.href,
      isAvailable: true,
    },
    {
      id: SAFE_WORK_PERMIT.id,
      slug: SAFE_WORK_PERMIT.slug,
      title: SAFE_WORK_PERMIT.title,
      description: SAFE_WORK_PERMIT.description,
      category: SAFE_WORK_PERMIT.category,
      href: SAFE_WORK_PERMIT.href,
      isAvailable: true,
    },
    {
      id: FORKLIFT_DAILY_CHECK_TEMPLATE.id,
      slug: FORKLIFT_DAILY_CHECK_TEMPLATE.slug,
      title: FORKLIFT_DAILY_CHECK_TEMPLATE.title,
      description: FORKLIFT_DAILY_CHECK_TEMPLATE.description,
      category: FORKLIFT_DAILY_CHECK_TEMPLATE.category,
      href: FORKLIFT_DAILY_CHECK_TEMPLATE.href,
      isAvailable: false,
    },
  ]);

  assert.equal(catalog.length, 3);
  assert.equal(catalog[0]?.href, FORKLIFT_INSPECTIONS_HREF);
  assert.equal(catalog[0]?.title, "Forklift inspections");
  assert.deepEqual(
    catalog.slice(1).map((row) => row.id),
    [DAILY_STARTUP.id, DAILY_SHUTDOWN.id],
  );

  const permits = buildPermitCatalog([
    {
      id: SAFE_WORK_PERMIT.id,
      slug: SAFE_WORK_PERMIT.slug,
      title: SAFE_WORK_PERMIT.title,
      description: SAFE_WORK_PERMIT.description,
      category: SAFE_WORK_PERMIT.category,
      href: SAFE_WORK_PERMIT.href,
      isAvailable: true,
    },
    {
      id: DAILY_STARTUP.id,
      slug: DAILY_STARTUP.slug,
      title: DAILY_STARTUP.title,
      description: DAILY_STARTUP.description,
      category: DAILY_STARTUP.category,
      href: DAILY_STARTUP.href,
      isAvailable: true,
    },
  ]);
  assert.deepEqual(
    permits.map((row) => row.id),
    [SAFE_WORK_PERMIT.id],
  );

  const ppe = SAFE_WORK_PERMIT.questions.find(
    (question) => question.id === "safe-work-permit__required-ppe",
  );
  assert.ok(ppe);
  assert.equal(ppe.type, "CHECKBOX");
  assert.ok(ppe.options.length >= 2);

  const joined = serializeCheckboxAnswer(["Goggles", "Face shield"]);
  assert.deepEqual(parseCheckboxAnswer(joined), ["Goggles", "Face shield"]);
  assert.equal(
    isAnswerFlagged(
      { type: "CHECKBOX", attentionValues: ["SCBA"] },
      serializeCheckboxAnswer(["Goggles", "SCBA"]),
    ),
    true,
  );

  const permitAnswers = buildAnswersFromResponses(
    SAFE_WORK_PERMIT,
    passResponses(SAFE_WORK_PERMIT),
  );
  const permitSummary = summarizeInspectionAnswers(permitAnswers);
  assert.equal(permitSummary.status, "PASSED");
  assert.ok(permitSummary.answeredCount > 0);
}

console.log("inspections tests passed");
