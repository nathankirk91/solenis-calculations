import assert from "node:assert/strict";

const {
  formatMelbourneDateTime,
  formatMelbourneDate,
  formatMelbourneTime,
  formatMelbourneYmd,
  melbourneDateYmd,
  melbourneDayBounds,
  parseYmd,
  startOfMelbourneWeek,
} = await import("./datetime.ts");

assert.equal(
  formatMelbourneDateTime(new Date("2026-07-24T01:00:00.000Z")),
  "24 July 2026, 11:00 am",
);
assert.equal(formatMelbourneDateTime(null), null);

assert.equal(
  formatMelbourneDate(new Date("2026-07-24T01:00:00.000Z")),
  "24 July 2026",
);
assert.equal(
  formatMelbourneTime(new Date("2026-07-24T01:00:00.000Z")),
  "11:00 am",
);

assert.equal(parseYmd("2026-07-30"), "2026-07-30");
assert.equal(parseYmd("2026-02-31"), null);
assert.equal(parseYmd("not-a-date"), null);
assert.equal(parseYmd(null), null);

{
  const bounds = melbourneDayBounds("2026-07-30");
  assert.ok(bounds);
  // 30 Jul 2026 00:00 AEST = 29 Jul 2026 14:00 UTC
  assert.equal(bounds.start.toISOString(), "2026-07-29T14:00:00.000Z");
  // 31 Jul 2026 00:00 AEST
  assert.equal(bounds.end.toISOString(), "2026-07-30T14:00:00.000Z");
  assert.equal(formatMelbourneYmd("2026-07-30"), "30 July 2026");
}

assert.equal(
  melbourneDateYmd(new Date("2026-07-29T14:30:00.000Z")),
  "2026-07-30",
);

// Thursday 30 Jul 2026 Melbourne → week starts Monday 27 Jul 2026 00:00 AEST
{
  const thursday = new Date("2026-07-30T02:00:00.000Z"); // 12:00 Melbourne
  const weekStart = startOfMelbourneWeek(thursday);
  assert.equal(
    formatMelbourneDateTime(weekStart),
    "27 July 2026, 12:00 am",
  );
}

// Sunday belongs to the week that started the previous Monday
{
  const sunday = new Date("2026-08-02T04:00:00.000Z"); // Sunday afternoon Melbourne
  const weekStart = startOfMelbourneWeek(sunday);
  assert.equal(
    formatMelbourneDateTime(weekStart),
    "27 July 2026, 12:00 am",
  );
}

// Next Monday starts a new week
{
  const monday = new Date("2026-08-02T14:30:00.000Z"); // Monday 00:30 Melbourne
  const weekStart = startOfMelbourneWeek(monday);
  assert.equal(
    formatMelbourneDateTime(weekStart),
    "3 Aug 2026, 12:00 am",
  );
}

console.log("datetime tests passed");
