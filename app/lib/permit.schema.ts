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

export const PERMIT_AUTH_SLOT_KEYS = [
  "operationsRep",
  "maintenanceRep",
  "safeWorkCoordinator",
] as const;

export type PermitAuthSlotKey = (typeof PERMIT_AUTH_SLOT_KEYS)[number];

export const PERMIT_AUTH_SLOT_LABELS: Record<PermitAuthSlotKey, string> = {
  operationsRep: "Operations representative / Account manager",
  maintenanceRep: "Maintenance representative / Account technician",
  safeWorkCoordinator: "Safe work coordinator",
};

export const MAX_PERMIT_DURATION_HOURS = 12;

export function emptyPermitAuthorization(): PermitAuthorization {
  return {
    operationsRep: { userId: "", name: "", signature: "" },
    maintenanceRep: { userId: "", name: "", signature: "" },
    safeWorkCoordinator: { userId: "", name: "", signature: "" },
  };
}

export function isPermitAuthSlotSigned(
  person: PermitAuthorizationPerson | null | undefined,
): boolean {
  return Boolean(person?.userId?.trim() && person?.signature?.trim());
}

export function isPermitFullyAuthorized(
  authorization: PermitAuthorization,
): boolean {
  return PERMIT_AUTH_SLOT_KEYS.every((key) =>
    isPermitAuthSlotSigned(authorization[key]),
  );
}

export function distinctPermitSignerIds(
  authorization: PermitAuthorization,
): string[] {
  return [
    ...new Set(
      PERMIT_AUTH_SLOT_KEYS.map((key) => authorization[key].userId.trim()).filter(
        Boolean,
      ),
    ),
  ];
}

/** True when completing this slot would open the permit with fewer than two people. */
export function needsFewerThanTwoSignersReason(args: {
  authorization: PermitAuthorization;
  slotKey: PermitAuthSlotKey;
  userId: string;
}): boolean {
  const next: PermitAuthorization = {
    ...args.authorization,
    [args.slotKey]: {
      ...args.authorization[args.slotKey],
      userId: args.userId,
      name: args.authorization[args.slotKey].name || "pending",
      signature: args.authorization[args.slotKey].signature || "pending",
    },
  };
  if (!isPermitFullyAuthorized(next)) {
    return false;
  }
  return distinctPermitSignerIds(next).length < 2;
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/** Duration in minutes from start→end, allowing overnight wrap within 24h. */
export function permitDurationMinutes(
  startTime: string,
  endTime: string,
): number | null {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) {
    return null;
  }
  let duration = end - start;
  if (duration <= 0) {
    duration += 24 * 60;
  }
  return duration;
}

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
          message: "Add at least one authorized person (technician, contractor, or visitor).",
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

      const startId = applicableQuestions.find((q) =>
        q.id.endsWith("__start-time"),
      )?.id;
      const endId = applicableQuestions.find((q) =>
        q.id.endsWith("__end-time"),
      )?.id;
      if (startId && endId) {
        const start = String(value.responses[startId] ?? "");
        const end = String(value.responses[endId] ?? "");
        if (start && end) {
          const minutes = permitDurationMinutes(start, end);
          if (minutes == null) {
            ctx.addIssue({
              code: "custom",
              message: "Enter valid start and end times.",
              path: ["responses", endId],
            });
          } else if (minutes > MAX_PERMIT_DURATION_HOURS * 60) {
            ctx.addIssue({
              code: "custom",
              message: `Permit duration cannot exceed ${MAX_PERMIT_DURATION_HOURS} hours.`,
              path: ["responses", endId],
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
      responses,
      answers,
      summary,
    };
  });
}

export function createPermitSignOffSchema(
  allowedSlotKeys: PermitAuthSlotKey[],
  options?: { requireFewerThanTwoReason?: boolean },
) {
  if (allowedSlotKeys.length === 0) {
    return z.object({
      intent: z.literal("sign-off"),
      slotKey: z.string(),
      signature: z.string(),
      siteVerified: z.string().optional(),
      fewerThanTwoSignersReason: z.string().optional(),
    }).superRefine((_value, ctx) => {
      ctx.addIssue({
        code: "custom",
        message: "You are not eligible to sign off on this permit.",
        path: ["slotKey"],
      });
    });
  }

  const slotKeySchema =
    allowedSlotKeys.length === 1
      ? z.literal(allowedSlotKeys[0])
      : z.enum(allowedSlotKeys as [PermitAuthSlotKey, ...PermitAuthSlotKey[]]);

  return z
    .object({
      intent: z.literal("sign-off"),
      slotKey: slotKeySchema,
      signature: z
        .string({ error: "Signature / initials are required." })
        .min(1, "Please sign or initial."),
      siteVerified: z
        .string({ error: "Confirm you inspected the job site." })
        .refine((value) => value === "on", {
          message: "Confirm you visually inspected the job site before signing.",
        }),
      fewerThanTwoSignersReason: z.preprocess(
        emptyToUndefined,
        z
          .string()
          .trim()
          .max(500, "Keep the reason under 500 characters.")
          .optional(),
      ),
    })
    .superRefine((value, ctx) => {
      if (
        options?.requireFewerThanTwoReason &&
        !value.fewerThanTwoSignersReason?.trim()
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "Document why fewer than two separate people are available to sign.",
          path: ["fewerThanTwoSignersReason"],
        });
      }
    });
}

export function createPermitCloseoutSchema() {
  return z.object({
    intent: z.literal("closeout").optional(),
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
      .min(1, "Operators involved must initial the close-out."),
    maintenanceInitials: z
      .string({ error: "Maintenance initials are required." })
      .min(1, "Maintenance personnel involved must initial the close-out."),
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
  /** ISO timestamp when signer confirmed site verification. */
  siteVerifiedAt?: string;
};

export type PermitAuthorization = {
  operationsRep: PermitAuthorizationPerson;
  maintenanceRep: PermitAuthorizationPerson;
  safeWorkCoordinator: PermitAuthorizationPerson;
  /** Required by procedure when fewer than two distinct people signed. */
  fewerThanTwoSignersReason?: string;
};
export type PermitCloseout = {
  date: string;
  time: string;
  operatorsInitials: string;
  maintenanceInitials: string;
};
