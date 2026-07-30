import assert from "node:assert/strict";

const {
  parseInspectionHistorySort,
  sortInspectionHistoryItems,
} = await import("./inspection-history.ts");

assert.equal(parseInspectionHistorySort(null), "newest");
assert.equal(parseInspectionHistorySort("attention"), "attention");
assert.equal(parseInspectionHistorySort("actions"), "actions");
assert.equal(parseInspectionHistorySort("nope"), "newest");

const items = [
  {
    id: "a",
    status: "PASSED",
    createdAt: new Date("2026-07-30T10:00:00.000Z"),
    summary: { attentionCount: 0 },
    actionCount: 0,
  },
  {
    id: "b",
    status: "NEEDS_ATTENTION",
    createdAt: new Date("2026-07-30T09:00:00.000Z"),
    summary: { attentionCount: 2 },
    actionCount: 1,
  },
  {
    id: "c",
    status: "PASSED",
    createdAt: new Date("2026-07-30T11:00:00.000Z"),
    summary: { attentionCount: 0 },
    actionCount: 3,
  },
  {
    id: "d",
    status: "NEEDS_ATTENTION",
    createdAt: new Date("2026-07-30T08:00:00.000Z"),
    summary: { attentionCount: 1 },
    actionCount: 0,
  },
];

{
  const sorted = sortInspectionHistoryItems(items, "newest");
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["c", "a", "b", "d"],
  );
}

{
  const sorted = sortInspectionHistoryItems(items, "attention");
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["b", "d", "c", "a"],
  );
}

{
  const sorted = sortInspectionHistoryItems(items, "actions");
  assert.deepEqual(
    sorted.map((item) => item.id),
    ["c", "b", "d", "a"],
  );
}

console.log("inspection-history tests passed");
