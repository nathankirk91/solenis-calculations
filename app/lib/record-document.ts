import { formatLastAnswerDisplay, type InspectionAnswerRecord } from "~/lib/inspections";

import { APP_NAME } from "~/lib/brand";

export const RECORD_SITE_NAME = APP_NAME;
export const EMPTY_FIELD_VALUE = "—";

export type RecordDocumentKind = "inspection" | "permit";

export type RecordDocumentMeta = {
  label: string;
  value: string;
};

export type RecordDocumentField = {
  label: string;
  value: string;
  flagged?: boolean;
};

export type RecordDocumentSignature = {
  label: string;
  name?: string;
  caption?: string;
  /** PNG/JPEG data URL from the signature pad, or plain initials text. */
  imageDataUrl?: string | null;
  unsigned?: boolean;
};

export type RecordDocumentBlock =
  | {
      kind: "fields";
      title: string;
      fields: RecordDocumentField[];
    }
  | {
      kind: "text";
      title: string;
      body: string;
    }
  | {
      kind: "list";
      title: string;
      items: string[];
    }
  | {
      kind: "signatures";
      title: string;
      description?: string;
      signatures: RecordDocumentSignature[];
    };

export type RecordDocument = {
  kind: RecordDocumentKind;
  title: string;
  subtitle?: string;
  status: string;
  siteName: string;
  generatedAtLabel: string;
  filename: string;
  meta: RecordDocumentMeta[];
  blocks: RecordDocumentBlock[];
  footerNote?: string;
};

export function emptyFieldValue(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  return trimmed || EMPTY_FIELD_VALUE;
}

export function formatAnswerForDocument(row: InspectionAnswerRecord): string {
  return emptyFieldValue(formatLastAnswerDisplay(row.answer, row.type));
}

export function isSyntheticPermitDurationQuestion(questionId: string): boolean {
  return questionId.endsWith("__permit-duration");
}

export function groupAnswersForDocument(
  rows: InspectionAnswerRecord[],
): Array<{ title: string; fields: RecordDocumentField[] }> {
  const groups: Array<{ title: string; fields: RecordDocumentField[] }> = [];

  for (const row of rows) {
    if (isSyntheticPermitDurationQuestion(row.questionId)) {
      continue;
    }
    const title = row.sectionTitle?.trim() || "Answers";
    const label = row.label.trim();
    const sectionTitle = title.trim();
    const field: RecordDocumentField = {
      label:
        label.toLowerCase() === sectionTitle.toLowerCase() ? "" : row.label,
      value: formatAnswerForDocument(row),
      flagged: row.flagged,
    };
    const existing = groups.find((group) => group.title === title);
    if (existing) {
      existing.fields.push(field);
    } else {
      groups.push({ title, fields: [field] });
    }
  }

  return groups;
}

/** ASCII-safe download name, e.g. "Safe-Work-Permit-2608002.pdf". */
export function buildRecordFilename(parts: Array<string | null | undefined>): string {
  const slug = parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join("-")
    .replace(/['"]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${slug || "record"}.pdf`;
}

const IMAGE_DATA_URL_RE =
  /^data:image\/(png|jpe?g|gif|webp);base64,([a-zA-Z0-9+/=\s]+)$/i;

export type ParsedSignatureImage = {
  mime: "png" | "jpeg";
  bytes: Uint8Array;
};

export function parseSignatureImageDataUrl(
  value: string | null | undefined,
): ParsedSignatureImage | null {
  const trimmed = String(value ?? "").trim();
  const match = IMAGE_DATA_URL_RE.exec(trimmed);
  if (!match) {
    return null;
  }
  const format = match[1].toLowerCase();
  if (format === "gif" || format === "webp") {
    return null;
  }
  const mime: "png" | "jpeg" = format === "png" ? "png" : "jpeg";
  try {
    const binary = atob(match[2].replace(/\s+/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { mime, bytes };
  } catch {
    return null;
  }
}

export function signatureDisplayText(
  value: string | null | undefined,
): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  if (parseSignatureImageDataUrl(trimmed)) {
    return null;
  }
  if (trimmed.startsWith("data:")) {
    return null;
  }
  return trimmed;
}
