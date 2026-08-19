import { parseWithZod } from "@conform-to/zod/v4";
import { data, Link } from "react-router";

import type { Route } from "./+types/settings";

import { APP_NAME, pageTitle } from "~/lib/brand";
import { AppHeader } from "~/components/app-header";
import { ManagerPushSetup } from "~/components/manager-push-setup";
import { NotificationPreferencesForm } from "~/components/notification-preferences-form";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { countPendingRuns } from "~/lib/approvals.server";
import { getAppBaseUrl } from "~/lib/app-url.server";
import { requireReviewer } from "~/lib/auth.server";
import {
  getUserNotificationPreferences,
  saveUserNotificationPreferences,
} from "~/lib/notification-preferences.server";
import {
  mergeNotificationPreferences,
  notificationPreferenceSchema,
  preferenceRowsFromEnabledTypes,
} from "~/lib/notification-preferences";
import {
  getVapidPublicKey,
  notifyUserPush,
  userHasPushSubscription,
} from "~/lib/push.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Settings") },
    {
      name: "description",
      content: "Manager settings for push notifications.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireReviewer(request, "/settings");
  const [pendingCount, vapidPublicKey, pushSubscribed, preferences] =
    await Promise.all([
      countPendingRuns(),
      Promise.resolve(getVapidPublicKey()),
      userHasPushSubscription(user.id),
      getUserNotificationPreferences(user.id),
    ]);

  return { user, pendingCount, vapidPublicKey, pushSubscribed, preferences };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireReviewer(request, "/settings");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "save-preferences") {
    const submission = parseWithZod(formData, {
      schema: notificationPreferenceSchema,
    });

    if (submission.status !== "success") {
      return data(
        {
          error: "Could not save notification preferences.",
          lastResult: submission.reply(),
        },
        { status: submission.status === "error" ? 400 : 200 },
      );
    }

    const preferences = mergeNotificationPreferences(
      preferenceRowsFromEnabledTypes(submission.value.types),
    );
    await saveUserNotificationPreferences(user.id, preferences);

    return {
      ok: true as const,
      message: "Notification preferences saved.",
      lastResult: submission.reply(),
    };
  }

  if (intent !== "test-push") {
    return data({ error: "Unknown action." }, { status: 400 });
  }

  const result = await notifyUserPush(user.id, {
    title: `${APP_NAME} test`,
    message: "Push notifications are working on this device.",
    url: `${getAppBaseUrl(request)}/settings`,
    tag: `test-${user.id}-${Date.now()}`,
  });

  if (result.sent === 0) {
    return data(
      {
        error:
          result.reason === "No push subscriptions"
            ? "Enable push on this device first, then try again."
            : result.reason || "Could not send a test notification.",
      },
      { status: 400 },
    );
  }

  return {
    ok: true as const,
    message: `Test notification sent to ${result.sent} device${result.sent === 1 ? "" : "s"}.`,
  };
}

export default function SettingsPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, pendingCount, vapidPublicKey, pushSubscribed, preferences } =
    loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Management</Badge>
            <Link
              to="/"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Home
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Settings
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Manage this account&apos;s push devices and which permit, inspection,
            and calculation alerts you receive.
          </p>
        </div>

        <div className="grid gap-4">
          <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Enable this device, then choose which event types to receive.
                Preferences are stored on your account, not per phone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ManagerPushSetup
                vapidPublicKey={vapidPublicKey}
                initiallySubscribed={pushSubscribed}
                testResult={
                  actionData &&
                  "message" in actionData &&
                  actionData.message?.startsWith("Test notification")
                    ? actionData.message
                    : null
                }
                testError={
                  actionData &&
                  "error" in actionData &&
                  !("lastResult" in actionData)
                    ? actionData.error
                    : null
                }
              />
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <CardHeader>
              <CardTitle>What you receive</CardTitle>
              <CardDescription>
                Turn off any permit, inspection, or calculation alerts you do
                not want. Changes apply immediately to this account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationPreferencesForm preferences={preferences} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
