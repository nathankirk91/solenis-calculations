import { z } from "zod";

import {
  ADIPIC_BAG_COUNT,
  ADIPIC_BAG_MAX_KG,
  ADIPIC_BAG_MIN_KG,
  DETA_LOAD_MAX_KG,
  sumLoads,
} from "~/lib/polymer-973";

function emptyToUndefined(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}

const detaLoadField = z.preprocess(
  emptyToUndefined,
  z
    .number({ error: "Enter a valid DETA load (kg)." })
    .nonnegative("DETA load cannot be negative.")
    .max(DETA_LOAD_MAX_KG, `Max ${DETA_LOAD_MAX_KG} kg per pallet/load.`)
    .optional(),
);

const adipicBagField = z
  .number({ error: "Enter the Adipic Acid pallet weight (kg)." })
  .min(ADIPIC_BAG_MIN_KG, `Min ${ADIPIC_BAG_MIN_KG} kg.`)
  .max(ADIPIC_BAG_MAX_KG, `Max ${ADIPIC_BAG_MAX_KG} kg.`);

export const polymer973Schema = z
  .object({
    detaLoads: z.array(detaLoadField).min(1, "Add at least one DETA load."),
    adipicBags: z
      .array(adipicBagField)
      .length(
        ADIPIC_BAG_COUNT,
        `Enter all ${ADIPIC_BAG_COUNT} Adipic Acid pallet weights.`,
      ),
  })
  .transform((value) => {
    const detaLoads = value.detaLoads.map((load) => load ?? 0);
    const adipicBags = value.adipicBags;
    const detaChargedKg = sumLoads(detaLoads);
    const adipicAcidKg = sumLoads(adipicBags);

    return {
      detaLoads,
      adipicBags,
      detaChargedKg,
      adipicAcidKg,
    };
  })
  .refine((value) => value.adipicAcidKg > 0, {
    message: "Adipic Acid total must be greater than zero.",
    path: ["adipicBags"],
  });

export type Polymer973FormValues = z.infer<typeof polymer973Schema>;
