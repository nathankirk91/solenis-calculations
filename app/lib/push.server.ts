import webpush from "web-push";

import { getPrisma } from "~/lib/db.server";
import { ensureDefaultNotificationPreferences } from "~/lib/notification-preferences.server";
import type { NotificationTypeId } from "~/lib/notification-preferences";

export type PushPayload = {
  title: string;
  message: string;
  url: string;
  tag?: string;
  icon?: string;
};

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:admin@solenis.local";

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

export function getVapidPublicKey(): string | null {
  return getVapidConfig()?.publicKey ?? null;
}

export function isWebPushConfigured(): boolean {
  return getVapidConfig() != null;
}

function configureWebPush() {
  const config = getVapidConfig();
  if (!config) {
    return null;
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return config;
}

export async function savePushSubscription(args: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint: args.endpoint },
    update: {
      userId: args.userId,
      p256dh: args.p256dh,
      auth: args.auth,
      userAgent: args.userAgent ?? null,
    },
    create: {
      userId: args.userId,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      userAgent: args.userAgent ?? null,
    },
  });

  // First registration (or any register with no saved prefs) opts the user into every type.
  await ensureDefaultNotificationPreferences(args.userId);

  return subscription;
}

export async function deletePushSubscription(args: {
  userId: string;
  endpoint: string;
}) {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  await prisma.pushSubscription.deleteMany({
    where: {
      userId: args.userId,
      endpoint: args.endpoint,
    },
  });
}

export async function userHasPushSubscription(userId: string): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma) {
    return false;
  }

  const count = await prisma.pushSubscription.count({
    where: { userId },
  });
  return count > 0;
}

async function sendPushToSubscriptions(
  subscriptions: Array<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; reason?: string }> {
  const prisma = getPrisma();
  if (!prisma) {
    return { sent: 0, failed: 0, reason: "Database is not configured" };
  }

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, reason: "No push subscriptions" };
  }

  const body = JSON.stringify({
    title: payload.title,
    message: payload.message,
    url: payload.url,
    tag: payload.tag,
    icon: payload.icon || "/brand/icon-192.png",
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          body,
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : null;

        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: subscription.id } })
            .catch(() => undefined);
        }

        console.error("Web push send failed", statusCode, error);
      }
    }),
  );

  return { sent, failed };
}

/**
 * Send a push to one user's devices (used for Settings test notifications).
 */
export async function notifyUserPush(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; reason?: string }> {
  const config = configureWebPush();
  if (!config) {
    return { sent: 0, failed: 0, reason: "VAPID keys are not set" };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return { sent: 0, failed: 0, reason: "Database is not configured" };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  return sendPushToSubscriptions(subscriptions, payload);
}

function subscribedToTypeFilter(type: NotificationTypeId) {
  return {
    NOT: {
      notificationPreferences: {
        some: {
          type,
          enabled: false,
        },
      },
    },
  };
}

/**
 * Best-effort push to specific users (deduped) who have this event type enabled.
 * Missing preference rows mean the user is opted in. Never throws.
 */
export async function notifyUsersPush(
  userIds: string[],
  payload: PushPayload,
  type: NotificationTypeId,
): Promise<{ sent: number; failed: number; reason?: string }> {
  const config = configureWebPush();
  if (!config) {
    console.warn("Web push skipped: VAPID keys are not set");
    return { sent: 0, failed: 0, reason: "VAPID keys are not set" };
  }

  const uniqueIds = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { sent: 0, failed: 0, reason: "No recipients" };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return { sent: 0, failed: 0, reason: "Database is not configured" };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId: { in: uniqueIds },
      user: subscribedToTypeFilter(type),
    },
  });

  return sendPushToSubscriptions(subscriptions, payload);
}

/**
 * Best-effort push to manager/admin subscriptions opted into this event type.
 * Never throws.
 */
export async function notifyManagersPush(
  payload: PushPayload,
  type: NotificationTypeId,
): Promise<{ sent: number; failed: number; reason?: string }> {
  const config = configureWebPush();
  if (!config) {
    console.warn("Web push skipped: VAPID keys are not set");
    return { sent: 0, failed: 0, reason: "VAPID keys are not set" };
  }

  const prisma = getPrisma();
  if (!prisma) {
    return { sent: 0, failed: 0, reason: "Database is not configured" };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      user: {
        role: { in: ["APPROVER", "ADMIN"] },
        ...subscribedToTypeFilter(type),
      },
    },
  });

  return sendPushToSubscriptions(subscriptions, payload);
}
