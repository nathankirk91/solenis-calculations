import { getPrisma } from "~/lib/db.server";
import { ensureInspectionSchema } from "~/lib/migrate.server";
import {
  NOTIFICATION_TYPE_IDS,
  defaultNotificationPreferences,
  mergeNotificationPreferences,
  type NotificationPreferenceMap,
  type NotificationTypeId,
} from "~/lib/notification-preferences";

async function requireNotificationPreferenceStore() {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }
  await ensureInspectionSchema();
  return prisma;
}

export async function getUserNotificationPreferences(
  userId: string,
): Promise<NotificationPreferenceMap> {
  const prisma = await requireNotificationPreferenceStore();
  if (!prisma) {
    return defaultNotificationPreferences();
  }

  const rows = await prisma.userNotificationPreference.findMany({
    where: { userId },
    select: { type: true, enabled: true },
  });

  return mergeNotificationPreferences(rows);
}

/**
 * Seed every notification type as enabled when this user has no preferences yet.
 * Called the first time a device registers for push.
 */
export async function ensureDefaultNotificationPreferences(
  userId: string,
): Promise<NotificationPreferenceMap> {
  const prisma = await requireNotificationPreferenceStore();
  if (!prisma) {
    return defaultNotificationPreferences();
  }

  const existingCount = await prisma.userNotificationPreference.count({
    where: { userId },
  });

  if (existingCount === 0) {
    await prisma.userNotificationPreference.createMany({
      data: NOTIFICATION_TYPE_IDS.map((type) => ({
        userId,
        type,
        enabled: true,
      })),
      skipDuplicates: true,
    });
  }

  return getUserNotificationPreferences(userId);
}

export async function saveUserNotificationPreferences(
  userId: string,
  prefs: NotificationPreferenceMap,
): Promise<void> {
  const prisma = await requireNotificationPreferenceStore();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  await prisma.$transaction(
    NOTIFICATION_TYPE_IDS.map((type) =>
      prisma.userNotificationPreference.upsert({
        where: { userId_type: { userId, type } },
        update: { enabled: prefs[type] !== false },
        create: {
          userId,
          type,
          enabled: prefs[type] !== false,
        },
      }),
    ),
  );
}

export async function setUserNotificationPreference(args: {
  userId: string;
  type: NotificationTypeId;
  enabled: boolean;
}): Promise<void> {
  const prisma = await requireNotificationPreferenceStore();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  await prisma.userNotificationPreference.upsert({
    where: { userId_type: { userId: args.userId, type: args.type } },
    update: { enabled: args.enabled },
    create: {
      userId: args.userId,
      type: args.type,
      enabled: args.enabled,
    },
  });
}
