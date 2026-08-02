export const INSPECTION_QUESTION_TYPES = [
  "YES_NO",
  "TEXT",
  "RADIO",
  "NUMBER",
  "DATE",
  "TIME",
  "CHECKBOX",
] as const;

export type InspectionQuestionType = (typeof INSPECTION_QUESTION_TYPES)[number];

/** Common shift labels used on forklift (and similar) forms. */
export const INSPECTION_SHIFT_OPTIONS = ["Day", "Afternoon"] as const;

/** Hazard-control answers on Safe Work Permit (Form 42801). */
export const IN_PLACE_OPTIONS = ["In place", "Not required"] as const;

/** Electrical hazard answers on Safe Work Permit (Form 42801). */
export const YES_NA_OPTIONS = ["Yes", "N/A"] as const;

/** Category for work permits (separate from equipment / shift checklists). */
export const PERMIT_CATEGORY = "Permits";

/** Joiner for multi-select CHECKBOX answers stored as a single string. */
export const CHECKBOX_ANSWER_SEPARATOR = "|";

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
  /**
   * Shift labels this question applies to (e.g. Day only).
   * Empty means every shift.
   */
  applicableShifts: string[];
  /**
   * When true, only show on the first matching inspection of the week
   * (week starts Monday after Sunday, Australia/Melbourne).
   */
  firstOfWeekOnly: boolean;
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
    applicableShifts: [],
    firstOfWeekOnly: false,
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
    applicableShifts?: string[];
    firstOfWeekOnly?: boolean;
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
    applicableShifts: opts?.applicableShifts ?? [],
    firstOfWeekOnly: opts?.firstOfWeekOnly ?? false,
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
    applicableShifts?: string[];
    firstOfWeekOnly?: boolean;
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
    applicableShifts: opts?.applicableShifts ?? [],
    firstOfWeekOnly: opts?.firstOfWeekOnly ?? false,
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
    applicableShifts?: string[];
    firstOfWeekOnly?: boolean;
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
    applicableShifts: opts?.applicableShifts ?? [],
    firstOfWeekOnly: opts?.firstOfWeekOnly ?? false,
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
    applicableShifts?: string[];
    firstOfWeekOnly?: boolean;
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
    applicableShifts: opts?.applicableShifts ?? [],
    firstOfWeekOnly: opts?.firstOfWeekOnly ?? false,
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
    applicableShifts?: string[];
    firstOfWeekOnly?: boolean;
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
    applicableShifts: opts?.applicableShifts ?? [],
    firstOfWeekOnly: opts?.firstOfWeekOnly ?? false,
    sortOrder,
    helpText: opts?.helpText,
  };
}

function timeQuestion(
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
    applicableShifts?: string[];
    firstOfWeekOnly?: boolean;
  },
): InspectionQuestionDef {
  return {
    id: `${inspectionId}__${id}`,
    label,
    sectionTitle,
    type: "TIME",
    options: [],
    attentionValues: [],
    required: opts?.required ?? true,
    showLastValue: opts?.showLastValue ?? false,
    applicableEquipmentRefs: opts?.applicableEquipmentRefs ?? [],
    applicableShifts: opts?.applicableShifts ?? [],
    firstOfWeekOnly: opts?.firstOfWeekOnly ?? false,
    sortOrder,
    helpText: opts?.helpText,
  };
}

function checkboxQuestion(
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
    applicableShifts?: string[];
    firstOfWeekOnly?: boolean;
  },
): InspectionQuestionDef {
  return {
    id: `${inspectionId}__${id}`,
    label,
    sectionTitle,
    type: "CHECKBOX",
    options,
    attentionValues: opts?.attentionValues ?? [],
    required: opts?.required ?? false,
    showLastValue: opts?.showLastValue ?? false,
    applicableEquipmentRefs: opts?.applicableEquipmentRefs ?? [],
    applicableShifts: opts?.applicableShifts ?? [],
    firstOfWeekOnly: opts?.firstOfWeekOnly ?? false,
    sortOrder,
    helpText: opts?.helpText,
  };
}

