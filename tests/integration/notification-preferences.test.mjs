import assert from "node:assert/strict";
import { parseWithZod } from "@conform-to/zod/v4";

/**
 * Integration: notification preference schema and merge rules used by
 * Settings → Notifications and push sends.
 */
const {
  NOTIFICATION_TYPE_IDS,
  defaultNotificationPreferences,
  isNotificationEnabled,
  mergeNotificationPreferences,
  notificationPreferenceSchema,
  notificationPreferenceToggleSchema,
  preferenceRowsFromEnabledTypes,
} = await import("../../app/lib/notification-preferences.ts");

{
  const prefs = defaultNotificationPreferences();
  assert.equal(
    NOTIFICATION_TYPE_IDS.every((type) => prefs[type] === true),
    true,
    "new devices / missing rows default to every alert type enabled",
  );
}

{
  const optedOut = mergeNotificationPreferences([
    { type: "permit.pending_authorization", enabled: false },
  ]);
  assert.equal(
    isNotificationEnabled(optedOut, "permit.pending_authorization"),
    false,
  );
  assert.equal(isNotificationEnabled(optedOut, "inspection.needs_attention"), true);
  assert.equal(isNotificationEnabled(optedOut, "calculation.pending"), true);
}

{
  const formData = new FormData();
  formData.append("types", "calculation.pending");
  formData.append("types", "permit.pending_authorization");
  formData.append("types", "inspection.new_actions");
  const submission = parseWithZod(formData, {
    schema: notificationPreferenceSchema,
  });
  assert.equal(submission.status, "success");
  if (submission.status !== "success") {
    throw new Error("expected success");
  }
  const rows = preferenceRowsFromEnabledTypes(submission.value.types);
  const prefs = mergeNotificationPreferences(rows);
  assert.equal(prefs["calculation.pending"], true);
  assert.equal(prefs["permit.pending_authorization"], true);
  assert.equal(prefs["inspection.needs_attention"], false);
  assert.equal(prefs["inspection.new_actions"], true);
}

{
  const formData = new FormData();
  formData.set("type", "inspection.needs_attention");
  formData.set("enabled", "false");
  const submission = parseWithZod(formData, {
    schema: notificationPreferenceToggleSchema,
  });
  assert.equal(submission.status, "success");
  if (submission.status === "success") {
    assert.equal(submission.value.type, "inspection.needs_attention");
    assert.equal(submission.value.enabled, false);
  }
}

console.log("notification preference integration tests passed");
