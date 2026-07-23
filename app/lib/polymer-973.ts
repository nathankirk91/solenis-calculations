/** Molecular weights (g/mol) for Polymer 973 reactants. */
export const ADIPIC_ACID_MW = 146.14;
export const DETA_MW = 103.17;

/** Default process target: 1.0 mol Adipic Acid : 1.0 mol DETA. */
export const DEFAULT_MOLAR_RATIO = 1;

export type ChargeBasis = "adipic" | "deta" | "total";

export type Polymer973Inputs = {
  basis: ChargeBasis;
  amountKg: number;
  /** Moles of Adipic Acid per mole of DETA. */
  molarRatio: number;
};

export type Polymer973Result = {
  adipicAcidKg: number;
  detaKg: number;
  totalKg: number;
  massRatioAdipicToDeta: number;
  molarRatioAdipicToDeta: number;
  adipicAcidKmol: number;
  detaKmol: number;
};

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Polymer 973 Adipic Acid : DETA charge calculator.
 *
 * Uses the target molar ratio (Adipic / DETA) and reactant molecular weights
 * to convert a known Adipic Acid charge, DETA charge, or total reactant mass
 * into the paired plant charges.
 */
export function calculatePolymer973Charges(
  inputs: Polymer973Inputs,
): Polymer973Result {
  const { basis, amountKg, molarRatio } = inputs;

  if (!(amountKg > 0)) {
    throw new Error("Amount must be greater than zero.");
  }
  if (!(molarRatio > 0)) {
    throw new Error("Molar ratio must be greater than zero.");
  }

  // Mass of Adipic Acid required per kg of DETA at the target molar ratio.
  const adipicPerDetaKg =
    (molarRatio * ADIPIC_ACID_MW) / DETA_MW;

  let adipicAcidKg: number;
  let detaKg: number;

  switch (basis) {
    case "adipic":
      adipicAcidKg = amountKg;
      detaKg = amountKg / adipicPerDetaKg;
      break;
    case "deta":
      detaKg = amountKg;
      adipicAcidKg = amountKg * adipicPerDetaKg;
      break;
    case "total":
      detaKg = amountKg / (1 + adipicPerDetaKg);
      adipicAcidKg = amountKg - detaKg;
      break;
    default: {
      const _exhaustive: never = basis;
      throw new Error(`Unsupported basis: ${_exhaustive}`);
    }
  }

  const adipicAcidKmol = adipicAcidKg / ADIPIC_ACID_MW;
  const detaKmol = detaKg / DETA_MW;

  return {
    adipicAcidKg: round(adipicAcidKg),
    detaKg: round(detaKg),
    totalKg: round(adipicAcidKg + detaKg),
    massRatioAdipicToDeta: round(adipicAcidKg / detaKg, 4),
    molarRatioAdipicToDeta: round(adipicAcidKmol / detaKmol, 4),
    adipicAcidKmol: round(adipicAcidKmol, 4),
    detaKmol: round(detaKmol, 4),
  };
}
