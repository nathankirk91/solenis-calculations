import { data, Link } from "react-router";

import type { Route } from "./+types/settings";

import { AppHeader } from "~/components/app-header";
import { ManagerPushSetup } from "~/components/manager-push-setup";
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
  getVapidPublicKey,
  notifyUserPush,
  userHasPushSubscription,
} from "~/lib/push.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Settings | Solenis Calculations" },
    {
      name: "description",
      content: "Manager settings for push notifications.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireReviewer(request, "/settings");
  const [pendingCount, vapidPublicKey, pushSubscribed] = await Promise.all([
    countPendingRuns(),
    Promise.resolve(getVapidPublicKey()),
    userHasPushSubscription(user.id),
  ]);

  return { user, pendingCount, vapidPublicKey, pushSubscribed };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireReviewer(request, "/settings");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent !== "test-push") {
    return data({ error: "Unknown action." }, { status: 400 });
  }

  const result = await notifyUserPush(user.id, {
    title: "Solenis Calculations test",
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
  const { user, pendingCount, vapidPublicKey, pushSubscribed } = loaderData;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_oklch(0.97_0.02_220),_transparent_55%),linear-gradient(180deg,_oklch(0.99_0.01_220),_oklch(0.96_0.015_200))]">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Management</Badge>
            <Link
              to="/"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← All calculators
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Settings
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Manage notification preferences for this manager account.
          </p>
        </div>

        <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500">
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Subscribe this device to push alerts when operators submit
              calculations for approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ManagerPushSetup
              vapidPublicKey={vapidPublicKey}
              initiallySubscribed={pushSubscribed}
              testResult={
                actionData && "message" in actionData
                  ? actionData.message
                  : null
              }
              testError={
                actionData && "error" in actionData ? actionData.error : null
              }
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
