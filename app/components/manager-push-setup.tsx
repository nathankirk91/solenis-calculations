import { useEffect, useState } from "react";
import { Form, useNavigation } from "react-router";

import { Button } from "~/components/ui/button";

type Props = {
  vapidPublicKey: string | null;
  initiallySubscribed: boolean;
  testResult?: string | null;
  testError?: string | null;
};

type Status =
  | "loading"
  | "unsupported"
  | "denied"
  | "ready"
  | "subscribed"
  | "error";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registerServiceWorker() {
  return navigator.serviceWorker.register("/sw.js");
}

export function ManagerPushSetup({
  vapidPublicKey,
  initiallySubscribed,
  testResult,
  testError,
}: Props) {
  const navigation = useNavigation();
  const isTesting =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "test-push";

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (
        !vapidPublicKey ||
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) {
          setStatus("unsupported");
          setMessage(
            vapidPublicKey
              ? "Push notifications are not supported in this browser."
              : "Push notifications are not configured on the server yet (VAPID keys missing).",
          );
        }
        return;
      }

      try {
        await registerServiceWorker();
        const permission = Notification.permission;
        if (permission === "denied") {
          if (!cancelled) {
            setStatus("denied");
            setMessage(
              "Notifications are blocked in browser settings for this site.",
            );
          }
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setStatus(existing || initiallySubscribed ? "subscribed" : "ready");
          setMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not set up push notifications.",
          );
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [initiallySubscribed, vapidPublicKey]);

  async function enablePush() {
    if (!vapidPublicKey) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        setMessage("Notification permission was not granted.");
        return;
      }

      const registration = await registerServiceWorker();
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const response = await fetch("/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "Could not save subscription.");
      }

      setStatus("subscribed");
      setMessage("This device will receive approval push notifications.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not enable push notifications.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setMessage(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
        await subscription.unsubscribe();
      }
      setStatus("ready");
      setMessage("Push notifications disabled on this device.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not disable push notifications.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <p className="text-sm text-muted-foreground">
        Checking notification support…
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="font-medium">Phone push notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enable on this phone or computer, then use Send test notification to
          confirm it works. Install the site to your home screen for the best
          phone experience.
        </p>
      </div>

      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
      {testResult ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {testResult}
        </p>
      ) : null}
      {testError ? (
        <p className="text-sm text-destructive">{testError}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status === "subscribed" ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={busy || isTesting}
              onClick={() => void disablePush()}
            >
              {busy ? "Updating…" : "Disable on this device"}
            </Button>
            <Form method="post">
              <Button
                type="submit"
                name="intent"
                value="test-push"
                disabled={busy || isTesting}
              >
                {isTesting ? "Sending…" : "Send test notification"}
              </Button>
            </Form>
          </>
        ) : (
          <Button
            type="button"
            disabled={busy || status === "unsupported" || status === "denied"}
            onClick={() => void enablePush()}
          >
            {busy ? "Enabling…" : "Enable on this device"}
          </Button>
        )}
      </div>
    </div>
  );
}
