import { parseWithZod } from "@conform-to/zod/v4";
import assert from "node:assert/strict";

/**
 * Integration: copying a closed permit keeps signatures, dates, and times
 * out of the new issue form even when those headings are selected.
 */
const { SAFE_WORK_PERMIT, groupQuestionsBySection } = await import(
  "../../app/lib/inspections.ts"
);
const {
  PERMIT_COPY_EQUIPMENT_HEADING_KEY,
  buildPermitCopyIssueHref,
  copyPermitFieldValues,
  createPermitCopyFormSchema,
  headingKeyForSectionTitle,
  isPermitFieldCopyable,
  listCopyablePermitHeadings,
  looksLikeSignatureValue,
  parseCopyHeadingsFromSearchParams,
  selectedHeadingsFromFormData,
} = await import("../../app/lib/permit-copy.ts");

const SAMPLE_SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function answer(questionId, overrides = {}) {
  const question = SAFE_WORK_PERMIT.questions.find((row) => row.id === questionId);
  assert.ok(question, `missing question ${questionId}`);
  return {
    questionId: question.id,
    label: question.label,
    sectionTitle: question.sectionTitle ?? null,
    type: question.type,
    answer: "",
    flagged: false,
    permitFieldRole: question.permitFieldRole ?? null,
    ...overrides,
  };
}

const sourceAnswers = [
  answer("safe-work-permit__date", { answer: "2026-08-19" }),
  answer("safe-work-permit__start-time", { answer: "08:00" }),
  answer("safe-work-permit__end-time", { answer: "16:00" }),
  answer("safe-work-permit__area", { answer: "Tank farm" }),
  answer("safe-work-permit__work-to-be-performed", {
    answer: "Change leaking pump",
  }),
  answer("safe-work-permit__last-contained", { answer: "Kymene" }),
  answer("safe-work-permit__required-ppe", { answer: "Goggles|Leather gloves" }),
  answer("safe-work-permit__ppe-other", { answer: "Hearing protection" }),
  {
    questionId: "safe-work-permit__permit-duration",
    label: "Duration",
    sectionTitle: "Permit details",
    type: "TEXT",
    answer: "8 hours",
    flagged: false,
  },
  {
    questionId: "safe-work-permit__operator-initials",
    label: "Operators initials",
    sectionTitle: "Close-out initials",
    type: "TEXT",
    answer: SAMPLE_SIGNATURE,
    flagged: false,
  },
];

{
  assert.equal(
    isPermitFieldCopyable({
      type: "DATE",
      label: "Date",
    }),
    false,
  );
  assert.equal(
    isPermitFieldCopyable({
      type: "TIME",
      label: "Start time",
      permitFieldRole: "start_time",
    }),
    false,
  );
  assert.equal(
    isPermitFieldCopyable({
      type: "TEXT",
      label: "Area",
      permitFieldRole: "area",
    }),
    true,
  );
  assert.equal(
    isPermitFieldCopyable({
      type: "TEXT",
      label: "Operators initials",
    }),
    false,
  );
  assert.equal(looksLikeSignatureValue(SAMPLE_SIGNATURE), true);
  assert.equal(looksLikeSignatureValue("Tank farm"), false);
}

{
  const headings = listCopyablePermitHeadings({
    answers: sourceAnswers,
    equipmentRef: "P-120",
    equipmentLabel: "Equipment number",
  });
  assert.deepEqual(
    headings.map((heading) => heading.key),
    [
      PERMIT_COPY_EQUIPMENT_HEADING_KEY,
      headingKeyForSectionTitle("Permit details"),
      headingKeyForSectionTitle("Work details"),
      headingKeyForSectionTitle("Required PPE"),
    ],
  );
  const permitDetails = headings.find(
    (heading) => heading.key === headingKeyForSectionTitle("Permit details"),
  );
  assert.deepEqual(permitDetails?.fieldLabels, ["Area"]);
  assert.equal(
    headings.some((heading) => heading.title === "Close-out initials"),
    false,
  );
}

{
  const copied = copyPermitFieldValues({
    sourceAnswers,
    sourceEquipmentRef: "P-120",
    selectedHeadingKeys: [
      PERMIT_COPY_EQUIPMENT_HEADING_KEY,
      headingKeyForSectionTitle("Permit details"),
      headingKeyForSectionTitle("Work details"),
      headingKeyForSectionTitle("Required PPE"),
      headingKeyForSectionTitle("Close-out initials"),
    ],
    questions: SAFE_WORK_PERMIT.questions,
  });

  assert.equal(copied.equipmentRef, "P-120");
  assert.equal(copied.responses["safe-work-permit__area"], "Tank farm");
  assert.equal(
    copied.responses["safe-work-permit__work-to-be-performed"],
    "Change leaking pump",
  );
  assert.equal(copied.responses["safe-work-permit__last-contained"], "Kymene");
  assert.equal(
    copied.responses["safe-work-permit__required-ppe"],
    "Goggles|Leather gloves",
  );
  assert.equal(
    copied.responses["safe-work-permit__ppe-other"],
    "Hearing protection",
  );
  assert.equal(copied.responses["safe-work-permit__date"], undefined);
  assert.equal(copied.responses["safe-work-permit__start-time"], undefined);
  assert.equal(copied.responses["safe-work-permit__end-time"], undefined);
  assert.equal(copied.responses["safe-work-permit__permit-duration"], undefined);
  assert.equal(
    copied.responses["safe-work-permit__operator-initials"],
    undefined,
  );
}