export function parseCheckboxAnswer(answer: string): string[] {
  if (!answer.trim()) {
    return [];
  }
  return answer
    .split(CHECKBOX_ANSWER_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeCheckboxAnswer(values: string[]): string {
  return values
    .map((item) => item.trim())
    .filter(Boolean)
    .join(CHECKBOX_ANSWER_SEPARATOR);
}

export function questionTypeStoresOptions(
  type: InspectionQuestionType,
): boolean {
  return type === "RADIO" || type === "CHECKBOX";
}

export function isPermitInspection(item: {
  category?: string | null;
}): boolean {
  return (item.category ?? "").trim().toLowerCase() === "permits";
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
        required: true,
        applicableShifts: ["Day"],
        firstOfWeekOnly: true,
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
        required: true,
        applicableShifts: ["Day"],
        firstOfWeekOnly: true,
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
        required: true,
        applicableShifts: ["Day"],
        firstOfWeekOnly: true,
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
        required: true,
        applicableShifts: ["Day"],
        firstOfWeekOnly: true,
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
        required: true,
        applicableShifts: ["Day"],
        firstOfWeekOnly: true,
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

/** Form 42801 — Safe Work Permit (hazard control + PPE). */
export const SAFE_WORK_PERMIT: InspectionDefinition = {
  id: "safe-work-permit",
  slug: "safe-work-permit",
  title: "Safe Work Permit",
  shortName: "Safe Work",
  description:
    "Form 42801 safe work permit for non-routine work: confirm hazard controls and PPE, then obtain Operations, Maintenance, and Safe Work Coordinator authorisation before work starts.",
  category: PERMIT_CATEGORY,
  href: "/permits/safe-work-permit",
  sortOrder: 20,
  equipmentLabel: "Equipment number",
  instructionNotes:
    "Form 42801 (09/14). Safe Work Permits authorise technicians, contractors, and visitors for non-routine work in process areas. SWP does not replace Hot Work, Confined Space Entry, or Line Break permits — complete those separately when required. Maximum duration is 12 hours if conditions and personnel do not change. Approvers must visually inspect the job site before signing. A minimum of two separate people must sign unless no other employees are available (document the reason). Close out with date, time, and operator/maintenance initials when work is finished. Retain closed permits for at least one year.",
  isAvailable: true,
  questions: [
    dateQuestion(
      "safe-work-permit",
      "date",
      "Date",
      "Permit details",
      1,
    ),
    textQuestion(
      "safe-work-permit",
      "permit-duration",
      "Permit duration",
      "Permit details",
      2,
      {
        helpText:
          "Maximum 12 hours. Conditions and authorised personnel must not change during this period.",
      },
    ),
    timeQuestion(
      "safe-work-permit",
      "start-time",
      "Start time",
      "Permit details",
      3,
      { helpText: "24-hour clock (e.g. 07:30). Permit must be approved before work begins." },
    ),
    timeQuestion(
      "safe-work-permit",
      "end-time",
      "End time",
      "Permit details",
      4,
      {
        helpText:
          "24-hour clock (e.g. 15:30). Must be within 12 hours of start time.",
      },
    ),
    textQuestion(
      "safe-work-permit",
      "area",
      "Area",
      "Permit details",
      5,
    ),
    textQuestion(
      "safe-work-permit",
      "work-to-be-performed",
      "Work to be performed",
      "Work details",
      6,
    ),
    textQuestion(
      "safe-work-permit",
      "last-contained",
      "Equipment or piping last contained",
      "Work details",
      7,
      {
        required: false,
        helpText: "What the equipment or piping last contained, if known.",
      },
    ),
    radioQuestion(
      "safe-work-permit",
      "work-classification",
      "Work classification",
      "Work classification",
      ["Routine work", "Non-routine work"],
      8,
      { attentionValues: [] },
    ),
    radioQuestion(
      "safe-work-permit",
      "hazard-cleared",
      "1. Has line and/or equipment been cleared of material and any residual pressure?",
      "Hazard control steps",
      [...IN_PLACE_OPTIONS],
      9,
      { attentionValues: [] },
    ),
    radioQuestion(
      "safe-work-permit",
      "hazard-decontaminated",
      "2. Has line and/or equipment been decontaminated (steamed, washed, neutralized etc.)?",
      "Hazard control steps",
      [...IN_PLACE_OPTIONS],
      10,
      { attentionValues: [] },
    ),
    radioQuestion(
      "safe-work-permit",
      "hazard-locked-out",
      "3. Has system been locked out to prevent release of any energy source (run-lock-try)?",
      "Hazard control steps",
      [...IN_PLACE_OPTIONS],
      11,
      { attentionValues: [] },
    ),
    radioQuestion(
      "safe-work-permit",
      "hazard-multiple-energy",
      "4. Are multiple energy sources involved with lockout (if Yes complete lockout procedure form)?",
      "Hazard control steps",
      [...IN_PLACE_OPTIONS],
      12,
      { attentionValues: [] },
    ),
    radioQuestion(
      "safe-work-permit",
      "hazard-lock-box",
      "5. Is a LOCK-BOX being used for this work?",
      "Hazard control steps",
      [...IN_PLACE_OPTIONS],
      13,
      { attentionValues: [] },
    ),
    textQuestion(
      "safe-work-permit",
      "lock-box-no",
      "Lock-box number",
      "Hazard control steps",
      14,
      {
        required: false,
        helpText: "Required when a lock-box is in place.",
      },
    ),
    radioQuestion(
      "safe-work-permit",
      "hazard-check-valves",
      "6. Are check valves in system that prevent proper bleeding off of residual energy?",
      "Hazard control steps",
      [...IN_PLACE_OPTIONS],
      15,
      { attentionValues: [] },
    ),
    radioQuestion(
      "safe-work-permit",
      "hazard-safety-shower",
      "7. Are nearest safety shower / eyewash stations identified and operational?",
      "Hazard control steps",
      [...IN_PLACE_OPTIONS],
      16,
      { attentionValues: [] },
    ),
    radioQuestion(
      "safe-work-permit",
      "hazard-confined-space",
      "8. Is a CONFINED SPACE ENTRY PERMIT required for this work? (If Yes, complete Confined Space Permit)",
      "Hazard control steps",
      [...IN_PLACE_OPTIONS],
      17,
      { attentionValues: [] },
    ),
    radioQuestion(
      "safe-work-permit",
      "hazard-hot-work",
      "9. Is a HOT WORK PERMIT required for this work? (If Yes, complete Hot Work Permit)",
      "Hazard control steps",
      [...IN_PLACE_OPTIONS],
      18,
      { attentionValues: [] },
    ),
    radioQuestion(
      "safe-work-permit",
      "hazard-line-break",
      "10. Is a LINE BREAK PERMIT required for this work? (If Yes, complete Line Break Permit)",
      "Hazard control steps",
      [...IN_PLACE_OPTIONS],
      19,
      { attentionValues: [] },
    ),
    radioQuestion(
      "safe-work-permit",
      "hazard-non-routine-plan",
      "11. Has Non-Routine work plan been developed for performing this work?",
      "Hazard control steps",
      [...IN_PLACE_OPTIONS],
      20,
      { attentionValues: [] },
    ),
    radioQuestion(
      "safe-work-permit",
      "hazard-ladder-scaffold",
      "12. Will work require use of a ladder, scaffolding, or man lift?",
      "Hazard control steps",
      [...IN_PLACE_OPTIONS],
      21,
      { attentionValues: [] },
    ),
    radioQuestion(
      "safe-work-permit",
      "hazard-fall-protection",
      "13. Will work require fall protection (> 4 ft / 1.2 meters elevation)?",
      "Hazard control steps",
      [...IN_PLACE_OPTIONS],
      22,
      { attentionValues: [] },
    ),
    radioQuestion(
      "safe-work-permit",
      "hazard-roof-access",
      "14. Will work be performed on an unprotected roof or structure (complete roof access permit)?",
      "Hazard control steps",
      [...IN_PLACE_OPTIONS],
      23,
      { attentionValues: [] },
    ),
    checkboxQuestion(
      "safe-work-permit",
      "required-ppe",
      "Required PPE above standard PPE (hard hat, safety shoes, safety glasses)",
      "Required PPE",
      [
        "Face shield",
        "Leather gloves",
        "Cartridge respirator",
        "Rain jacket",
        "Goggles",
        "Chemical gloves",
        "Air-line respirator (w/escape pack)",
        "Rain pants/bibs",
        "Welding/cutting shield",
        "Chemical boots/covers",
        "SCBA",
        "Chemical suit",
        "Chemical face shield",
        "Full body harness",
        "Double lanyard",
      ],
      24,
      {
        required: false,
        helpText: "Select all additional PPE required for this job.",
      },
    ),
    textQuestion(
      "safe-work-permit",
      "ppe-other",
      "Other PPE (specify)",
      "Required PPE",
      25,
      {
        required: false,
        helpText: "List any additional PPE not shown above.",
      },
    ),
    radioQuestion(
      "safe-work-permit",
      "elec-qualified",
      "1. Will work be performed by qualified electrical personnel?",
      "Electrical hazard control",
      [...YES_NA_OPTIONS],
      26,
      { attentionValues: [] },
    ),
    radioQuestion(
      "safe-work-permit",
      "elec-live",
      "2. Will work be performed on or near live electrical circuits or components?",
      "Electrical hazard control",
      [...YES_NA_OPTIONS],
      27,
      {
        attentionValues: [],
        helpText: "If Yes, ensure a work plan is in place with required PPE.",
      },
    ),
    radioQuestion(
      "safe-work-permit",
      "elec-deenergized-isolation",
      "3. If work will be performed on a de-energized circuit, have proper isolation and lock out procedures been followed including testing of equipment to verify it has been de-energized?",
      "Electrical hazard control",
      [...YES_NA_OPTIONS],
      28,
      { attentionValues: [] },
    ),
    radioQuestion(
      "safe-work-permit",
      "elec-high-voltage",
      "4. Will work be performed on de-energized electrical circuit or equipment which operates at greater than 1,000 volts?",
      "Electrical hazard control",
      [...YES_NA_OPTIONS],
      29,
      {
        attentionValues: [],
        helpText: "If Yes, ensure a work plan is in place with required PPE.",
      },
    ),
    textQuestion(
      "safe-work-permit",
      "special-precautions",
      "Special precautions",
      "Special precautions",
      30,
      { required: false },
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
  SAFE_WORK_PERMIT,
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
  if (type === "TEXT" || type === "NUMBER" || type === "DATE" || type === "TIME") {
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
    case "TIME":
      return "Time";
    case "CHECKBOX":
      return "Checkboxes";
  }
}

export function isAnswerFlagged(
  question: Pick<InspectionQuestionDef, "attentionValues" | "type">,
  answer: string,
): boolean {
  if (!answer.trim() || question.attentionValues.length === 0) {
    return false;
  }
  if (question.type === "CHECKBOX") {
    return parseCheckboxAnswer(answer).some((value) =>
      question.attentionValues.includes(value),
    );
  }
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
  if (type === "CHECKBOX") {
    return parseCheckboxAnswer(trimmed).join(", ");
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

/** Empty applicableShifts means the question applies to every shift. */
export function questionAppliesToShift(
  question: Pick<InspectionQuestionDef, "applicableShifts">,
  shift: string | null | undefined,
): boolean {
  const shifts = Array.isArray(question.applicableShifts)
    ? question.applicableShifts
    : [];
  if (shifts.length === 0) {
    return true;
  }
  const value = shift?.trim();
  if (!value) {
    return false;
  }
  return shifts.includes(value);
}

export function questionAppliesToWeek(
  question: Pick<InspectionQuestionDef, "firstOfWeekOnly">,
  isFirstInspectionOfWeek: boolean,
): boolean {
  if (!question.firstOfWeekOnly) {
    return true;
  }
  return isFirstInspectionOfWeek;
}

export type QuestionApplicabilityContext = {
  shift?: string | null;
  isFirstInspectionOfWeek?: boolean;
};

/** Shift + first-of-week filters (equipment filtering is applied separately). */
export function questionAppliesToContext(
  question: Pick<
    InspectionQuestionDef,
    "applicableShifts" | "firstOfWeekOnly"
  >,
  context: QuestionApplicabilityContext = {},
): boolean {
  return (
    questionAppliesToShift(question, context.shift) &&
    questionAppliesToWeek(question, context.isFirstInspectionOfWeek ?? true)
  );
}

export function filterQuestionsForContext(
  questions: InspectionQuestionDef[],
  context: QuestionApplicabilityContext = {},
): InspectionQuestionDef[] {
  return questions.filter((question) =>
    questionAppliesToContext(question, context),
  );
}

/** Prefer the dedicated Shift radio; fall back to Day/Afternoon options. */
export function findShiftQuestion(
  questions: Array<
    Pick<InspectionQuestionDef, "id" | "label" | "type" | "options">
  >,
): { id: string; options: string[] } | null {
  const byId = questions.find(
    (question) =>
      question.type === "RADIO" &&
      (question.id.endsWith("__shift") ||
        question.id.toLowerCase().endsWith("-shift")),
  );
  if (byId) {
    return { id: byId.id, options: byId.options };
  }

  const byLabel = questions.find(
    (question) =>
      question.type === "RADIO" &&
      question.label.trim().toLowerCase() === "shift" &&
      question.options.some((option) =>
        INSPECTION_SHIFT_OPTIONS.includes(
          option as (typeof INSPECTION_SHIFT_OPTIONS)[number],
        ),
      ),
  );
  if (byLabel) {
    return { id: byLabel.id, options: byLabel.options };
  }

  return null;
}

export function readShiftAnswer(
  questions: Array<
    Pick<InspectionQuestionDef, "id" | "label" | "type" | "options">
  >,
  responses: Record<string, string | undefined | null>,
): string | null {
  const shiftQuestion = findShiftQuestion(questions);
  if (!shiftQuestion) {
    return null;
  }
  const value = String(responses[shiftQuestion.id] ?? "").trim();
  return value || null;
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
 * "Forklift inspections" entry that opens the unit picker. Permit forms are
 * listed on /permits instead.
 */
export function buildHomeInspectionCatalog(
  inspections: InspectionCard[],
): InspectionCard[] {
  const available = inspections.filter(
    (inspection) =>
      inspection.isAvailable && !isPermitInspection(inspection),
  );
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

/** Operator hub catalog for work permits (Safe Work, Hot Work, etc.). */
export function buildPermitCatalog(
  inspections: InspectionCard[],
): InspectionCard[] {
  return inspections.filter(
    (inspection) =>
      inspection.isAvailable && isPermitInspection(inspection),
  );
}

/** Fallback permit cards when Supabase is not configured yet. */
export const FALLBACK_PERMITS: InspectionCard[] = FALLBACK_INSPECTIONS.filter(
  (inspection) => isPermitInspection(inspection),
);
