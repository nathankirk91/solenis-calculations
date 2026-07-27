export const INSPECTION_QUESTION_TYPES = ["YES_NO", "TEXT", "RADIO"] as const;

export type InspectionQuestionType = (typeof INSPECTION_QUESTION_TYPES)[number];

export type InspectionQuestionDef = {
  id: string;
  label: string;
  helpText?: string | null;
  sectionTitle?: string | null;
  type: InspectionQuestionType;
  /** Choices for RADIO (and display labels for YES_NO). */
  options: string[];
  /** Answer values that mark the inspection as needing attention. */
  attentionValues: string[];
  required: boolean;
  sortOrder: number;
};

export type InspectionDefinition = {
  id: string;
  slug: string;
  title: string;
  shortName: string;
  description: string;
  category: string;
  href: string;
  sortOrder: number;
  equipmentLabel?: string | null;
  isAvailable: boolean;
  questions: InspectionQuestionDef[];
};

export type InspectionCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  href: string;
  isAvailable: boolean;
};

export type InspectionAnswerRecord = {
  questionId: string;
  label: string;
  sectionTitle: string | null;
  type: InspectionQuestionType;
  answer: string;
  flagged: boolean;
};

export type InspectionResponseRow = {
  questionId: string;
  label: string;
  sectionTitle: string | null;
  type: InspectionQuestionType;
  answer: string;
  flagged: boolean;
};

export type InspectionSummary = {
  answeredCount: number;
  attentionCount: number;
  /** @deprecated Prefer answeredCount; kept for older saved runs. */
  okCount?: number;
  /** @deprecated Prefer answeredCount - attentionCount. */
  naCount?: number;
  totalChecked?: number;
  status: "PASSED" | "NEEDS_ATTENTION";
  attentionItems: Array<{
    itemId: string;
    label: string;
    sectionTitle: string;
    answer?: string;
  }>;
};

export const YES_NO_OPTIONS = ["Yes", "No"] as const;
export const DEFAULT_YES_NO_ATTENTION = ["No"] as const;

export const STATUS_CHECK_OPTIONS = ["OK", "Needs attention", "N/A"] as const;
export const DEFAULT_STATUS_ATTENTION = ["Needs attention"] as const;

function statusQuestion(
  inspectionId: string,
  id: string,
  label: string,
  sectionTitle: string,
  sortOrder: number,
): InspectionQuestionDef {
  return {
    id: `${inspectionId}__${id}`,
    label,
    sectionTitle,
    type: "RADIO",
    options: [...STATUS_CHECK_OPTIONS],
    attentionValues: [...DEFAULT_STATUS_ATTENTION],
    required: true,
    sortOrder,
  };
}

export const FORKLIFT_DAILY_CHECK: InspectionDefinition = {
  id: "forklift-daily-check",
  slug: "forklift-daily-check",
  title: "Forklift — Daily Check",
  shortName: "Forklift check",
  description:
    "Pre-use forklift safety check before operating. Mark each item OK, Needs attention, or N/A.",
  category: "Equipment",
  href: "/inspections/forklift-daily-check",
  sortOrder: 1,
  equipmentLabel: "Forklift / unit ID",
  isAvailable: true,
  questions: [
    statusQuestion("forklift-daily-check", "tyres", "Tyres / wheels — condition, pressure, debris", "Pre-start visual", 1),
    statusQuestion(
      "forklift-daily-check",
      "forks-mast",
      "Forks, mast, chains, and carriage — no damage or slack",
      "Pre-start visual",
      2,
    ),
    statusQuestion(
      "forklift-daily-check",
      "hydraulics",
      "Hydraulics — no leaks under mast or cylinders",
      "Pre-start visual",
      3,
    ),
    statusQuestion(
      "forklift-daily-check",
      "body-damage",
      "Body / overhead guard — no new damage",
      "Pre-start visual",
      4,
    ),
    statusQuestion(
      "forklift-daily-check",
      "capacity-plate",
      "Load capacity plate readable and fitted",
      "Pre-start visual",
      5,
    ),
    statusQuestion(
      "forklift-daily-check",
      "horn-lights",
      "Horn, lights, and reverse beeper working",
      "Controls & safety devices",
      6,
    ),
    statusQuestion(
      "forklift-daily-check",
      "seat-belt",
      "Seat belt / operator restraint functional",
      "Controls & safety devices",
      7,
    ),
    statusQuestion(
      "forklift-daily-check",
      "brakes",
      "Service and parking brakes effective",
      "Controls & safety devices",
      8,
    ),
    statusQuestion(
      "forklift-daily-check",
      "steering",
      "Steering smooth with no excessive play",
      "Controls & safety devices",
      9,
    ),
    statusQuestion(
      "forklift-daily-check",
      "fluids-fuel",
      "Fluids / battery / fuel or LPG adequate",
      "Controls & safety devices",
      10,
    ),
  ],
};

