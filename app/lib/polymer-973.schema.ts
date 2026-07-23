import { z } from "zod";

export const polymer973Schema = z.object({
  detaChargedKg: z
    .number({ error: "Enter the DETA already charged (kg)." })
    .nonnegative("DETA charged cannot be negative."),
  adipicAcidKg: z
    .number({ error: "Enter the Adipic Acid charged (kg)." })
    .positive("Adipic Acid amount must be greater than zero."),
});

export type Polymer973FormValues = z.infer<typeof polymer973Schema>;
