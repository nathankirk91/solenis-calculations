import assert from "node:assert/strict";

const {
  flattenFormErrorTree,
  isTransientDbError,
  labelForPermitFormPath,
  listPermitFormIssues,
  permitSaveErrorMessage,
  withTransientRetry,
} = await import("./permit-form-errors.ts");

const definition = {
  equipmentLabel: "Equipment number",
  questions: [
    {
      id: "safe-work-permit__end-time",
      label: "End time",
    },
    {
      id: "safe-work-permit__hazard-cleared",
      label:
        "1. Has line and/or equipment been cleared of material and any residual pressure?",
    },
  ],
};

{
  assert.match(
    permitSaveErrorMessage(new Error("secret-internal-stack")),
    /save error, not a safety rejection/i,
  );
  assert.match(
    permitSaveErrorMessage(new Error("Connection terminated due to connection timeout")),
    /timed out/i,
  );
  assert.match(
    permitSaveErrorMessage({ code: "P2024", message: "Timed out fetching a new connection" }),
    /timed out/i,
  );
  assert.match(
    permitSaveErrorMessage(new Error("Database is not configured.")),
    /not available/i,
  );
  assert.match(
    permitSaveErrorMessage(new Error("Permit form not found.")),
    /missing from the database/i,
  );
  assert.equal(isTransientDbError(new Error("timeout exceeded when trying to connect")), true);
  assert.equal(isTransientDbError(new Error("Permit form not found.")), false);
}

{
  assert.equal(
    labelForPermitFormPath("equipmentRef", definition),
    "Equipment number",
  );
  assert.equal(
    labelForPermitFormPath("authorizedPersonnel[0].signature", definition),
    "Authorized person sign-off",
  );
  assert.equal(
    labelForPermitFormPath("authorizedPersonnel.1.name", definition),
    "Authorized person 2",
  );
  assert.equal(
    labelForPermitFormPath("responses[safe-work-permit__end-time]", definition),
    "End time",
  );
  assert.equal(
    labelForPermitFormPath(
      "responses.safe-work-permit__hazard-cleared",
      definition,
    ),
    "1. Has line and/or equipment been cleared of material and any residual pressure?",
  );
}

{
  const nested = flattenFormErrorTree({
    responses: {
      "safe-work-permit__end-time": [
        "Permit duration (from start to end) cannot exceed 12 hours.",
      ],
    },
    authorizedPersonnel: {
      0: { signature: ["The first authorized person must sign off."] },
    },
  });
  assert.equal(nested.length, 2);
  assert.equal(
    nested.some((issue) => issue.path.includes("end-time")),
    true,
  );
  assert.equal(
    nested.some((issue) => issue.path.includes("signature")),
    true,
  );
}

{
  const issues = listPermitFormIssues({
    definition,
    formError:
      "The permit passed checks but could not be stored. This is a save error, not a safety rejection. Try again.",
    allErrors: {
      "responses[safe-work-permit__end-time]": [
        "Permit duration (from start to end) cannot exceed 12 hours.",
      ],
    },
  });
  assert.equal(issues[0]?.path, "");
  assert.match(issues[0]?.messages[0] ?? "", /not a safety rejection/);
  assert.equal(issues[1]?.label, "End time");
}

{
  let attempts = 0;
  const result = await withTransientRetry(async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error("timeout exceeded when trying to connect");
    }
    return "saved";
  });
  assert.equal(result, "saved");
  assert.equal(attempts, 2);

  await assert.rejects(
    () =>
      withTransientRetry(async () => {
        throw new Error("Permit form not found.");
      }),
    /Permit form not found/,
  );
}

console.log("permit-form-errors unit tests passed");
