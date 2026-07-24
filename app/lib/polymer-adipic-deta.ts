export const ADIPIC_BAG_COUNT = 4;
export const ADIPIC_BAG_MIN_KG = 950;
export const ADIPIC_BAG_MAX_KG = 1020;
export const DETA_LOAD_MAX_KG = 1000;
export const INITIAL_DETA_LOAD_FIELDS = 4;

export type PolymerAdipicDetaProduct = {
  id: string;
  slug: string;
  title: string;
  shortName: string;
  description: string;
  href: string;
  category: string;
  sortOrder: number;
  /** Mass parts for Adipic Acid in the process ratio. */
  adipicMassParts: number;
  /** Mass parts for DETA in the process ratio. */
  detaMassParts: number;
};

export const POLYMER_973: PolymerAdipicDetaProduct = {
  id: "polymer-973-adipic-deta",
  slug: "polymer-973-adipic-deta",
  title: "Polymer 973 — Adipic Acid:DETA Ratio",
  shortName: "Polymer 973",
  description:
    "After charging ~90% DETA and all Adipic Acid, calculate the extra DETA required.",
  href: "/calculations/polymer-973-adipic-deta",
  category: "polymer",
  sortOrder: 1,
  adipicMassParts: 4000,
  detaMassParts: 3195.2,
};

export const POLYMER_AN04: PolymerAdipicDetaProduct = {
  id: "polymer-an04-adipic-deta",
  slug: "polymer-an04-adipic-deta",
  title: "Polymer AN04 — Adipic Acid:DETA Ratio",
  shortName: "Polymer AN04",
  description:
    "After charging ~90% DETA and all Adipic Acid, calculate the extra DETA required.",
  href: "/calculations/polymer-an04-adipic-deta",
  category: "polymer",
  sortOrder: 2,
  adipicMassParts: 5500,
  detaMassParts: 3899,
};

export const POLYMER_ADIPIC_DETA_PRODUCTS = [POLYMER_973, POLYMER_AN04] as const;

export type PolymerAdipicDetaInputs = {
  detaChargedKg: number;
  adipicAcidKg: number;
};

export type PolymerAdipicDetaResult = {
  adipicAcidKg: number;
  detaChargedKg: number;
  targetDetaKg: number;
  extraDetaKg: number;
  massRatioLabel: string;
};

function roundKg(value: number): number {
  return Math.round(value);
}

export function getDetaPerAdipic(product: PolymerAdipicDetaProduct): number {
  return product.detaMassParts / product.adipicMassParts;
}

export function getAdipicToDetaMassRatio(
  product: PolymerAdipicDetaProduct,
): number {
  return product.adipicMassParts / product.detaMassParts;
}

/**
 * Make-up DETA calculator for Adipic Acid:DETA polymer batches.
 *
 * Plant flow:
 * 1. Charge ~90% of the DETA via drums/IBCs
 * 2. Charge Adipic Acid (4 pallets of bulk bags; weights vary)
 * 3. Enter both → calculate remaining DETA to hit the mass ratio
 */
export function calculatePolymerAdipicDetaExtra(
  product: PolymerAdipicDetaProduct,
  inputs: PolymerAdipicDetaInputs,
): PolymerAdipicDetaResult {
  const { detaChargedKg, adipicAcidKg } = inputs;

  if (!(adipicAcidKg > 0)) {
    throw new Error("Adipic Acid amount must be greater than zero.");
  }
  if (!(detaChargedKg >= 0)) {
    throw new Error("DETA charged cannot be negative.");
  }

  const detaPerAdipic = getDetaPerAdipic(product);
  const adipicToDetaRatio = getAdipicToDetaMassRatio(product);
  const targetDetaKg = adipicAcidKg * detaPerAdipic;
  const extraDetaKg = targetDetaKg - detaChargedKg;

  return {
    adipicAcidKg: roundKg(adipicAcidKg),
    detaChargedKg: roundKg(detaChargedKg),
    targetDetaKg: roundKg(targetDetaKg),
    extraDetaKg: roundKg(extraDetaKg),
    massRatioLabel: adipicToDetaRatio.toFixed(10),
  };
}

export function sumLoads(loads: Array<number | undefined | null>): number {
  return loads.reduce<number>((total, value) => total + (value ?? 0), 0);
}
