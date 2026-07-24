/** @deprecated Prefer ~/lib/polymer-adipic-deta — kept for existing imports/tests. */
export {
  ADIPIC_BAG_COUNT,
  ADIPIC_BAG_MAX_KG,
  ADIPIC_BAG_MIN_KG,
  DETA_LOAD_MAX_KG,
  INITIAL_DETA_LOAD_FIELDS,
  POLYMER_973,
  calculatePolymerAdipicDetaExtra as calculatePolymer973ExtraDeta,
  getAdipicToDetaMassRatio,
  getDetaPerAdipic,
  sumLoads,
  type PolymerAdipicDetaInputs as Polymer973Inputs,
  type PolymerAdipicDetaResult as Polymer973Result,
} from "~/lib/polymer-adipic-deta";

import { POLYMER_973, getAdipicToDetaMassRatio, getDetaPerAdipic } from "~/lib/polymer-adipic-deta";

export const ADIPIC_MASS_PARTS = POLYMER_973.adipicMassParts;
export const DETA_MASS_PARTS = POLYMER_973.detaMassParts;
export const DETA_PER_ADIPIC = getDetaPerAdipic(POLYMER_973);
export const ADIPIC_TO_DETA_MASS_RATIO = getAdipicToDetaMassRatio(POLYMER_973);
