/** Process mass ratio: Adipic Acid : DETA = 4000 : 3195.2 */
export const ADIPIC_MASS_PARTS = 4000;
export const DETA_MASS_PARTS = 3195.2;

/** kg DETA required per kg Adipic Acid */
export const DETA_PER_ADIPIC = DETA_MASS_PARTS / ADIPIC_MASS_PARTS;

/** Adipic:DETA mass ratio as a single number (4000 / 3195.2). */
export const ADIPIC_TO_DETA_MASS_RATIO = ADIPIC_MASS_PARTS / DETA_MASS_PARTS;

export const ADIPIC_BAG_COUNT = 4;
export const ADIPIC_BAG_MIN_KG = 950;
export const ADIPIC_BAG_MAX_KG = 1020;
export const DETA_LOAD_MAX_KG = 1000;
export const INITIAL_DETA_LOAD_FIELDS = 4;

export type Polymer973Inputs = {
  /** DETA already charged (sum of drum/IBC pallet loads). */
  detaChargedKg: number;
  /** Actual Adipic Acid charged (sum of bulk-bag / pallet weights). */
  adipicAcidKg: number;
};

export type Polymer973Result = {
  adipicAcidKg: number;
  detaChargedKg: number;
  targetDetaKg: number;
  extraDetaKg: number;
  massRatioLabel: string;
};

function roundKg(value: number): number {
  return Math.round(value);
}

/**
 * Polymer 973 make-up DETA calculator.
 *
 * Plant flow:
 * 1. Charge ~90% of the DETA via drums/IBCs
 * 2. Charge Adipic Acid (4 pallets of bulk bags; weights vary)
 * 3. Enter both → calculate remaining DETA to hit the mass ratio
 */
export function calculatePolymer973ExtraDeta(
  inputs: Polymer973Inputs,
): Polymer973Result {
  const { detaChargedKg, adipicAcidKg } = inputs;

  if (!(adipicAcidKg > 0)) {
    throw new Error("Adipic Acid amount must be greater than zero.");
  }
  if (!(detaChargedKg >= 0)) {
    throw new Error("DETA charged cannot be negative.");
  }

  const targetDetaKg = adipicAcidKg * DETA_PER_ADIPIC;
  const extraDetaKg = targetDetaKg - detaChargedKg;

  return {
    adipicAcidKg: roundKg(adipicAcidKg),
    detaChargedKg: roundKg(detaChargedKg),
    targetDetaKg: roundKg(targetDetaKg),
    extraDetaKg: roundKg(extraDetaKg),
    massRatioLabel: ADIPIC_TO_DETA_MASS_RATIO.toFixed(10),
  };
}

export function sumLoads(loads: Array<number | undefined | null>): number {
  return loads.reduce<number>((total, value) => total + (value ?? 0), 0);
}
