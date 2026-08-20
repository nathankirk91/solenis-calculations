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
  copyPermitFieldValues,
  createPermitCopyFormSchema,
  headingKeyForSectionTitle,
  listCopyablePermitHeadings,
} = await import("../../app/lib/permit-copy.ts");

const answers = SAFE_WORK_PERMIT.questions.map((question) => ({
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
  answers,
  equipmentRef: "P-120",
  equipmentLabel: SAFE_WORK_PERMIT.equipmentLabel,
});
const headingKeys = headings.map((heading) => heading.key);
const schema = createPermitCopyFormSchema(headingKeys);
const parsed = schema.safeParse({ heading: headingKeys });
assert.equal(parsed.success, true);

const copied = copyPermitFieldValues({
  sourceAnswers: answers,
  sourceEquipmentRef: "P-120",
  selectedHeadingKeys: headingKeys,
  questions: SAFE_WORK_PERMIT.questions,
});

assert.equal(copied.equipmentRef, "P-120");
assert.equal(copied.responses["safe-work-permit__date"], undefined);
assert.equal(copied.responses["safe-work-permit__start-time"], undefined);
assert.equal(copied.responses["safe-work-permit__end-time"], undefined);
assert.equal(copied.responses["safe-work-permit__area"], "copied");

for (const question of SAFE_WORK_PERMIT.questions) {
  if (question.type === "DATE" || question.type === "TIME") {
    assert.equal(copied.responses[question.id], undefined);
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
  assert.ok(
    headingKeys.includes(key),
    `expected copyable heading ${key}`,
  );
}

{
  const formData = new FormData();
  formData.append(
    "heading",
    headingKeyForSectionTitle("Work details"),
  );
  formData.append(
    "heading",
    headingKeyForSectionTitle("Required PPE"),
  );
  const submission = parseWithZod(formData, { schema });
  assert.equal(submission.status, "success");
  if (submission.status === "success") {
    assert.deepEqual(submission.value.heading, [
      headingKeyForSectionTitle("Work details"),
      headingKeyForSectionTitle("Required PPE"),
    ]);
  }
}

console.log("permit-copy integration tests passed");
