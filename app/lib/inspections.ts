export const INSPECTION_QUESTION_TYPES = [
  "YES_NO",
  "TEXT",
  "RADIO",
  "NUMBER",
  "DATE",
] as const;

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
  /**
   * When true, operators see the prior report's answer for this question
   * (configured by managers; not a per-submission toggle).
   */
  showLastValue: boolean;
  /**
   * Unit refs this question applies to (e.g. forklift H57168).
   * Empty means all units that inherit this template.
   */
  applicableEquipmentRefs: string[];
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
  /** When set, operators pick a unit from this list instead of free text. */
  equipmentChoices?: Array<{ value: string; label: string }>;
  /**
   * When set, this form inherits checklist questions from the template
   * inspection (e.g. shared forklift questions across unit forms).
   */
  templateInspectionId?: string | null;
  /** Locked unit for per-equipment forms (skips the unit picker). */
  fixedEquipmentRef?: string | null;
  /** Extra guidance shown above the checklist (e.g. Form 78 instructions). */
  instructionNotes?: string | null;
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
    showLastValue: false,
    applicableEquipmentRefs: [],
    sortOrder,
  };
}

function yesNoQuestion(
  inspectionId: string,
  id: string,
  label: string,
  sectionTitle: string,
  sortOrder: number,
  opts?: {
    required?: boolean;
    helpText?: string;
    attentionValues?: string[];
    showLastValue?: boolean;
    applicableEquipmentRefs?: string[];
  },
): InspectionQuestionDef {
  return {
    id: `${inspectionId}__${id}`,
    label,
    sectionTitle,
    type: "YES_NO",
    options: [...YES_NO_OPTIONS],
    attentionValues: opts?.attentionValues ?? [...DEFAULT_YES_NO_ATTENTION],
    required: opts?.required ?? true,
    showLastValue: opts?.showLastValue ?? false,
    applicableEquipmentRefs: opts?.applicableEquipmentRefs ?? [],
    sortOrder,
    helpText: opts?.helpText,
  };
}

function radioQuestion(
  inspectionId: string,
  id: string,
  label: string,
  sectionTitle: string,
  options: string[],
  sortOrder: number,
  opts?: {
    required?: boolean;
    helpText?: string;
    attentionValues?: string[];
    showLastValue?: boolean;
    applicableEquipmentRefs?: string[];
  },
): InspectionQuestionDef {
  return {
    id: `${inspectionId}__${id}`,
    label,
    sectionTitle,
    type: "RADIO",
    options,
    attentionValues: opts?.attentionValues ?? [],
    required: opts?.required ?? true,
    showLastValue: opts?.showLastValue ?? false,
    applicableEquipmentRefs: opts?.applicableEquipmentRefs ?? [],
    sortOrder,
    helpText: opts?.helpText,
  };
}

function textQuestion(
  inspectionId: string,
  id: string,
  label: string,
  sectionTitle: string,
  sortOrder: number,
  opts?: {
    required?: boolean;
    helpText?: string;
    showLastValue?: boolean;
    applicableEquipmentRefs?: string[];
  },
): InspectionQuestionDef {
  return {
    id: `${inspectionId}__${id}`,
    label,
    sectionTitle,
    type: "TEXT",
    options: [],
    attentionValues: [],
    required: opts?.required ?? true,
    showLastValue: opts?.showLastValue ?? false,
    applicableEquipmentRefs: opts?.applicableEquipmentRefs ?? [],
    sortOrder,
    helpText: opts?.helpText,
  };
}

function numberQuestion(
  inspectionId: string,
  id: string,
  label: string,
  sectionTitle: string,
  sortOrder: number,
  opts?: {
    required?: boolean;
    helpText?: string;
    showLastValue?: boolean;
    applicableEquipmentRefs?: string[];
  },
): InspectionQuestionDef {
  return {
    id: `${inspectionId}__${id}`,
    label,
    sectionTitle,
    type: "NUMBER",
    options: [],
    attentionValues: [],
    required: opts?.required ?? true,
    showLastValue: opts?.showLastValue ?? false,
    applicableEquipmentRefs: opts?.applicableEquipmentRefs ?? [],
    sortOrder,
    helpText: opts?.helpText,
  };
}

