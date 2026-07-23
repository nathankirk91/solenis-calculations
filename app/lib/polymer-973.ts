/** Process mass ratio: Adipic Acid : DETA = 4000 : 3195.2 */
export const ADIPIC_MASS_PARTS = 4000;
export const DETA_MASS_PARTS = 3195.2;

/** kg DETA required per kg Adipic Acid */
export const DETA_PER_ADIPIC =
  DETA_MASS_PARTS / ADIPIC_MASS_PARTS;

export type Polymer973Inputs = {
  /** DETA already charged (typically ~90% of target). */
  detaChargedKg: number;
  /** Actual Adipic Acid charged (varies with bulk bags). */
  adipicAcidKg: number;
};

export type Polymer973Result = {
  adipicAcidKg: number;
  detaChargedKg: number;
  targetDetaKg: number;
  extraDetaKg: number;
  massRatioLabel: string;
};

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Polymer 973 make-up DETA calculator.
 *
 * Plant flow:
 * 1. Charge ~90% of the DETA
 * 2. Charge all Adipic Acid for the batch (bulk-bag actual mass)
 * 3. Enter both amounts → calculate remaining DETA to hit the mass ratio
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
    adipicAcidKg: round(adipicAcidKg),
    detaChargedKg: round(detaChargedKg),
    targetDetaKg: round(targetDetaKg),
    extraDetaKg: round(extraDetaKg),
    massRatioLabel: `${ADIPIC_MASS_PARTS} : ${DETA_MASS_PARTS}`,
  };
}
