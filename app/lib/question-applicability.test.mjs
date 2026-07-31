import assert from "node:assert/strict";

/**
 * Unit tests for question applicability (equipment, shift, first-of-week).
 * Empty equipment/shift lists mean "applies to all" except shift-restricted
 * questions reject a missing shift when a non-empty shift list is set.
 */
const {
  filterQuestionsForContext,
  filterQuestionsForEquipment,
  questionAppliesToContext,
  questionAppliesToEquipment,
  questionAppliesToShift,
  questionAppliesToWeek,
} = await import("./inspections.ts");

function q(overrides = {}) {
  return {
    id: "q",
    label: "Question",
    type: "YES_NO",
    options: ["Yes", "No"],
    attentionValues: [],
    required: true,
    showLastValue: false,
    applicableEquipmentRefs: [],
    applicableShifts: [],
    firstOfWeekOnly: false,
    sortOrder: 1,
    ...overrides,
  };
}

// --- equipment ---
{
  assert.equal(
    questionAppliesToEquipment({ applicableEquipmentRefs: [] }, "H57168"),
    true,
  );
  assert.equal(
    questionAppliesToEquipment({ applicableEquipmentRefs: null }, "H57168"),
    true,
  );
  assert.equal(
    questionAppliesToEquipment(
      { applicableEquipmentRefs: ["H57168"] },
      "H57168",
    ),
    true,
  );
  assert.equal(
    questionAppliesToEquipment(
      { applicableEquipmentRefs: ["H57168"] },
      "H20287",
    ),
    false,
  );
  // Missing / blank equipment keeps restricted questions visible until a unit is chosen.
  assert.equal(
    questionAppliesToEquipment({ applicableEquipmentRefs: ["H57168"] }, null),
    true,
  );
  assert.equal(
    questionAppliesToEquipment({ applicableEquipmentRefs: ["H57168"] }, "  "),
    true,
  );
  assert.equal(
    questionAppliesToEquipment(
      { applicableEquipmentRefs: ["H57168", "H15659"] },
      "H15659",
    ),
    true,
  );
}

{
  const questions = [
    q({ id: "all" }),
    q({ id: "a", applicableEquipmentRefs: ["H57168"] }),
    q({ id: "b", applicableEquipmentRefs: ["H20287"] }),
  ];
  assert.deepEqual(
    filterQuestionsForEquipment(questions, "H57168").map((row) => row.id),
    ["all", "a"],
  );
  assert.deepEqual(
    filterQuestionsForEquipment(questions, null).map((row) => row.id),
    ["all", "a", "b"],
  );
}

// --- shift ---
{
  assert.equal(questionAppliesToShift({ applicableShifts: [] }, "Day"), true);
  assert.equal(
    questionAppliesToShift({ applicableShifts: ["Day"] }, "Day"),
    true,
  );
  assert.equal(
    questionAppliesToShift({ applicableShifts: ["Day"] }, "Afternoon"),
    false,
  );
  assert.equal(
    questionAppliesToShift({ applicableShifts: ["Day"] }, null),
    false,
  );
  assert.equal(
    questionAppliesToShift({ applicableShifts: ["Day"] }, "  "),
    false,
  );
  assert.equal(
    questionAppliesToShift({ applicableShifts: ["Day", "Afternoon"] }, "Afternoon"),
    true,
  );
  // Non-array applicableShifts is treated as unrestricted.
  assert.equal(
    questionAppliesToShift({ applicableShifts: "Day" }, "Afternoon"),
    true,
  );
}

// --- first of week ---
{
  assert.equal(questionAppliesToWeek({ firstOfWeekOnly: false }, false), true);
  assert.equal(questionAppliesToWeek({ firstOfWeekOnly: false }, true), true);
  assert.equal(questionAppliesToWeek({ firstOfWeekOnly: true }, true), true);
  assert.equal(questionAppliesToWeek({ firstOfWeekOnly: true }, false), false);
}

// --- combined context ---
{
  const weeklyDay = q({
    id: "weekly",
    applicableShifts: ["Day"],
    firstOfWeekOnly: true,
  });
  assert.equal(
    questionAppliesToContext(weeklyDay, {
      shift: "Day",
      isFirstInspectionOfWeek: true,
    }),
    true,
  );
  assert.equal(
    questionAppliesToContext(weeklyDay, {
      shift: "Afternoon",
      isFirstInspectionOfWeek: true,
    }),
    false,
  );
  assert.equal(
    questionAppliesToContext(weeklyDay, {
      shift: "Day",
      isFirstInspectionOfWeek: false,
    }),
    false,
  );
  // Default week context is first-of-week = true when omitted.
  assert.equal(
    questionAppliesToContext(weeklyDay, { shift: "Day" }),
    true,
  );
}

{
  const questions = [
    q({ id: "always" }),
    q({ id: "day-only", applicableShifts: ["Day"] }),
    q({
      id: "weekly-day",
      applicableShifts: ["Day"],
      firstOfWeekOnly: true,
    }),
    q({ id: "afternoon-only", applicableShifts: ["Afternoon"] }),
  ];

  assert.deepEqual(
    filterQuestionsForContext(questions, {
      shift: "Day",
      isFirstInspectionOfWeek: true,
    }).map((row) => row.id),
    ["always", "day-only", "weekly-day"],
  );
  assert.deepEqual(
    filterQuestionsForContext(questions, {
      shift: "Day",
      isFirstInspectionOfWeek: false,
    }).map((row) => row.id),
    ["always", "day-only"],
  );
  assert.deepEqual(
    filterQuestionsForContext(questions, {
      shift: "Afternoon",
      isFirstInspectionOfWeek: true,
    }).map((row) => row.id),
    ["always", "afternoon-only"],
  );
  assert.deepEqual(
    filterQuestionsForContext(questions, {}).map((row) => row.id),
    ["always"],
  );
}

console.log("question-applicability tests passed");
