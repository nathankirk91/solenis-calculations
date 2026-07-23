export type CalculationCard = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  href: string;
  isAvailable: boolean;
};

/** Fallback catalog used when Supabase is not configured yet. */
export const FALLBACK_CALCULATIONS: CalculationCard[] = [
  {
    id: "polymer-973-adipic-deta",
    slug: "polymer-973-adipic-deta",
    title: "Polymer 973 — Adipic Acid:DETA Ratio",
    description:
      "Calculate Adipic Acid and DETA charges from a batch size or either reactant mass.",
    category: "Polymer",
    href: "/calculations/polymer-973-adipic-deta",
    isAvailable: true,
  },
];