function dateQuestion(
  inspectionId: string,
  id: string,
  label: string,
  sectionTitle: string,
  sortOrder: number,
  opts?: {
    required?: boolean;
    helpText?: string;
    showLastValue?: boolean;
    applicableEquipmentRefs?: string[];
  },
): InspectionQuestionDef {
  return {
    id: `${inspectionId}__${id}`,
    label,
    sectionTitle,
    type: "DATE",
    options: [],
    attentionValues: [],
    required: opts?.required ?? true,
    showLastValue: opts?.showLastValue ?? false,
    applicableEquipmentRefs: opts?.applicableEquipmentRefs ?? [],
    sortOrder,
    helpText: opts?.helpText,
  };
}

/** ADAPT-A-LIFT unit numbers on Form 78 (6 forklifts, checked each shift). */
export const FORKLIFT_UNITS = [
  {
    value: "H20287",
    label: "H20287 — Low Mast (NZ, Non-Zoned)",
  },
  {
    value: "H57168",
    label: "H57168 — Low Mast (NZ, Non-Zoned)",
  },
  {
    value: "H57171",
    label: "H57171 — Rosin / Grab (Non-Zoned)",
  },
  {
    value: "H57170",
    label: "H57170 — High Mast (NZ, Non-Zoned)",
  },
  {
    value: "H15660",
    label: "H15660 — High Mast (Z, Zoned)",
  },
  {
    value: "H15659",
    label: "H15659 — Low Mast (Z, Zoned)",
  },
] as const;

/** Shared Form 78 checklist — questions live here; unit forms inherit them. */
export const FORKLIFT_DAILY_CHECK_TEMPLATE: InspectionDefinition = {
  id: "forklift-daily-check",
  slug: "forklift-daily-check",
  title: "Forklift — Daily Safety Check (master template)",
  shortName: "Forklift template",
  description:
    "Master checklist for all forklift unit forms. Edit questions here and they apply to every unit. Not shown to operators.",
  category: "Equipment",
  href: "/inspections/forklift-daily-check",
  sortOrder: 1,
  equipmentLabel: null,
  instructionNotes:
    "First operator of each shift must complete this check. All items must be Yes (or repaired before use). If faults are found or service is overdue, call ADAPT-A-LIFT on (03) 9547 8000 — report the unit number (e.g. H57168) and schedule service. Note defects in comments for the next shift and management.",
  isAvailable: false,
  questions: [
    radioQuestion(
      "forklift-daily-check",
      "shift",
      "Shift",
      "Shift details",
      ["Day", "Afternoon"],
      1,
      { attentionValues: [] },
    ),
    numberQuestion(
      "forklift-daily-check",
      "hour-meter",
      "Hour meter reading",
      "Shift details",
      2,
      { helpText: "Reading from the hour meter before start." },
    ),
    dateQuestion(
      "forklift-daily-check",
      "service-date",
      "Service date",
      "Before start",
      3,
      {
        helpText: "Date from the service sticker (as on Form 78).",
        showLastValue: true,
      },
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "fuel-level",
      "Fuel level",
      "Before start",
      4,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "engine-oil",
      "Engine oil level",
      "Before start",
      5,
      {
        required: false,
        helpText: "Skip if not applicable to this unit (shaded on paper form).",
      },
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "brake-fluid",
      "Brake fluid level",
      "Before start",
      6,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "wheel-nuts",
      "Wheel nuts / clamps",
      "Before start",
      7,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "tyres",
      "Tyre condition",
      "Before start",
      8,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "canopy-masts",
      "No cracks — canopy stays / masts",
      "Before start",
      9,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "lifting-capacity",
      "Lifting capacity",
      "Before start",
      10,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "seat-belt",
      "Seat belt",
      "Before start",
      11,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "physical-damage",
      "No physical damage",
      "Before start",
      12,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "hydraulic-oil",
      "Hydraulic oil",
      "Before start",
      13,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "scrubber-drained",
      "Scrubber drained",
      "Weekly (1st day shift of week)",
      14,
      {
        required: false,
        helpText: "Once per week on the first day shift only.",
      },
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "scrubber-washed",
      "Scrubber washed as per Chess",
      "Weekly (1st day shift of week)",
      15,
      {
        required: false,
        helpText: "Once per week on the first day shift only.",
      },
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "flameproofers",
      "Flameproofers mtce instruction",
      "Weekly (1st day shift of week)",
      16,
      {
        required: false,
        helpText: "Zoned units only; once per week on first day shift.",
      },
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "anode",
      "Anode condition",
      "Weekly (1st day shift of week)",
      17,
      {
        required: false,
        helpText: "Once per week on the first day shift only.",
      },
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "air-receiver",
      "Air receiver drained of water",
      "Weekly (1st day shift of week)",
      18,
      {
        required: false,
        helpText: "Once per week on the first day shift only.",
      },
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "windscreen",
      "Windscreen clean",
      "Before start",
      19,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "canopy-cover",
      "Canopy cover clean",
      "Before start",
      20,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "fire-extinguisher",
      "Fire extinguisher (date within 6 months)",
      "Before start",
      21,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "wipers",
      "Wiper blades and windscreen water tank",
      "Before start",
      22,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "danger-tag",
      "Forklift tagged out (DANGER TAG)",
      "Tagged out",
      23,
      {
        attentionValues: ["Yes"],
        helpText: "Select Yes only if the unit is tagged out and must not be used.",
      },
    ),
    textQuestion(
      "forklift-daily-check",
      "reported-to",
      "Reported immediately to",
      "Tagged out",
      24,
      {
        required: false,
        helpText: "If tagged out or a fault was reported.",
      },
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "footbrake",
      "Footbrake operation",
      "After start",
      25,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "handbrake",
      "Handbrake operation",
      "After start",
      26,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "steering",
      "Steering operation",
      "After start",
      27,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "hoist-tilt",
      "Hoist / tilt operation",
      "After start",
      28,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "rotary-sideshift",
      "Rotary / sideshift operation",
      "After start",
      29,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "horn-alarm",
      "Horn / reverse alarm",
      "After start",
      30,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "gauges",
      "Gauges & instruments",
      "After start",
      31,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "fluid-leaks",
      "No fluid leaks",
      "After start",
      32,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "lights-front",
      "Lights — front",
      "After start",
      33,
    ),
    yesNoQuestion(
      "forklift-daily-check",
      "coolant",
      "Engine coolant / water level ok",
      "After start",
      34,
    ),
  ],
};