{
  const copied = copyPermitFieldValues({
    sourceAnswers,
    sourceEquipmentRef: "P-120",
    selectedHeadingKeys: [headingKeyForSectionTitle("Work details")],
    questions: SAFE_WORK_PERMIT.questions,
  });
  assert.equal(copied.equipmentRef, "");
  assert.deepEqual(Object.keys(copied.responses).sort(), [
    "safe-work-permit__last-contained",
    "safe-work-permit__work-to-be-performed",
  ]);
}

{
  const forcedDateHeading = copyPermitFieldValues({
    sourceAnswers,
    sourceEquipmentRef: "P-120",
    selectedHeadingKeys: [headingKeyForSectionTitle("Permit details")],
    questions: SAFE_WORK_PERMIT.questions.map((question) =>
      question.id === "safe-work-permit__area"
        ? { ...question, type: "DATE" }
        : question,
    ),
  });
  assert.equal(forcedDateHeading.responses["safe-work-permit__area"], undefined);
}

const allAnswers = SAFE_WORK_PERMIT.questions.map((question) => ({
  questionId: question.id,
  label: question.label,
  sectionTitle: question.sectionTitle ?? null,
  type: question.type,
  permitFieldRole: question.permitFieldRole ?? null,
  flagged: false,
  answer:
    question.type === "DATE"
      ? "2026-08-19"
      : question.type === "TIME"
        ? question.permitFieldRole === "end_time"
          ? "16:00"
          : "08:00"
        : question.type === "CHECKBOX"
          ? question.options[0] ?? ""
          : question.type === "RADIO"
            ? question.options[0] ?? ""
            : "copied",
}));

const headings = listCopyablePermitHeadings({
  answers: allAnswers,
  equipmentRef: "P-120",
  equipmentLabel: SAFE_WORK_PERMIT.equipmentLabel,
});
const headingKeys = headings.map((heading) => heading.key);
const schema = createPermitCopyFormSchema(headingKeys);
const parsed = schema.safeParse({ heading: headingKeys });
assert.equal(parsed.success, true);

const copiedAll = copyPermitFieldValues({
  sourceAnswers: allAnswers,
  sourceEquipmentRef: "P-120",
  selectedHeadingKeys: headingKeys,
  questions: SAFE_WORK_PERMIT.questions,
});

assert.equal(copiedAll.equipmentRef, "P-120");
assert.equal(copiedAll.responses["safe-work-permit__date"], undefined);
assert.equal(copiedAll.responses["safe-work-permit__start-time"], undefined);
assert.equal(copiedAll.responses["safe-work-permit__end-time"], undefined);
assert.equal(copiedAll.responses["safe-work-permit__area"], "copied");

for (const question of SAFE_WORK_PERMIT.questions) {
  if (question.type === "DATE" || question.type === "TIME") {
    assert.equal(copiedAll.responses[question.id], undefined);
  }
}

const copyableSections = groupQuestionsBySection(SAFE_WORK_PERMIT.questions)
  .filter((section) =>
    section.questions.some(
      (question) => question.type !== "DATE" && question.type !== "TIME",
    ),
  )
  .map((section) => headingKeyForSectionTitle(section.title));
for (const key of copyableSections) {
  assert.ok(headingKeys.includes(key), `expected copyable heading ${key}`);
}

{
  const formData = new FormData();
  formData.append("heading", headingKeyForSectionTitle("Work details"));
  formData.append("heading", headingKeyForSectionTitle("Required PPE"));
  const submission = parseWithZod(formData, { schema });
  assert.equal(submission.status, "success");
  if (submission.status === "success") {
    assert.deepEqual(submission.value.heading, [
      headingKeyForSectionTitle("Work details"),
      headingKeyForSectionTitle("Required PPE"),
    ]);
  }

  const rejected = createPermitCopyFormSchema([
    headingKeyForSectionTitle("Work details"),
  ]).safeParse({
    heading: [headingKeyForSectionTitle("Permit details")],
  });
  assert.equal(rejected.success, false);
}

{
  const href = buildPermitCopyIssueHref("/permits/safe-work-permit", "run-1", [
    headingKeyForSectionTitle("Work details"),
  ]);
  const url = new URL(href, "http://permit.local");
  assert.equal(url.pathname, "/permits/safe-work-permit");
  assert.equal(url.searchParams.get("copyFrom"), "run-1");
  assert.deepEqual(parseCopyHeadingsFromSearchParams(url.searchParams), [
    "section:Work details",
  ]);
  const formData = new FormData();
  formData.append("heading", headingKeyForSectionTitle("Work details"));
  formData.append("heading", headingKeyForSectionTitle("Work details"));
  formData.append("heading", "");
  assert.deepEqual(selectedHeadingsFromFormData(formData), [
    "section:Work details",
  ]);
}

console.log("permit-copy integration tests passed");
