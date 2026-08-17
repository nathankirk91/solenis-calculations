import assert from "node:assert/strict";

/**
 * Integration: Safe Work Permit duration and authorization helpers.
 */
const {
  createPermitIssueSchema,
  distinctPermitSignerIds,
  emptyPermitAuthorization,
  formatPermitDurationLabel,
  isPermitReadyToOpen,
  MAX_PERMIT_DURATION_HOURS,
  permitDurationMinutes,
  userHasAlreadySignedPermit,
} = await import("../../app/lib/permit.schema.ts");
const { SAFE_WORK_PERMIT } = await import("../../app/lib/inspections.ts");

{
  assert.equal(permitDurationMinutes("07:30", "15:30"), 8 * 60);
  assert.equal(permitDurationMinutes("22:00", "06:00"), 8 * 60);
  assert.ok(
    (permitDurationMinutes("06:00", "19:00") ?? 0) >
      MAX_PERMIT_DURATION_HOURS * 60,
  );
  assert.equal(formatPermitDurationLabel(90), "1h 30m");
  assert.equal(formatPermitDurationLabel(120), "2 hours");
}

{
  const auth = emptyPermitAuthorization();
  assert.equal(isPermitReadyToOpen(auth), false);
  assert.equal(isPermitReadyToOpen(auth, 3), false);

  auth.operationsRep = {
    userId: "user-1",
    name: "Ops",
    signature: "sig-1",
  };
  assert.equal(isPermitReadyToOpen(auth), false);
  assert.equal(userHasAlreadySignedPermit(auth, "user-1"), true);
  assert.equal(userHasAlreadySignedPermit(auth, "user-2"), false);

  auth.maintenanceRep = {
    userId: "user-2",
    name: "Maint",
    signature: "sig-2",
  };
  assert.equal(isPermitReadyToOpen(auth), true);
  assert.equal(isPermitReadyToOpen(auth, 2), true);
  assert.equal(isPermitReadyToOpen(auth, 3), false);
  assert.deepEqual(distinctPermitSignerIds(auth).sort(), ["user-1", "user-2"]);

  auth.safeWorkCoordinator = {
    userId: "user-3",
    name: "SWC",
    signature: "sig-3",
  };
  assert.equal(isPermitReadyToOpen(auth, 3), true);

  // Same person on two slots does not open the permit.
  const samePerson = emptyPermitAuthorization();
  samePerson.operationsRep = {
    userId: "user-1",
    name: "Ops",
    signature: "sig-1",
  };
  samePerson.maintenanceRep = {
    userId: "user-1",
    name: "Ops",
    signature: "sig-2",
  };
  assert.equal(distinctPermitSignerIds(samePerson).length, 1);
  assert.equal(isPermitReadyToOpen(samePerson), false);
  assert.equal(isPermitReadyToOpen(samePerson, 3), false);
}

{
  assert.equal(
    SAFE_WORK_PERMIT.questions.some((q) =>
      q.id.endsWith("__permit-duration"),
    ),
    false,
  );

  function fillRequired(overrides = {}) {
    /** @type {Record<string, string>} */
    const responses = {};
    for (const question of SAFE_WORK_PERMIT.questions) {
      if (!question.required) continue;
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

  const schema = createPermitIssueSchema(SAFE_WORK_PERMIT);
  const ok = schema.safeParse({
    equipmentRef: "P-100",
    authorizedPersonnel: [
      {
        name: "Alex Operator",
        signature:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      },
    ],
    responses: fillRequired(),
  });
  assert.equal(ok.success, true);

  const tooLong = schema.safeParse({
    equipmentRef: "P-100",
    authorizedPersonnel: [
      {
        name: "Alex Operator",
        signature:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      },
    ],
    responses: fillRequired({
      "safe-work-permit__start-time": "06:00",
      "safe-work-permit__end-time": "19:00",
    }),
  });
  assert.equal(tooLong.success, false);
  assert.ok(
    tooLong.error.issues.some((issue) =>
      String(issue.message).includes("12 hours"),
    ),
  );
}

console.log("permit-auth integration tests passed");
