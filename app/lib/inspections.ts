export type InspectionItemResult = "ok" | "attention" | "na";

export type InspectionChecklistItem = {
  id: string;
  label: string;
  help?: string;
};

export type InspectionSection = {
  id: string;
  title: string;
  items: InspectionChecklistItem[];
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
  /** Optional free-text field, e.g. forklift ID / unit number. */
  equipmentLabel?: string;
  sections: InspectionSection[];
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

export type InspectionResponseRow = {
  itemId: string;
  label: string;
  sectionTitle: string;
  result: InspectionItemResult;
};

export type InspectionSummary = {
  okCount: number;
  attentionCount: number;
  naCount: number;
  totalChecked: number;
  status: "PASSED" | "NEEDS_ATTENTION";
  attentionItems: Array<{ itemId: string; label: string; sectionTitle: string }>;
};

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
  sections: [
    {
      id: "pre-start",
      title: "Pre-start visual",
      items: [
        {
          id: "tyres",
          label: "Tyres / wheels — condition, pressure, debris",
        },
        {
          id: "forks-mast",
          label: "Forks, mast, chains, and carriage — no damage or slack",
        },
        {
          id: "hydraulics",
          label: "Hydraulics — no leaks under mast or cylinders",
        },
        {
          id: "body-damage",
          label: "Body / overhead guard — no new damage",
        },
        {
          id: "capacity-plate",
          label: "Load capacity plate readable and fitted",
        },
      ],
    },
    {
      id: "controls",
      title: "Controls & safety devices",
      items: [
        {
          id: "horn-lights",
          label: "Horn, lights, and reverse beeper working",
        },
        {
          id: "seat-belt",
          label: "Seat belt / operator restraint functional",
        },
        {
          id: "brakes",
          label: "Service and parking brakes effective",
        },
        {
          id: "steering",
          label: "Steering smooth with no excessive play",
        },
        {
          id: "fluids-fuel",
          label: "Fluids / battery / fuel or LPG adequate",
        },
      ],
    },
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
  sections: [
    {
      id: "people-area",
      title: "People & area",
      items: [
        {
          id: "ppe",
          label: "Required PPE available and worn",
        },
        {
          id: "walkways",
          label: "Walkways clear; housekeeping acceptable",
        },
        {
          id: "lighting",
          label: "Area lighting adequate for the work",
        },
        {
          id: "handover",
          label: "Previous shift handover notes reviewed",
        },
      ],
    },
    {
      id: "safety-plant",
      title: "Safety & plant readiness",
      items: [
        {
          id: "e-stops",
          label: "Emergency stops accessible and unobstructed",
        },
        {
          id: "utilities",
          label: "Utilities (power, water, air) available as needed",
        },
        {
          id: "spill-kits",
          label: "Spill kits and safety showers accessible",
        },
        {
          id: "materials",
          label: "Materials / chemicals available for planned work",
        },
        {
          id: "waste",
          label: "Waste containers not overflowing",
        },
      ],
    },
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
  sections: [
    {
      id: "equipment",
      title: "Equipment & process",
      items: [
        {
          id: "powered-down",
          label: "Equipment powered down / isolated as required",
        },
        {
          id: "vessels",
          label: "Vessels / tanks secured for the next shift",
        },
        {
          id: "alarms",
          label: "Alarms acknowledged; system status checked",
        },
        {
          id: "handover-notes",
          label: "Handover notes completed for the next shift",
        },
      ],
    },
    {
      id: "housekeeping",
      title: "Housekeeping & security",
      items: [
        {
          id: "tools",
          label: "Tools returned and stored",
        },
        {
          id: "spills",
          label: "Spillages cleaned; floors left safe",
        },
        {
          id: "waste-closed",
          label: "Waste segregated and containers closed",
        },
        {
          id: "doors",
          label: "Doors / gates secured as required",
        },
        {
          id: "area-tidy",
          label: "Area left tidy and safe",
        },
      ],
    },
  ],
};

export const INSPECTION_DEFINITIONS: InspectionDefinition[] = [
  FORKLIFT_DAILY_CHECK,
  DAILY_STARTUP,
  DAILY_SHUTDOWN,
];

export function getInspectionById(
  id: string,
): InspectionDefinition | undefined {
  return INSPECTION_DEFINITIONS.find((inspection) => inspection.id === id);
}

export function listInspectionItems(
  definition: InspectionDefinition,
): Array<InspectionChecklistItem & { sectionTitle: string }> {
  return definition.sections.flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      sectionTitle: section.title,
    })),
  );
}

export function summarizeInspectionResponses(
  definition: InspectionDefinition,
  responses: Record<string, InspectionItemResult>,
): InspectionSummary {
  const items = listInspectionItems(definition);
  let okCount = 0;
  let attentionCount = 0;
  let naCount = 0;
  const attentionItems: InspectionSummary["attentionItems"] = [];

  for (const item of items) {
    const result = responses[item.id];
    if (result === "ok") {
      okCount += 1;
    } else if (result === "attention") {
      attentionCount += 1;
      attentionItems.push({
        itemId: item.id,
        label: item.label,
        sectionTitle: item.sectionTitle,
      });
    } else if (result === "na") {
      naCount += 1;
    }
  }

  return {
    okCount,
    attentionCount,
    naCount,
    totalChecked: okCount + attentionCount + naCount,
    status: attentionCount > 0 ? "NEEDS_ATTENTION" : "PASSED",
    attentionItems,
  };
}

export function buildInspectionResponseRows(
  definition: InspectionDefinition,
  responses: Record<string, InspectionItemResult>,
): InspectionResponseRow[] {
  return listInspectionItems(definition).map((item) => ({
    itemId: item.id,
    label: item.label,
    sectionTitle: item.sectionTitle,
    result: responses[item.id] ?? "na",
  }));
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
    isAvailable: true,
  }));
