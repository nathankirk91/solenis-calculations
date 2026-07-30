import assert from "node:assert/strict";

const { formatMelbourneDateTime, startOfMelbourneWeek } = await import(
  "./datetime.ts"
);

assert.equal(
  formatMelbourneDateTime(new Date("2026-07-24T01:00:00.000Z")),
  "24 July 2026, 11:00 am",
);
assert.equal(formatMelbourneDateTime(null), null);

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
