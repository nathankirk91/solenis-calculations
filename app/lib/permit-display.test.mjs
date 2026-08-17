import assert from "node:assert/strict";

const {
  permitRecordHeading,
  workDescriptionFromAnswers,
} = await import("./permit-display.ts");

{
  const answers = [
    {
      questionId: "safe-work-permit__work-to-be-performed",
      label: "Work to be performed",
      sectionTitle: "Work details",
      type: "TEXT",
      answer: "Change leaking pump",
      flagged: false,
    },
    {
      questionId: "safe-work-permit__area",
      label: "Area",
      sectionTitle: "Permit details",
      type: "TEXT",
      answer: "Kymene Building",
      flagged: false,
    },
  ];
  assert.equal(
    workDescriptionFromAnswers(answers),
    "Change leaking pump",
  );
  assert.equal(
    permitRecordHeading({
      workDescription: "Change leaking pump",
      equipmentRef: "Pump change",
      permitNumber: "2608002",
    }),
    "Change leaking pump",
  );
}

{
  assert.equal(
    permitRecordHeading({
      workDescription: null,
      equipmentRef: "Pump change",
      permitNumber: "2608002",
    }),
    "Pump change",
  );
  assert.equal(
    permitRecordHeading({
      workDescription: null,
      equipmentRef: null,
      permitNumber: "2608002",
    }),
    "#2608002",
  );
}

console.log("permit-display tests passed");
