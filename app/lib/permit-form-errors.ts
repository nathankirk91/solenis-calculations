import type { InspectionDefinition } from "~/lib/inspections";

/** Reject oversized tablet signature data URLs before they hit the database. */
export const MAX_PERMIT_SIGNATURE_LENGTH = 250_000;

export type PermitFormIssue = {
  path: string;
  label: string;
  messages: string[];
};

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return "";
}

function prismaErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code ?? "");
  }
  return "";
}

export function isTransientDbError(error: unknown): boolean {
  const code = prismaErrorCode(error);
  if (
    code === "P1001" ||
    code === "P1008" ||
    code === "P1017" ||
    code === "P2024"
  ) {
    return true;
  }
  const text = errorMessage(error).toLowerCase();
  return (
    text.includes("timeout") ||
    text.includes("timed out") ||
    text.includes("connection terminated") ||
    text.includes("connection refused") ||
    text.includes("too many clients") ||
    text.includes("server closed the connection") ||
    text.includes("econnreset") ||
    text.includes("etimedout")
  );
}

/**
 * User-facing copy for a failed permit insert. This is a storage failure, not a
 * safety / checklist rejection — callers should keep that distinction visible.
 */
export function permitSaveErrorMessage(error: unknown): string {
  const text = errorMessage(error).toLowerCase();
  const code = prismaErrorCode(error);

  if (
    text.includes("database is not configured") ||
    text.includes("database_url")
  ) {
    return "The database is not available, so the permit was not stored. Try again.";
  }
  if (
    text.includes("tls") ||
    text.includes("self-signed") ||
    text.includes("certificate") ||
    code === "P1011"
  ) {
    return "Could not securely connect to the database, so the permit was not stored. Try again.";
  }
  if (isTransientDbError(error)) {
    return "The database timed out while saving, so the permit was not stored. Try again in a moment.";
  }
  if (text.includes("permit form not found")) {
    return "This permit form is missing from the database. Ask a manager to sync permit forms from Manage.";
  }
  if (text.includes("permit number")) {
    return "Could not allocate a permit number, so the permit was not stored. Try again.";
  }
  if (
    text.includes("too large") ||
    text.includes("value too long") ||
    text.includes("payload")
  ) {
    return "The signature image was too large to save. Clear it and sign again with a smaller mark.";
  }
  if (code === "P2002") {
    return "A permit number was already used. Try submitting again.";
  }

  return "The permit passed checks but could not be stored. This is a save error, not a safety rejection. Try again.";
}

export async function withTransientRetry<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isTransientDbError(error)) {
      throw error;
    }
    return await operation();
  }
}

function isMessageList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Flatten Conform / Zod error trees into path → messages. */
export function flattenFormErrorTree(
  error: unknown,
  prefix = "",
): PermitFormIssue[] {
  if (error == null) {
    return [];
  }
  if (isMessageList(error)) {
    const messages = error.map((item) => item.trim()).filter(Boolean);
    if (messages.length === 0) {
      return [];
    }
    return [{ path: prefix, label: prefix, messages }];
  }
  if (typeof error !== "object") {
    return [];
  }

  const issues: PermitFormIssue[] = [];
  for (const [key, value] of Object.entries(error as Record<string, unknown>)) {
    const nextPath = joinErrorPath(prefix, key);
    issues.push(...flattenFormErrorTree(value, nextPath));
  }
  return issues;
}

function joinErrorPath(prefix: string, key: string): string {
  if (key === "" || key === "_errors") {
    return prefix;
  }
  if (!prefix) {
    return key;
  }
  if (/^\d+$/.test(key)) {
    return `${prefix}[${key}]`;
  }
  if (key.startsWith("[") || prefix.endsWith("]")) {
    return `${prefix}${key.startsWith("[") ? "" : "."}${key}`;
  }
  return `${prefix}.${key}`;
}

export function labelForPermitFormPath(
  path: string,
  definition: InspectionDefinition,
): string {
  if (!path) {
    return "Form";
  }
  if (path === "equipmentRef") {
    return definition.equipmentLabel?.trim() || "Equipment";
  }

  const person =
    /^authorizedPersonnel\[(\d+)\]\.(name|signature)$/.exec(path) ??
    /^authorizedPersonnel\.(\d+)\.(name|signature)$/.exec(path);
  if (person) {
    const index = Number(person[1]);
    const who =
      index === 0 ? "Authorized person" : `Authorized person ${index + 1}`;
    return person[2] === "signature" ? `${who} sign-off` : who;
  }

  const responseId =
    /^responses\[(.+)\]$/.exec(path)?.[1] ??
    (path.startsWith("responses.") ? path.slice("responses.".length) : null);
  if (responseId) {
    const question = definition.questions.find((item) => item.id === responseId);
    if (question?.label.trim()) {
      return question.label.trim();
    }
    return "Checklist answer";
  }

  return path;
}

export function listPermitFormIssues(args: {
  definition: InspectionDefinition;
  formError?: string | null;
  formErrors?: string[] | null;
  allErrors?: Record<string, string[] | undefined> | null;
  nestedError?: unknown;
}): PermitFormIssue[] {
  const issues: PermitFormIssue[] = [];
  const seen = new Set<string>();

  const push = (path: string, messages: string[]) => {
    const cleaned = messages.map((item) => item.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      return;
    }
    const key = `${path}::${cleaned.join("|")}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    issues.push({
      path,
      label: labelForPermitFormPath(path, args.definition),
      messages: cleaned,
    });
  };

  if (args.formError?.trim()) {
    push("", [args.formError.trim()]);
  }
  if (args.formErrors && args.formErrors.length > 0) {
    push("", args.formErrors);
  }

  if (args.allErrors) {
    for (const [path, messages] of Object.entries(args.allErrors)) {
      if (messages && messages.length > 0) {
        push(path, messages);
      }
    }
  }

  if (args.nestedError != null) {
    for (const issue of flattenFormErrorTree(args.nestedError)) {
      push(issue.path, issue.messages);
    }
  }

  return issues;
}
