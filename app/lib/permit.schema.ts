import { z } from "zod";

import {
  buildAnswersFromResponses,
  filterQuestionsForContext,
  parseCheckboxAnswer,
  summarizeInspectionAnswers,
  type InspectionDefinition,
} from "~/lib/inspections";

function emptyToUndefined(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
}

function buildResponseShape(definition: InspectionDefinition) {
  const responseShape: Record<string, z.ZodType<string | undefined>> = {};

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
    } else if (question.type === "TIME") {
      responseShape[question.id] = z.preprocess(
        emptyToUndefined,
        z
          .string()
          .trim()
          .regex(/^\d{2}:\d{2}$/, "Enter a valid 24-hour time.")
          .optional(),
      );
    } else if (question.type === "CHECKBOX") {
      responseShape[question.id] = z.preprocess((value) => {
        if (value == null || value === "") {
          return undefined;
        }
        if (Array.isArray(value)) {
          const joined = value
            .map((item) => String(item).trim())
            .filter(Boolean)
            .join("|");
          return joined || undefined;
        }
        const trimmed = String(value).trim();
        return trimmed || undefined;
      }, z.string().optional());
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

  return responseShape;
}

const authorizationPersonSchema = z.object({
  userId: z
    .string({ error: "Select a user." })
    .trim()
    .min(1, "Select a user."),
  signature: z
    .string({ error: "Signature / initials are required." })
    .min(1, "Please sign or initial."),
});

export function createPermitIssueFormSchema(definition: InspectionDefinition) {
  return z
    .object({
      equipmentRef: z.preprocess(
        emptyToUndefined,
        z
          .string()
          .trim()
          .min(1, `${definition.equipmentLabel ?? "Equipment"} is required.`)
          .max(80, "Keep the reference under 80 characters.")
          .optional(),
      ),
      authorizedPersonnel: z
        .array(
          z
            .string()
            .trim()
            .max(120, "Keep each name under 120 characters."),
        )
        .default([]),
      authorization: z.object({
        operationsRep: authorizationPersonSchema,
        maintenanceRep: authorizationPersonSchema,
        safeWorkCoordinator: authorizationPersonSchema,
      }),
      responses: z.object(buildResponseShape(definition)),
    })
    .superRefine((value, ctx) => {
      if (definition.equipmentLabel && !value.equipmentRef) {
        ctx.addIssue({
          code: "custom",
          message: `${definition.equipmentLabel} is required.`,
          path: ["equipmentRef"],
        });
      }

      const personnel = value.authorizedPersonnel
        .map((name) => name.trim())
        .filter(Boolean);
      if (personnel.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Add at least one authorized person.",
          path: ["authorizedPersonnel", 0],
        });
      }

      const applicableQuestions = filterQuestionsForContext(
        definition.questions,
        { isFirstInspectionOfWeek: true },
      );

      for (const question of applicableQuestions) {
        const answer = value.responses[question.id];
        if (question.required && (answer == null || String(answer).trim() === "")) {
          ctx.addIssue({
            code: "custom",
            message:
              question.type === "TEXT" ||
              question.type === "NUMBER" ||
              question.type === "DATE" ||
              question.type === "TIME"
                ? "Enter an answer."
                : question.type === "CHECKBOX"
                  ? "Select at least one option."
                  : "Select an answer.",
            path: ["responses", question.id],
          });
        }
        if (
          question.type === "CHECKBOX" &&
          answer != null &&
          String(answer).trim() !== ""
        ) {
          const allowed = new Set(question.options);
          const invalid = parseCheckboxAnswer(String(answer)).filter(
            (item) => !allowed.has(item),
          );
          if (invalid.length > 0) {
            ctx.addIssue({
              code: "custom",
              message: "Select valid options only.",
              path: ["responses", question.id],
            });
          }
        }
      }
    });
}

export function createPermitIssueSchema(definition: InspectionDefinition) {
  return createPermitIssueFormSchema(definition).transform((value) => {
    const applicableQuestions = filterQuestionsForContext(
      definition.questions,
      { isFirstInspectionOfWeek: true },
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
    const authorizedPersonnel = value.authorizedPersonnel
      .map((name) => name.trim())
      .filter(Boolean);

    return {
      equipmentRef: value.equipmentRef ?? null,
      authorizedPersonnel,
      authorization: value.authorization,
      responses,
      answers,
      summary,
    };
  });
}

export function createPermitCloseoutSchema() {
  return z.object({
    date: z
      .string({ error: "Enter the close-out date." })
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date."),
    time: z
      .string({ error: "Enter the close-out time." })
      .trim()
      .regex(/^\d{2}:\d{2}$/, "Enter a valid 24-hour time."),
    operatorsInitials: z
      .string({ error: "Operators initials are required." })
      .min(1, "Operators must initial the close-out."),
    maintenanceInitials: z
      .string({ error: "Maintenance initials are required." })
      .min(1, "Maintenance must initial the close-out."),
  });
}

export type PermitIssueFormValues = z.infer<
  ReturnType<typeof createPermitIssueSchema>
>;
export type PermitCloseoutValues = z.infer<
  ReturnType<typeof createPermitCloseoutSchema>
>;
export type PermitAuthorizationPerson = {
  userId: string;
  name: string;
  signature: string;
};

export type PermitAuthorization = {
  operationsRep: PermitAuthorizationPerson;
  maintenanceRep: PermitAuthorizationPerson;
  safeWorkCoordinator: PermitAuthorizationPerson;
};
export type PermitCloseout = {
  date: string;
  time: string;
  operatorsInitials: string;
  maintenanceInitials: string;
};
