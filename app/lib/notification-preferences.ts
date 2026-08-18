import { z } from "zod";

export const NOTIFICATION_TYPE_IDS = [
  "calculation.pending",
  "permit.pending_authorization",
  "permit.needs_attention",
  "inspection.needs_attention",
  "inspection.new_actions",
] as const;

export type NotificationTypeId = (typeof NOTIFICATION_TYPE_IDS)[number];

export type NotificationPreferenceMap = Record<NotificationTypeId, boolean>;

export type NotificationTypeDefinition = {
  id: NotificationTypeId;
  label: string;
  description: string;
};

export type NotificationCategory = {
  id: string;
  label: string;
  description: string;
  types: NotificationTypeDefinition[];
};

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    id: "calculations",
    label: "Calculations",
    description: "Alerts when operators submit polymer calculations.",
    types: [
      {
        id: "calculation.pending",
        label: "Pending approval",
        description:
          "When an operator submits a calculation that needs manager review.",
      },
    ],
  },
  {
    id: "permits",
    label: "Permits",
    description: "Alerts for permit authorisation and attention items.",
    types: [
      {
        id: "permit.pending_authorization",
        label: "Pending authorisation",
        description: "When a permit is issued and needs your sign-off.",
      },
      {
        id: "permit.needs_attention",
        label: "Needs attention",
        description: "When a permit is issued with attention items.",
      },
    ],
  },
  {
    id: "inspections",
    label: "Inspections",
    description: "Alerts for inspection follow-up.",
    types: [
      {
        id: "inspection.needs_attention",
        label: "Needs attention",
        description: "When an inspection is submitted with attention items.",
      },
      {
        id: "inspection.new_actions",
        label: "New actions",
        description:
          "When an inspection creates open follow-up actions.",
      },
    ],
  },
];

const NOTIFICATION_TYPE_ID_SET = new Set<string>(NOTIFICATION_TYPE_IDS);

export function isNotificationTypeId(value: string): value is NotificationTypeId {
  return NOTIFICATION_TYPE_ID_SET.has(value);
}

export function defaultNotificationPreferences(): NotificationPreferenceMap {
  return {
    "calculation.pending": true,
    "permit.pending_authorization": true,
    "permit.needs_attention": true,
    "inspection.needs_attention": true,
    "inspection.new_actions": true,
  };
}

export function mergeNotificationPreferences(
  rows: Array<{ type: string; enabled: boolean }>,
): NotificationPreferenceMap {
  const prefs = defaultNotificationPreferences();
  for (const row of rows) {
    if (isNotificationTypeId(row.type)) {
      prefs[row.type] = row.enabled;
    }
  }
  return prefs;
}

export function isNotificationEnabled(
  prefs: NotificationPreferenceMap | Array<{ type: string; enabled: boolean }>,
  type: NotificationTypeId,
): boolean {
  const map = Array.isArray(prefs)
    ? mergeNotificationPreferences(prefs)
    : prefs;
  return map[type] !== false;
}

export function enabledTypesFromPreferences(
  prefs: NotificationPreferenceMap,
): NotificationTypeId[] {
  return NOTIFICATION_TYPE_IDS.filter((type) => prefs[type] !== false);
}

export function preferenceRowsFromEnabledTypes(
  enabledTypes: readonly string[],
): Array<{ type: NotificationTypeId; enabled: boolean }> {
  const enabled = new Set(
    enabledTypes.filter((type): type is NotificationTypeId =>
      isNotificationTypeId(type),
    ),
  );
  return NOTIFICATION_TYPE_IDS.map((type) => ({
    type,
    enabled: enabled.has(type),
  }));
}

export const notificationPreferenceSchema = z.object({
  types: z.preprocess((value) => {
    if (value == null || value === "") {
      return [];
    }
    return Array.isArray(value) ? value : [value];
  }, z.array(z.enum(NOTIFICATION_TYPE_IDS))),
});

export const notificationPreferenceToggleSchema = z.object({
  type: z.enum(NOTIFICATION_TYPE_IDS),
  enabled: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
});
