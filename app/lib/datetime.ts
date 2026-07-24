const MELBOURNE_TIME_ZONE = "Australia/Melbourne";

export function formatMelbourneDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: MELBOURNE_TIME_ZONE,
  });
}
