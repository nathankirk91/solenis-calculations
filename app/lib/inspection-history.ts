import type { InspectionSummary } from "~/lib/inspections";

export type InspectionHistorySort = "newest" | "attention" | "actions";

export const INSPECTION_HISTORY_SORTS = [
  "newest",
  "attention",
  "actions",
] as const satisfies readonly InspectionHistorySort[];

export function parseInspectionHistorySort(
  value: string | null | undefined,
): InspectionHistorySort {
  if (value === "attention" || value === "actions") {
    return value;
  }
  return "newest";
}

export type InspectionHistorySortable = {
  status: InspectionSummary["status"];
  createdAt: Date;
  summary: Pick<InspectionSummary, "attentionCount">;
  actionCount: number;
};

/**
 * Sort inspection history for the records list.
 * - newest: createdAt desc
 * - attention: needs-attention first, then attentionCount desc, then newest
 * - actions: actionCount desc, then needs-attention, then newest
 */
export function sortInspectionHistoryItems<T extends InspectionHistorySortable>(
  items: T[],
  sort: InspectionHistorySort,
): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    if (sort === "attention") {
      const aAttention = a.status === "NEEDS_ATTENTION" ? 1 : 0;
      const bAttention = b.status === "NEEDS_ATTENTION" ? 1 : 0;
      if (aAttention !== bAttention) {
        return bAttention - aAttention;
      }
      if (a.summary.attentionCount !== b.summary.attentionCount) {
        return b.summary.attentionCount - a.summary.attentionCount;
      }
      if (a.actionCount !== b.actionCount) {
        return b.actionCount - a.actionCount;
      }
    } else if (sort === "actions") {
      if (a.actionCount !== b.actionCount) {
        return b.actionCount - a.actionCount;
      }
      const aAttention = a.status === "NEEDS_ATTENTION" ? 1 : 0;
      const bAttention = b.status === "NEEDS_ATTENTION" ? 1 : 0;
      if (aAttention !== bAttention) {
        return bAttention - aAttention;
      }
    }

    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  return copy;
}