export const DAILY_STARTUP: InspectionDefinition = {
  id: "daily-startup",
  slug: "daily-startup",
  title: "Daily Start-up",
  shortName: "Start-up",
  description:
    "Plant start-of-shift checks before production begins. Confirm the area is safe and ready.",
  category: "Shift",
  href: "/inspections/daily-startup",
  sortOrder: 2,
  isAvailable: true,
  questions: [
    statusQuestion("daily-startup", "ppe", "Required PPE available and worn", "People & area", 1),
    statusQuestion(
      "daily-startup",
      "walkways",
      "Walkways clear; housekeeping acceptable",
      "People & area",
      2,
    ),
    statusQuestion(
      "daily-startup",
      "lighting",
      "Area lighting adequate for the work",
      "People & area",
      3,
    ),
    statusQuestion(
      "daily-startup",
      "handover",
      "Previous shift handover notes reviewed",
      "People & area",
      4,
    ),
    statusQuestion(
      "daily-startup",
      "e-stops",
      "Emergency stops accessible and unobstructed",
      "Safety & plant readiness",
      5,
    ),
    statusQuestion(
      "daily-startup",
      "utilities",
      "Utilities (power, water, air) available as needed",
      "Safety & plant readiness",
      6,
    ),
    statusQuestion(
      "daily-startup",
      "spill-kits",
      "Spill kits and safety showers accessible",
      "Safety & plant readiness",
      7,
    ),
    statusQuestion(
      "daily-startup",
      "materials",
      "Materials / chemicals available for planned work",
      "Safety & plant readiness",
      8,
    ),
    statusQuestion(
      "daily-startup",
      "waste",
      "Waste containers not overflowing",
      "Safety & plant readiness",
      9,
    ),
  ],
};

export const DAILY_SHUTDOWN: InspectionDefinition = {
  id: "daily-shutdown",
  slug: "daily-shutdown",
  title: "Daily Shut-down",
  shortName: "Shut-down",
  description:
    "End-of-shift checks to leave the plant secure, tidy, and ready for the next crew.",
  category: "Shift",
  href: "/inspections/daily-shutdown",
  sortOrder: 3,
  isAvailable: true,
  questions: [
    statusQuestion(
      "daily-shutdown",
      "powered-down",
      "Equipment powered down / isolated as required",
      "Equipment & process",
      1,
    ),
    statusQuestion(
      "daily-shutdown",
      "vessels",
      "Vessels / tanks secured for the next shift",
      "Equipment & process",
      2,
    ),
    statusQuestion(
      "daily-shutdown",
      "alarms",
      "Alarms acknowledged; system status checked",
      "Equipment & process",
      3,
    ),
    statusQuestion(
      "daily-shutdown",
      "handover-notes",
      "Handover notes completed for the next shift",
      "Equipment & process",
      4,
    ),
    statusQuestion("daily-shutdown", "tools", "Tools returned and stored", "Housekeeping & security", 5),
    statusQuestion(
      "daily-shutdown",
      "spills",
      "Spillages cleaned; floors left safe",
      "Housekeeping & security",
      6,
    ),
    statusQuestion(
      "daily-shutdown",
      "waste-closed",
      "Waste segregated and containers closed",
      "Housekeeping & security",
      7,
    ),
    statusQuestion(
      "daily-shutdown",
      "doors",
      "Doors / gates secured as required",
      "Housekeeping & security",
      8,
    ),
    statusQuestion(
      "daily-shutdown",
      "area-tidy",
      "Area left tidy and safe",
      "Housekeeping & security",
      9,
    ),
  ],
};