/** @deprecated Prefer FORKLIFT_DAILY_CHECK_TEMPLATE — alias kept for tests. */
export const FORKLIFT_DAILY_CHECK = FORKLIFT_DAILY_CHECK_TEMPLATE;

function forkliftUnitForm(
  unit: (typeof FORKLIFT_UNITS)[number],
  sortOrder: number,
): InspectionDefinition {
  const id = `forklift-daily-check-${unit.value.toLowerCase()}`;
  return {
    id,
    slug: id,
    title: `Forklift ${unit.value} — Daily Safety Check`,
    shortName: `Forklift ${unit.value}`,
    description: `${unit.label}. Start-of-shift safety check before use (Form 78). Complete at the beginning of each shift (day and afternoon), Monday–Friday, outside restricted areas in a clear area away from people and other vehicles.`,
    category: "Equipment",
    href: `/inspections/${id}`,
    sortOrder,
    equipmentLabel: "Unit No.",
    templateInspectionId: FORKLIFT_DAILY_CHECK_TEMPLATE.id,
    fixedEquipmentRef: unit.value,
    instructionNotes: FORKLIFT_DAILY_CHECK_TEMPLATE.instructionNotes,
    isAvailable: true,
    questions: [],
  };
}

export const FORKLIFT_UNIT_FORMS: InspectionDefinition[] = FORKLIFT_UNITS.map(
  (unit, index) => forkliftUnitForm(unit, 2 + index),
);


export const DAILY_STARTUP: InspectionDefinition = {
  id: "daily-startup",
  slug: "daily-startup",
  title: "Daily Start-up",
  shortName: "Start-up",
  description:
    "Plant start-of-shift checks before production begins. Confirm the area is safe and ready.",
  category: "Shift",
  href: "/inspections/daily-startup",
  sortOrder: 10,
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
  sortOrder: 11,
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
  FORKLIFT_DAILY_CHECK_TEMPLATE,
  ...FORKLIFT_UNIT_FORMS,
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
  if (type === "TEXT" || type === "NUMBER" || type === "DATE") {
    return [];
  }
  return options.map((option) => option.trim()).filter(Boolean);
}

