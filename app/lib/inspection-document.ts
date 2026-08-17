import { formatMelbourneDateTime, melbourneDateYmd } from "~/lib/datetime";
import type { InspectionAnswerRecord } from "~/lib/inspections";
import {
  buildRecordFilename,
  emptyFieldValue,
  groupAnswersForDocument,
  RECORD_SITE_NAME,
  type RecordDocument,
} from "~/lib/record-document";

export type InspectionDocumentInput = {
  id: string;
  inspectionTitle: string;
  status: "PASSED" | "NEEDS_ATTENTION";
  operatorName: string | null;
  equipmentRef: string | null;
  createdAt: Date;
  notes: string | null;
  signature: string | null;
  summary: {
    answeredCount: number;
    attentionCount: number;
    attentionItems: Array<{
      itemId: string;
      label: string;
      sectionTitle: string;
      answer?: string;
    }>;
  };
  answers: InspectionAnswerRecord[];
  actions: Array<{
    id: string;
    description: string;
    status: "OPEN" | "CLOSED";
    createdAt: Date;
    createdByOperatorName: string | null;
    closedAt: Date | null;
    closedByName: string | null;
    completionComment: string | null;
  }>;
};

export function inspectionStatusLabel(
  status: InspectionDocumentInput["status"],
): string {
  return status === "NEEDS_ATTENTION" ? "Needs attention" : "Passed";
}

function formatActionLine(
  action: InspectionDocumentInput["actions"][number],
): string {
  const when = formatMelbourneDateTime(action.createdAt) ?? "";
  const who = action.createdByOperatorName?.trim() || "";
  const header = [
    action.status === "OPEN" ? "Open" : "Closed",
    action.description.trim() || "Action",
  ].join(" — ");
  const reported = [when, who].filter(Boolean).join(" · ");
  const lines = [header];
  if (reported) {
    lines.push(`Reported ${reported}`);
  }
  if (action.status === "CLOSED") {
    const closedWhen = formatMelbourneDateTime(action.closedAt) ?? "";
    const closedWho = action.closedByName?.trim() || "";
    const closed = [closedWhen, closedWho].filter(Boolean).join(" · ");
    if (closed) {
      lines.push(`Closed ${closed}`);
    }
    if (action.completionComment?.trim()) {
      lines.push(action.completionComment.trim());
    }
  }
  return lines.join("\n");
}

export function buildInspectionDocument(
  run: InspectionDocumentInput,
  options: { generatedAt?: Date } = {},
): RecordDocument {
  const generatedAt = options.generatedAt ?? new Date();
  const submittedAt = formatMelbourneDateTime(run.createdAt) ?? EMPTY_PLACEHOLDER;
  const status = inspectionStatusLabel(run.status);

  const blocks: RecordDocument["blocks"] = [];

  if (run.summary.attentionItems.length > 0) {
    blocks.push({
      kind: "list",
      title: "Follow-up items",
      items: run.summary.attentionItems.map((item) => {
        const prefix = item.sectionTitle?.trim()
          ? `${item.sectionTitle}: `
          : "";
        const answer = item.answer?.trim() ? ` — ${item.answer.trim()}` : "";
        return `${prefix}${item.label}${answer}`;
      }),
    });
  }

  if (run.actions.length > 0) {
    blocks.push({
      kind: "list",
      title: "Actions",
      items: run.actions.map(formatActionLine),
    });
  }

  for (const group of groupAnswersForDocument(run.answers)) {
    blocks.push({
      kind: "fields",
      title: group.title,
      fields: group.fields,
    });
  }

  if (run.notes?.trim()) {
    blocks.push({
      kind: "text",
      title: "Notes",
      body: run.notes.trim(),
    });
  }

  blocks.push({
    kind: "signatures",
    title: "Operator signature",
    signatures: [
      {
        label: "Operator signature",
        name: run.operatorName?.trim() || undefined,
        imageDataUrl: run.signature,
        unsigned: !String(run.signature ?? "").trim(),
      },
    ],
  });

  return {
    kind: "inspection",
    title: run.inspectionTitle,
    status,
    siteName: RECORD_SITE_NAME,
    generatedAtLabel: formatMelbourneDateTime(generatedAt) ?? "",
    filename: buildRecordFilename([
      run.inspectionTitle,
      run.equipmentRef,
      melbourneDateYmd(run.createdAt),
    ]),
    meta: [
      { label: "Status", value: status },
      { label: "Operator", value: emptyFieldValue(run.operatorName) },
      { label: "Equipment / unit", value: emptyFieldValue(run.equipmentRef) },
      { label: "Submitted", value: submittedAt },
      { label: "Answered", value: String(run.summary.answeredCount) },
      {
        label: "Needs attention",
        value: String(run.summary.attentionCount),
      },
    ],
    blocks,
    footerNote: "Plant inspection record — Springvale Solenis.",
  };
}

const EMPTY_PLACEHOLDER = emptyFieldValue("");