export const INSPECTION_DEFINITIONS: InspectionDefinition[] = [
  FORKLIFT_DAILY_CHECK,
  DAILY_STARTUP,
  DAILY_SHUTDOWN,
];

export function getFallbackInspectionByIdOrSlug(
  idOrSlug: string,
): InspectionDefinition | undefined {
  return INSPECTION_DEFINITIONS.find(
    (inspection) =>
      inspection.id === idOrSlug || inspection.slug === idOrSlug,
  );
}

/** @deprecated Prefer getFallbackInspectionByIdOrSlug or DB loader. */
export function getInspectionById(
  id: string,
): InspectionDefinition | undefined {
  return getFallbackInspectionByIdOrSlug(id);
}

export function slugifyInspectionTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || `inspection-${Date.now()}`;
}

export function questionOptionsForType(
  type: InspectionQuestionType,
  options: string[] = [],
): string[] {
  if (type === "YES_NO") {
    return [...YES_NO_OPTIONS];
  }
  if (type === "TEXT") {
    return [];
  }
  return options.map((option) => option.trim()).filter(Boolean);
}

export function defaultAttentionValues(
  type: InspectionQuestionType,
  options: string[],
): string[] {
  if (type === "YES_NO") {
    return [...DEFAULT_YES_NO_ATTENTION];
  }
  if (type === "RADIO") {
    return options.filter((option) =>
      /need|fail|no|attention|defect/i.test(option),
    );
  }
  return [];
}

export function isAnswerFlagged(
  question: Pick<InspectionQuestionDef, "attentionValues">,
  answer: string,
): boolean {
  return question.attentionValues.includes(answer);
}

export function summarizeInspectionAnswers(
  answers: InspectionAnswerRecord[],
): InspectionSummary {
  const attentionItems = answers
    .filter((answer) => answer.flagged)
    .map((answer) => ({
      itemId: answer.questionId,
      label: answer.label,
      sectionTitle: answer.sectionTitle ?? "",
      answer: answer.answer,
    }));

  return {
    answeredCount: answers.filter((answer) => answer.answer.trim()).length,
    attentionCount: attentionItems.length,
    status: attentionItems.length > 0 ? "NEEDS_ATTENTION" : "PASSED",
    attentionItems,
  };
}

export function buildAnswersFromResponses(
  definition: InspectionDefinition,
  responses: Record<string, string>,
): InspectionAnswerRecord[] {
  return definition.questions.map((question) => {
    const answer = responses[question.id] ?? "";
    return {
      questionId: question.id,
      label: question.label,
      sectionTitle: question.sectionTitle ?? null,
      type: question.type,
      answer,
      flagged: Boolean(answer) && isAnswerFlagged(question, answer),
    };
  });
}

export function groupQuestionsBySection(
  questions: InspectionQuestionDef[],
): Array<{ title: string | null; questions: InspectionQuestionDef[] }> {
  const groups: Array<{
    title: string | null;
    questions: InspectionQuestionDef[];
  }> = [];

  for (const question of questions) {
    const title = question.sectionTitle?.trim() || null;
    const existing = groups.find((group) => group.title === title);
    if (existing) {
      existing.questions.push(question);
    } else {
      groups.push({ title, questions: [question] });
    }
  }

  return groups;
}

export function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item)).filter(Boolean);
}

/** Fallback catalog used when Supabase is not configured yet. */
export const FALLBACK_INSPECTIONS: InspectionCard[] =
  INSPECTION_DEFINITIONS.map((inspection) => ({
    id: inspection.id,
    slug: inspection.slug,
    title: inspection.title,
    description: inspection.description,
    category: inspection.category,
    href: inspection.href,
    isAvailable: inspection.isAvailable,
  }));
