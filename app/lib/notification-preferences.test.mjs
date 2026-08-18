import assert from "node:assert/strict";
import { parseWithZod } from "@conform-to/zod/v4";

const {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPE_IDS,
  defaultNotificationPreferences,
  enabledTypesFromPreferences,
  isNotificationEnabled,
  isNotificationTypeId,
  mergeNotificationPreferences,
  notificationPreferenceSchema,
  preferenceRowsFromEnabledTypes,
} = await import("./notification-preferences.ts");

{
  const prefs = defaultNotificationPreferences();
  assert.equal(NOTIFICATION_TYPE_IDS.length, 4);
  for (const type of NOTIFICATION_TYPE_IDS) {
    assert.equal(prefs[type], true);
    assert.equal(isNotificationEnabled(prefs, type), true);
  }
  assert.deepEqual(enabledTypesFromPreferences(prefs), [...NOTIFICATION_TYPE_IDS]);
}

{
  const categoryIds = NOTIFICATION_CATEGORIES.map((category) => category.id);
  assert.deepEqual(categoryIds, ["calculations", "permits", "inspections"]);
  const typeIds = NOTIFICATION_CATEGORIES.flatMap((category) =>
    category.types.map((type) => type.id),
  );
  assert.deepEqual(typeIds, [...NOTIFICATION_TYPE_IDS]);
}

{
  assert.equal(isNotificationTypeId("permit.pending_authorization"), true);
  assert.equal(isNotificationTypeId("permit.needs_attention"), false);
  assert.equal(isNotificationTypeId("permit.unknown"), false);
}

{
  const merged = mergeNotificationPreferences([
    { type: "permit.pending_authorization", enabled: false },
    { type: "permit.needs_attention", enabled: false },
    { type: "not-a-real-type", enabled: false },
    { type: "inspection.new_actions", enabled: true },
  ]);
  assert.equal(merged["calculation.pending"], true);
  assert.equal(merged["permit.pending_authorization"], false);
  assert.equal(merged["inspection.needs_attention"], true);
  assert.equal(merged["inspection.new_actions"], true);
  assert.equal(
    isNotificationEnabled(merged, "permit.pending_authorization"),
    false,
  );
  assert.equal(isNotificationEnabled(merged, "calculation.pending"), true);
}

{
  const fromRows = [
    { type: "calculation.pending", enabled: false },
  ];
  assert.equal(
    isNotificationEnabled(fromRows, "calculation.pending"),
    false,
  );
  assert.equal(
    isNotificationEnabled(fromRows, "inspection.new_actions"),
    true,
  );
}

{
  const rows = preferenceRowsFromEnabledTypes([
    "calculation.pending",
    "inspection.new_actions",
    "garbage",
  ]);
  assert.deepEqual(
    rows.filter((row) => row.enabled).map((row) => row.type),
    ["calculation.pending", "inspection.new_actions"],
  );
  assert.equal(rows.every((row) => isNotificationTypeId(row.type)), true);
  const allOff = preferenceRowsFromEnabledTypes([]);
  assert.equal(allOff.every((row) => row.enabled === false), true);
}

{
  const formData = new FormData();
  formData.append("types", "permit.pending_authorization");
  formData.append("types", "inspection.needs_attention");
  const submission = parseWithZod(formData, {
    schema: notificationPreferenceSchema,
  });
  assert.equal(submission.status, "success");
  if (submission.status === "success") {
    assert.deepEqual(submission.value.types, [
      "permit.pending_authorization",
      "inspection.needs_attention",
    ]);
  }
}

{
  const formData = new FormData();
  const submission = parseWithZod(formData, {
    schema: notificationPreferenceSchema,
  });
  assert.equal(submission.status, "success");
  if (submission.status === "success") {
    assert.deepEqual(submission.value.types, []);
    const prefs = mergeNotificationPreferences(
      preferenceRowsFromEnabledTypes(submission.value.types),
    );
    assert.equal(
      NOTIFICATION_TYPE_IDS.every((type) => prefs[type] === false),
      true,
    );
  }
}

{
  const formData = new FormData();
  formData.append("types", "calculation.pending");
  const submission = parseWithZod(formData, {
    schema: notificationPreferenceSchema,
  });
  assert.equal(submission.status, "success");
  if (submission.status === "success") {
    assert.deepEqual(submission.value.types, ["calculation.pending"]);
  }
}

{
  const formData = new FormData();
  formData.append("types", "not-a-type");
  const submission = parseWithZod(formData, {
    schema: notificationPreferenceSchema,
  });
  assert.equal(submission.status, "error");
}

console.log("notification preference tests passed");
