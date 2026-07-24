import { z } from "zod";

import {
  DETA_LOAD_MAX_KG,
  POLYMER_973,
  sumLoads,
  type PolymerAdipicDetaProduct,
} from "~/lib/polymer-adipic-deta";

function emptyToUndefined(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}

export function createPolymerAdipicDetaSchema(
  product: PolymerAdipicDetaProduct,
) {
  const detaLoadField = z.preprocess(
    emptyToUndefined,
    z
      .number({ error: "Enter a valid DETA load (kg)." })
      .nonnegative("DETA load cannot be negative.")
      .max(DETA_LOAD_MAX_KG, `Max ${DETA_LOAD_MAX_KG} kg per pallet/load.`)
      .optional(),
  );

  let adipicBagField = z.number({
    error: "Enter the Adipic Acid weight (kg).",
  });

  if (product.adipicFieldMinKg > 0) {
    adipicBagField = adipicBagField.min(
      product.adipicFieldMinKg,
      `Min ${product.adipicFieldMinKg} kg.`,
    );
  } else {
    adipicBagField = adipicBagField.nonnegative(
      "Adipic Acid weight cannot be negative.",
    );
  }

  if (product.adipicFieldMaxKg != null) {
    adipicBagField = adipicBagField.max(
      product.adipicFieldMaxKg,
      `Max ${product.adipicFieldMaxKg} kg.`,
    );
  }

  return z
    .object({
      operatorId: z
        .string({ error: "Select who is doing this operation." })
        .min(1, "Select who is doing this operation."),
      detaLoads: z.array(detaLoadField).min(1, "Add at least one DETA load."),
      adipicBags: z
        .array(adipicBagField)
        .length(
          product.adipicFieldCount,
          `Enter all ${product.adipicFieldCount} Adipic Acid weights.`,
        ),
    })
    .transform((value) => {
      const detaLoads = value.detaLoads.map((load) => load ?? 0);
      const adipicBags = value.adipicBags;
      const detaChargedKg = sumLoads(detaLoads);
      const adipicAcidKg = sumLoads(adipicBags);

      return {
        operatorId: value.operatorId,
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
}

/** @deprecated Prefer createPolymerAdipicDetaSchema(product) */
export const polymerAdipicDetaSchema =
  createPolymerAdipicDetaSchema(POLYMER_973);

export type PolymerAdipicDetaFormValues = z.infer<
  ReturnType<typeof createPolymerAdipicDetaSchema>
>;
