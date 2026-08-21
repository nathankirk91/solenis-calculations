import assert from "node:assert/strict";

const { parseChecklistQuestionFormData, SAFE_WORK_PERMIT } = await import(
  "./inspections.ts"
);

{
  const formData = new FormData();
  formData.set("label", "Area clear?");
  formData.set("helpText", "");
  formData.set("sectionTitle", "Site");
  formData.set("type", "YES_NO");
  formData.set("options", "");
  formData.set("required", "on");
  formData.append("attentionValues", "No");
  formData.append("applicableShifts", "Day");
  formData.append("applicableShifts", "Afternoon");
  formData.set("firstOfWeekOnly", "on");
  formData.append("applicableEquipmentRefs", "H57168");
  formData.set("permitFieldRole", "area");

  const permit = parseChecklistQuestionFormData(formData, "permit");
  assert.ok(!("error" in permit));
  assert.equal(permit.label, "Area clear?");
  assert.deepEqual(permit.applicableShifts, []);
  assert.deepEqual(permit.applicableEquipmentRefs, []);
  assert.equal(permit.firstOfWeekOnly, false);
  assert.equal(permit.permitFieldRole, "area");
  assert.deepEqual(permit.attentionValues, ["No"]);
}

{
  const formData = new FormData();
  formData.set("label", "Weekly grease?");
  formData.set("helpText", "");
  formData.set("sectionTitle", "");
  formData.set("type", "YES_NO");
  formData.set("options", "");
  formData.set("required", "on");
  formData.append("applicableShifts", "Day");
  formData.set("firstOfWeekOnly", "on");
  formData.append("applicableEquipmentRefs", "H57168");
  formData.set("permitFieldRole", "area");

  const inspection = parseChecklistQuestionFormData(formData, "inspection");
  assert.ok(!("error" in inspection));
  assert.deepEqual(inspection.applicableShifts, ["Day"]);
  assert.deepEqual(inspection.applicableEquipmentRefs, ["H57168"]);
  assert.equal(inspection.firstOfWeekOnly, true);
  assert.equal(inspection.permitFieldRole, null);
}

{
  for (const question of SAFE_WORK_PERMIT.questions) {
    assert.deepEqual(
      question.applicableShifts,
      [],
      `${question.id} should not restrict shifts`,
    );
    assert.equal(
      question.firstOfWeekOnly,
      false,
      `${question.id} should not be first-of-week only`,
    );
  }
}

console.log("checklist-question-kind.test.mjs: ok");
