export type PendingRunLoads = {
  detaLoads: number[];
  adipicBags: number[];
  detaChargedKg: number;
  adipicAcidKg: number;
};

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    const num = typeof item === "number" ? item : Number(item);
    return Number.isFinite(num) ? num : 0;
  });
}

function asNumber(value: unknown, fallback = 0): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function parsePendingRunLoads(inputs: unknown): PendingRunLoads {
  const record =
    inputs && typeof inputs === "object"
      ? (inputs as Record<string, unknown>)
      : {};

  const detaLoads = asNumberArray(record.detaLoads);
  const adipicBags = asNumberArray(record.adipicBags);
  const detaChargedKg = asNumber(
    record.detaChargedKg,
    detaLoads.reduce((total, value) => total + value, 0),
  );
  const adipicAcidKg = asNumber(
    record.adipicAcidKg,
    adipicBags.reduce((total, value) => total + value, 0),
  );

  return { detaLoads, adipicBags, detaChargedKg, adipicAcidKg };
}
