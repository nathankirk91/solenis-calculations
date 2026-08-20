import { z } from "zod";

import {
  resolvePermitFieldRole,
  type InspectionAnswerRecord,
  type InspectionQuestionDef,
  type InspectionQuestionType,
  type PermitFieldRole,
} from "~/lib/inspections";

export const PERMIT_COPY_EQUIPMENT_HEADING_KEY = "equipment";

const UNTITLED_SECTION_TITLE = "Answers";

const SIGNATURE_LABEL_PATTERN =
  /\b(signature|initials|sign-off|sign off)\b/i;

type CopyableField = {
  type: InspectionQuestionType;
  label: string;
  permitFieldRole?: PermitFieldRole | null;
  questionId?: string;
  id?: string;
};

export type CopyablePermitHeading = {
  key: string;
  title: string;
  fieldLabels: string[];
};

export type CopiedPermitValues = {
  equipmentRef: string;
  responses: Record<string, string>;
};

function emptyToList(value: unknown): string[] {
  if (value == null || value === "") {
    return [];
  }
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => String(item).trim()).filter(Boolean);
}

export function headingKeyForSectionTitle(
  sectionTitle: string | null | undefined,
): string {
  return `section:${sectionTitle?.trim() ?? ""}`;
}

export function headingTitleForKey(
  key: string,
  equipmentLabel?: string | null,
): string {
  if (key === PERMIT_COPY_EQUIPMENT_HEADING_KEY) {
    return equipmentLabel?.trim() || "Equipment";
  }
  if (key === headingKeyForSectionTitle(null)) {
    return UNTITLED_SECTION_TITLE;
  }
  if (key.startsWith("section:")) {
    return key.slice("section:".length) || UNTITLED_SECTION_TITLE;
  }
  return key;
}

export function isSyntheticPermitDurationQuestion(questionId: string): boolean {
  return questionId.endsWith("__permit-duration");
}

export function looksLikeSignatureValue(value: string): boolean {
  return value.trim().toLowerCase().startsWith("data:image");
}

export function isPermitFieldCopyable(field: CopyableField): boolean {
  if (field.type === "DATE" || field.type === "TIME") {
    return false;
  }
  const questionId = field.questionId ?? field.id ?? "";
  if (questionId && isSyntheticPermitDurationQuestion(questionId)) {
    return false;
  }
  const role = resolvePermitFieldRole({
    id: questionId,
    label: field.label,
    permitFieldRole: field.permitFieldRole,
  });
  if (role === "start_time" || role === "end_time") {
    return false;
  }
  if (SIGNATURE_LABEL_PATTERN.test(field.label)) {
    return false;
  }
  return true;
}

export function listCopyablePermitHeadings(args: {
  answers: InspectionAnswerRecord[];
  equipmentRef?: string | null;
  equipmentLabel?: string | null;
}): CopyablePermitHeading[] {
  const headings: CopyablePermitHeading[] = [];
  const equipmentRef = args.equipmentRef?.trim() ?? "";
  if (args.equipmentLabel?.trim() && equipmentRef) {
    headings.push({
      key: PERMIT_COPY_EQUIPMENT_HEADING_KEY,
      title: args.equipmentLabel.trim(),
      fieldLabels: [equipmentRef],
    });
  }

  for (const answer of args.answers) {
    if (
      !isPermitFieldCopyable({
        type: answer.type,
        label: answer.label,
        permitFieldRole: answer.permitFieldRole,
        questionId: answer.questionId,
      })
    ) {
      continue;
    }
    const key = headingKeyForSectionTitle(answer.sectionTitle);
    const title = answer.sectionTitle?.trim() || UNTITLED_SECTION_TITLE;
    const existing = headings.find((heading) => heading.key === key);
    if (existing) {
      if (!existing.fieldLabels.includes(answer.label)) {
        existing.fieldLabels.push(answer.label);
      }
    } else {
      headings.push({
        key,
        title,
        fieldLabels: [answer.label],
      });
    }
  }

  return headings;
}

function findMatchingQuestion(
  questions: Array<
    Pick<
      InspectionQuestionDef,
      "id" | "label" | "sectionTitle" | "type" | "permitFieldRole"
    >
  >,
  answer: InspectionAnswerRecord,
) {
  return (
    questions.find((question) => question.id === answer.questionId) ??
    questions.find(
      (question) =>
        question.label.trim() === answer.label.trim() &&
        (question.sectionTitle?.trim() ?? "") ===
          (answer.sectionTitle?.trim() ?? ""),
    )
  );
}

export function copyPermitFieldValues(args: {
  sourceAnswers: InspectionAnswerRecord[];
  sourceEquipmentRef: string | null;
  selectedHeadingKeys: string[];
  questions: Array<
    Pick<
      InspectionQuestionDef,
      "id" | "label" | "sectionTitle" | "type" | "permitFieldRole"
    >
  >;
}): CopiedPermitValues {
  const selected = new Set(args.selectedHeadingKeys.filter(Boolean));
  const equipmentRef = selected.has(PERMIT_COPY_EQUIPMENT_HEADING_KEY)
    ? (args.sourceEquipmentRef?.trim() ?? "")
    : "";

  const responses: Record<string, string> = {};
  for (const answer of args.sourceAnswers) {
    if (
      !isPermitFieldCopyable({
        type: answer.type,
        label: answer.label,
        permitFieldRole: answer.permitFieldRole,
        questionId: answer.questionId,
      })
    ) {
      continue;
    }
    if (looksLikeSignatureValue(answer.answer)) {
      continue;
    }
    const headingKey = headingKeyForSectionTitle(answer.sectionTitle);
    if (!selected.has(headingKey)) {
      continue;
    }
    const question = findMatchingQuestion(args.questions, answer);
    if (
      !question ||
      !isPermitFieldCopyable({
        type: question.type,
        label: question.label,
        permitFieldRole: question.permitFieldRole,
        id: question.id,
      })
    ) {
      continue;
    }
    const value = answer.answer.trim();
    if (!value) {
      continue;
    }
    responses[question.id] = answer.answer;
  }

  return { equipmentRef, responses };
}

export function createPermitCopyFormSchema(allowedHeadingKeys: string[]) {
  const allowed = new Set(allowedHeadingKeys);
  return z.object({
    heading: z.preprocess(emptyToList, z.array(z.string())),
  }).superRefine((value, ctx) => {
    for (const key of value.heading) {
      if (!allowed.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: "Select headings from this permit only.",
          path: ["heading"],
        });
        return;
      }
    }
  });
}

export function selectedHeadingsFromFormData(formData: FormData): string[] {
  return [...new Set(emptyToList(formData.getAll("heading")))];
}

export function parseCopyHeadingsFromSearchParams(
  searchParams: URLSearchParams,
): string[] {
  return searchParams
    .getAll("heading")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function permitIssuePath(definition: {
  slug: string;
  href?: string | null;
}): string {
  if (definition.href?.startsWith("/permits/")) {
    return definition.href;
  }
  return `/permits/${definition.slug}`;
}

export function buildPermitCopyIssueHref(
  issuePath: string,
  copyFromId: string,
  headings: string[],
): string {
  const url = new URL(issuePath, "http://permit.local");
  url.searchParams.set("copyFrom", copyFromId);
  for (const heading of headings) {
    url.searchParams.append("heading", heading);
  }
  return `${url.pathname}${url.search}`;
}
