import { z } from "zod";

export const polymer973Schema = z.object({
  basis: z.enum(["adipic", "deta", "total"], {
    error: "Select what the amount represents.",
  }),
  amountKg: z
    .number({ error: "Enter a valid amount in kg." })
    .positive("Amount must be greater than zero."),
  molarRatio: z
    .number({ error: "Enter a valid molar ratio." })
    .positive("Molar ratio must be greater than zero."),
});

export type Polymer973FormValues = z.infer<typeof polymer973Schema>;
