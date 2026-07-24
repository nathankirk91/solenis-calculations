import { data } from "react-router";

import type { Route } from "./+types/push-subscribe";

import { requireReviewer } from "~/lib/auth.server";
import {
  deletePushSubscription,
  savePushSubscription,
} from "~/lib/push.server";

type SubscriptionBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export async function action({ request }: Route.ActionArgs) {
  const user = await requireReviewer(request, "/approvals");

  if (request.method !== "POST" && request.method !== "DELETE") {
    return data({ error: "Method not allowed." }, { status: 405 });
  }

  let body: SubscriptionBody;
  try {
    body = (await request.json()) as SubscriptionBody;
  } catch {
    return data({ error: "Invalid JSON body." }, { status: 400 });
  }

  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();

  if (!endpoint) {
    return data({ error: "Missing subscription endpoint." }, { status: 400 });
  }

  try {
    if (request.method === "DELETE") {
      await deletePushSubscription({ userId: user.id, endpoint });
      return { ok: true as const };
    }

    if (!p256dh || !auth) {
      return data(
        { error: "Missing subscription keys." },
        { status: 400 },
      );
    }

    await savePushSubscription({
      userId: user.id,
      endpoint,
      p256dh,
      auth,
      userAgent: request.headers.get("user-agent"),
    });

    return { ok: true as const };
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update push subscription.",
      },
      { status: 500 },
    );
  }
}
