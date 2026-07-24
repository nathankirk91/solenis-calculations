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
  | "needs-install"
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

function isIosDevice() {
  if (typeof window === "undefined") {
    return false;
  }
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const iPadOs =
    window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return iOS || iPadOs;
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari legacy standalone flag
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
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
      if (!vapidPublicKey) {
        if (!cancelled) {
          setStatus("unsupported");
          setMessage(
            "Push notifications are not configured on the server yet (VAPID keys missing on Vercel).",
          );
        }
        return;
      }

      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("Notification" in window)
      ) {
        if (!cancelled) {
          setStatus("unsupported");
          setMessage("Push notifications are not supported in this browser.");
        }
        return;
      }

      const ios = isIosDevice();
      const standalone = isStandaloneDisplay();
      const hasPushManager = "PushManager" in window;

      // iOS only supports Web Push for apps added to the Home Screen.
      if (ios && !standalone) {
        if (!cancelled) {
          setStatus("needs-install");
          setMessage(
            "On iPhone/iPad: tap Share → Add to Home Screen, open Springvale Solenis from the home screen icon, then return here and enable notifications.",
          );
        }
        return;
      }

      if (!hasPushManager) {
        if (!cancelled) {
          setStatus(ios ? "needs-install" : "unsupported");
          setMessage(
            ios
              ? "Open this site from your Home Screen app icon, then enable notifications."
              : "Push notifications are not supported in this browser.",
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
              "Notifications are blocked for this site. In browser settings, allow notifications for solenis-calculations.vercel.app, then try again.",
            );
          }
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setStatus(existing || initiallySubscribed ? "subscribed" : "ready");
          setMessage(
            permission === "default"
              ? "Tap Enable on this device — your browser will ask for notification permission."
              : null,
          );
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
      setMessage(
        "Push notifications are not configured on the server yet (VAPID keys missing on Vercel).",
      );
      return;
    }

    setBusy(true);
    setMessage(
      "Your browser should now ask for notification permission. Choose Allow.",
    );

    try {
      if (!("Notification" in window)) {
        throw new Error("Notifications API is not available in this browser.");
      }

      // Must be called directly from the user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        setMessage(
          permission === "denied"
            ? "Permission denied. Allow notifications for this site in browser settings, then try again."
            : "Notification permission was not granted.",
        );
        return;
      }

      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error(
          isIosDevice()
            ? "Open the app from your Home Screen icon first, then enable notifications."
            : "PushManager is not available in this browser.",
        );
      }

      const registration = await registerServiceWorker();
      await navigator.serviceWorker.ready;

      // Wait briefly for the active worker on some mobile browsers.
      if (!registration.active) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

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
      setMessage(
        "Permission granted. This device will receive approval push notifications.",
      );
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
          confirm it works.
        </p>
      </div>

      {status === "needs-install" ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Open this site in Safari on your iPhone/iPad.</li>
          <li>Tap Share, then Add to Home Screen.</li>
          <li>Open Springvale Solenis from the new home screen icon.</li>
          <li>Return to Settings and tap Enable on this device.</li>
        </ol>
      ) : null}

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
            disabled={
              busy ||
              status === "unsupported" ||
              (status === "needs-install" && isIosDevice() && !isStandaloneDisplay())
            }
            onClick={() => void enablePush()}
          >
            {busy
              ? "Waiting for permission…"
              : status === "denied"
                ? "Try enable again"
                : "Enable on this device"}
          </Button>
        )}
      </div>

      {status !== "subscribed" && status !== "unsupported" ? (
        <p className="text-xs text-muted-foreground">
          Enabling asks your browser/OS for notification access. You must tap
          Allow on that prompt.
        </p>
      ) : null}
    </div>
  );
}
