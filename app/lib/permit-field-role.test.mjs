import assert from "node:assert/strict";

const {
  SAFE_WORK_PERMIT,
  buildAnswersFromResponses,
  findQuestionByPermitFieldRole,
  inferPermitFieldRoleFromId,
  resolvePermitFieldRole,
} = await import("./inspections.ts");

{
  assert.equal(
    inferPermitFieldRoleFromId("safe-work-permit__start-time"),
    "start_time",
  );
  assert.equal(
    inferPermitFieldRoleFromId("safe-work-permit__end-time"),
    "end_time",
  );
  assert.equal(inferPermitFieldRoleFromId("safe-work-permit__area"), "area");
  assert.equal(inferPermitFieldRoleFromId("cmxyz123"), null);
}

{
  assert.equal(
    resolvePermitFieldRole({
      id: "abc",
      label: "Work location",
      permitFieldRole: "area",
    }),
    "area",
  );
  assert.equal(
    resolvePermitFieldRole({
      id: "cmcustom",
      label: "Start time",
    }),
    "start_time",
  );
  assert.equal(
    resolvePermitFieldRole({
      id: "cmcustom",
      label: "Checklist item",
    }),
    null,
  );
}

{
  const start = findQuestionByPermitFieldRole(
    SAFE_WORK_PERMIT.questions,
    "start_time",
  );
  const end = findQuestionByPermitFieldRole(
    SAFE_WORK_PERMIT.questions,
    "end_time",
  );
  const area = findQuestionByPermitFieldRole(SAFE_WORK_PERMIT.questions, "area");
  assert.ok(start);
  assert.ok(end);
  assert.ok(area);
  assert.equal(start.permitFieldRole, "start_time");
  assert.equal(end.permitFieldRole, "end_time");
  assert.equal(area.permitFieldRole, "area");
}

{
  const answers = buildAnswersFromResponses(SAFE_WORK_PERMIT, {
    "safe-work-permit__start-time": "08:00",
    "safe-work-permit__end-time": "16:00",
    "safe-work-permit__area": "Tank farm",
  });
  assert.equal(
    answers.find((row) => row.questionId.endsWith("__start-time"))
      ?.permitFieldRole,
    "start_time",
  );
  assert.equal(
    answers.find((row) => row.questionId.endsWith("__area"))?.permitFieldRole,
    "area",
  );
}

console.log("permit-field-role unit tests passed");
