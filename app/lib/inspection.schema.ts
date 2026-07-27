import { z } from "zod";

import {
  listInspectionItems,
  summarizeInspectionResponses,
  type InspectionDefinition,
  type InspectionItemResult,
} from "~/lib/inspections";

const resultEnum = z.enum(["ok", "attention", "na"], {
  error: "Select OK, Needs attention, or N/A.",
});

function emptyToUndefined(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}

export function createInspectionSchema(definition: InspectionDefinition) {
  const items = listInspectionItems(definition);
  const responseShape = Object.fromEntries(
    items.map((item) => [item.id, resultEnum]),
  ) as Record<string, typeof resultEnum>;

  return z
    .object({
      operatorId: z
        .string({ error: "Select who is doing this inspection." })
        .min(1, "Select who is doing this inspection."),
      equipmentRef: z.preprocess(
        emptyToUndefined,
        z
          .string()
          .trim()
          .min(1, `${definition.equipmentLabel ?? "Equipment"} is required.`)
          .max(80, "Keep the reference under 80 characters.")
          .optional(),
      ),
      notes: z.preprocess(
        emptyToUndefined,
        z
          .string()
          .trim()
          .max(2000, "Notes must be under 2000 characters.")
          .optional(),
      ),
      responses: z.object(responseShape),
    })
    .superRefine((value, ctx) => {
      if (definition.equipmentLabel && !value.equipmentRef) {
        ctx.addIssue({
          code: "custom",
          message: `${definition.equipmentLabel} is required.`,
          path: ["equipmentRef"],
        });
      }

      for (const item of items) {
        if (!value.responses[item.id]) {
          ctx.addIssue({
            code: "custom",
            message: "Select a result for this item.",
            path: ["responses", item.id],
          });
        }
      }
    })
    .transform((value) => {
      const responses = value.responses as Record<string, InspectionItemResult>;
      const summary = summarizeInspectionResponses(definition, responses);

      return {
        operatorId: value.operatorId,
        equipmentRef: value.equipmentRef ?? null,
        notes: value.notes ?? null,
        responses,
        summary,
      };
    });
}

export type InspectionFormValues = z.infer<
  ReturnType<typeof createInspectionSchema>
>;
