import { z } from "zod";

import {
  buildAnswersFromResponses,
  filterQuestionsForContext,
  readShiftAnswer,
  summarizeInspectionAnswers,
  type InspectionDefinition,
} from "~/lib/inspections";

function emptyToUndefined(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}

export type InspectionSchemaContext = {
  /** Melbourne Mon–Sun week; defaults to true when omitted. */
  isFirstInspectionOfWeek?: boolean;
};

export function createInspectionSchema(
  definition: InspectionDefinition,
  context: InspectionSchemaContext = {},
) {
  const responseShape: Record<string, z.ZodType<string | undefined>> = {};
  const isFirstInspectionOfWeek = context.isFirstInspectionOfWeek ?? true;

  for (const question of definition.questions) {
    if (question.type === "TEXT") {
      responseShape[question.id] = z.preprocess(
        emptyToUndefined,
        z
          .string()
          .trim()
          .max(2000, "Keep the answer under 2000 characters.")
          .optional(),
      );
    } else if (question.type === "NUMBER") {
      responseShape[question.id] = z.preprocess(
        emptyToUndefined,
        z
          .string()
          .trim()
          .regex(/^-?\d+(\.\d+)?$/, "Enter a valid number.")
          .optional(),
      );
    } else if (question.type === "DATE") {
      responseShape[question.id] = z.preprocess(
        emptyToUndefined,
        z
          .string()
          .trim()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
          .optional(),
      );
    } else if (question.type === "YES_NO") {
      responseShape[question.id] = z.preprocess(
        emptyToUndefined,
        z.enum(["Yes", "No"], { error: "Select Yes or No." }).optional(),
      );
    } else {
      const options = question.options;
      responseShape[question.id] = z.preprocess(
        emptyToUndefined,
        options.length > 0
          ? z
              .enum(options as [string, ...string[]], {
                error: "Select an option.",
              })
              .optional()
          : z.string().min(1, "Select an option.").optional(),
      );
    }
  }

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
      actions: z.preprocess((value) => {
        if (value == null || value === "") {
          return [];
        }
        if (Array.isArray(value)) {
          return value;
        }
        return [value];
      }, z.array(z.string().trim().max(2000, "Keep each action under 2000 characters."))),
      signature: z
        .string({ error: "Signature is required." })
        .min(1, "Please sign or initial the form."),
      responses: z.object(responseShape),
    })
    .superRefine((value, ctx) => {
      if (definition.fixedEquipmentRef) {
        // Unit is locked on the form; no picker validation needed.
      } else if (definition.equipmentChoices?.length) {
        const allowed = new Set(
          definition.equipmentChoices.map((choice) => choice.value),
        );
        if (!value.equipmentRef || !allowed.has(value.equipmentRef)) {
          ctx.addIssue({
            code: "custom",
            message: `Select ${definition.equipmentLabel ?? "a unit"}.`,
            path: ["equipmentRef"],
          });
        }
      } else if (definition.equipmentLabel && !value.equipmentRef) {
        ctx.addIssue({
          code: "custom",
          message: `${definition.equipmentLabel} is required.`,
          path: ["equipmentRef"],
        });
      }

      const shift = readShiftAnswer(definition.questions, value.responses);
      const applicableQuestions = filterQuestionsForContext(
        definition.questions,
        { shift, isFirstInspectionOfWeek },
      );

      for (const question of applicableQuestions) {
        const answer = value.responses[question.id];
        if (question.required && (answer == null || String(answer).trim() === "")) {
          ctx.addIssue({
            code: "custom",
            message:
              question.type === "TEXT" ||
              question.type === "NUMBER" ||
              question.type === "DATE"
                ? "Enter an answer."
                : "Select an answer.",
            path: ["responses", question.id],
          });
        }
      }
    })
    .transform((value) => {
      const shift = readShiftAnswer(definition.questions, value.responses);
      const applicableQuestions = filterQuestionsForContext(
        definition.questions,
        { shift, isFirstInspectionOfWeek },
      );
      const responses: Record<string, string> = {};
      for (const question of applicableQuestions) {
        responses[question.id] = String(value.responses[question.id] ?? "");
      }
      const answers = buildAnswersFromResponses(
        { ...definition, questions: applicableQuestions },
        responses,
      );
      const summary = summarizeInspectionAnswers(answers);

      return {
        operatorId: value.operatorId,
        equipmentRef:
          definition.fixedEquipmentRef ?? value.equipmentRef ?? null,
        notes: value.notes ?? null,
        actions: value.actions.map((item) => item.trim()).filter(Boolean),
        signature: value.signature,
        responses,
        answers,
        summary,
      };
    });
}

export type InspectionFormValues = z.infer<
  ReturnType<typeof createInspectionSchema>
>;