export function looksLikeAttentionOption(option: string): boolean {
  return /\b(needs?|fails?|no|attention|defects?)\b/i.test(option.trim());
}

export function defaultAttentionValues(
  type: InspectionQuestionType,
  options: string[],
): string[] {
  if (type === "YES_NO") {
    return [...DEFAULT_YES_NO_ATTENTION];
  }
  if (type === "RADIO") {
    return options.filter((option) => looksLikeAttentionOption(option));
  }
  return [];
}

export function questionTypeLabel(type: InspectionQuestionType): string {
  switch (type) {
    case "YES_NO":
      return "Yes / No";
    case "TEXT":
      return "Text";
    case "RADIO":
      return "Radio";
    case "NUMBER":
      return "Number";
    case "DATE":
      return "Date";
  }
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

/** Map questionId → non-empty answer from a prior inspection run. */
export function buildLastAnswerMap(
  answers: Array<Pick<InspectionAnswerRecord, "questionId" | "answer">>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of answers) {
    const questionId = String(item.questionId ?? "").trim();
    const answer = String(item.answer ?? "").trim();
    if (questionId && answer) {
      map[questionId] = answer;
    }
  }
  return map;
}

export type LastInspectionAnswers = {
  answers: Record<string, string>;
  runId: string | null;
  createdAt: string | null;
};

/** Human-readable last value for checklist display (esp. DATE). */
export function formatLastAnswerDisplay(
  value: string,
  type: InspectionQuestionType,
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (type === "DATE") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (match) {
      const date = new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
      );
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString("en-AU", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    }
  }
  return trimmed;
}


/** Empty applicableEquipmentRefs means the question applies to every unit. */
export function questionAppliesToEquipment(
  question: Pick<InspectionQuestionDef, "applicableEquipmentRefs">,
  equipmentRef: string | null | undefined,
): boolean {
  const refs = question.applicableEquipmentRefs ?? [];
  if (refs.length === 0) {
    return true;
  }
  const value = equipmentRef?.trim();
  if (!value) {
    return true;
  }
  return refs.includes(value);
}

export function filterQuestionsForEquipment(
  questions: InspectionQuestionDef[],
  equipmentRef: string | null | undefined,
): InspectionQuestionDef[] {
  return questions.filter((question) =>
    questionAppliesToEquipment(question, equipmentRef),
  );
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

/** Operator hub that lists every forklift unit form. */
export const FORKLIFT_INSPECTIONS_HREF = "/inspections/forklifts";

export const FORKLIFT_INSPECTIONS_CARD: InspectionCard = {
  id: "forklift-inspections",
  slug: "forklifts",
  title: "Forklift inspections",
  description:
    "Daily safety checks for each forklift unit (Form 78). Choose a unit to begin.",
  category: "Equipment",
  href: FORKLIFT_INSPECTIONS_HREF,
  isAvailable: true,
};

/** Per-unit forklift forms (not the shared master template). */
export function isForkliftUnitInspection(item: {
  id: string;
  slug?: string;
  fixedEquipmentRef?: string | null;
  templateInspectionId?: string | null;
}): boolean {
  if (item.templateInspectionId === FORKLIFT_DAILY_CHECK_TEMPLATE.id) {
    return true;
  }
  const key = `${item.id} ${item.slug ?? ""}`.toLowerCase();
  return /forklift-daily-check-[a-z0-9]/.test(key);
}

/**
 * Home / checklist catalog: collapse individual forklift units into one
 * "Forklift inspections" entry that opens the unit picker.
 */
export function buildHomeInspectionCatalog(
  inspections: InspectionCard[],
): InspectionCard[] {
  const available = inspections.filter((inspection) => inspection.isAvailable);
  const forkliftUnits = available.filter((inspection) =>
    isForkliftUnitInspection(inspection),
  );
  const others = available.filter(
    (inspection) => !isForkliftUnitInspection(inspection),
  );

  if (forkliftUnits.length === 0) {
    return others;
  }

  return [FORKLIFT_INSPECTIONS_CARD, ...others];
}
