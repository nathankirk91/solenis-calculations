export type TeamsApprovalNotification = {
  calculationTitle: string;
  operatorName: string;
  extraDetaKg: number;
  targetDetaKg: number;
  detaChargedKg: number;
  adipicAcidKg: number;
  detaLoads: number[];
  adipicBags: number[];
  approvalsUrl: string;
  submittedAt: Date;
};

/**
 * Teams Workflows / Incoming Webhook Adaptive Card payload.
 * Compatible with "Post to a channel when a webhook request is received".
 */
export function buildTeamsApprovalPayload(notification: TeamsApprovalNotification) {
  const submittedAt = notification.submittedAt.toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Melbourne",
  });

  const detaBreakdown = notification.detaLoads
    .map((kg, index) => `Load ${index + 1}: ${kg} kg`)
    .join("\n");
  const adipicBreakdown = notification.adipicBags
    .map((kg, index) => `Adipic ${index + 1}: ${kg} kg`)
    .join("\n");

  const summary = `${notification.calculationTitle} — Extra DETA ${notification.extraDetaKg} kg (operator ${notification.operatorName})`;

  return {
    type: "message",
    summary,
    // Plain fields help some Workflow templates that map webhook JSON directly.
    title: "Calculation pending approval",
    text: summary,
    calculationTitle: notification.calculationTitle,
    operatorName: notification.operatorName,
    extraDetaKg: notification.extraDetaKg,
    approvalsUrl: notification.approvalsUrl,
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              size: "Large",
              weight: "Bolder",
              text: "Calculation pending approval",
            },
            {
              type: "TextBlock",
              text: notification.calculationTitle,
              wrap: true,
              weight: "Bolder",
            },
            {
              type: "FactSet",
              facts: [
                { title: "Operator", value: notification.operatorName },
                { title: "Submitted", value: submittedAt },
                {
                  title: "Extra DETA",
                  value: `${notification.extraDetaKg} kg`,
                },
                {
                  title: "Target DETA",
                  value: `${notification.targetDetaKg} kg`,
                },
                {
                  title: "DETA charged",
                  value: `${notification.detaChargedKg} kg`,
                },
                {
                  title: "Adipic charged",
                  value: `${notification.adipicAcidKg} kg`,
                },
              ],
            },
            {
              type: "TextBlock",
              text: "DETA loads",
              weight: "Bolder",
              spacing: "Medium",
            },
            {
              type: "TextBlock",
              text: detaBreakdown || "None",
              wrap: true,
              fontType: "Monospace",
            },
            {
              type: "TextBlock",
              text: "Adipic Acid mix",
              weight: "Bolder",
              spacing: "Medium",
            },
            {
              type: "TextBlock",
              text: adipicBreakdown || "None",
              wrap: true,
              fontType: "Monospace",
            },
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: "Open approvals",
              url: notification.approvalsUrl,
            },
          ],
        },
      },
    ],
  };
}

export function getAppBaseUrl(request: Request): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) {
    return `https://${productionHost.replace(/^https?:\/\//, "")}`;
  }

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    return `https://${vercelHost.replace(/^https?:\/\//, "")}`;
  }

  return new URL(request.url).origin;
}

/**
 * Best-effort Teams notify. Never throws — approval submit must still succeed.
 */
export async function notifyTeamsPendingApproval(
  notification: TeamsApprovalNotification,
): Promise<{ sent: boolean; reason?: string }> {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    console.warn("Teams notification skipped: TEAMS_WEBHOOK_URL is not set");
    return { sent: false, reason: "TEAMS_WEBHOOK_URL is not set" };
  }

  const payload = buildTeamsApprovalPayload(notification);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        "Teams webhook failed",
        response.status,
        body.slice(0, 500),
      );
      return {
        sent: false,
        reason: `Teams webhook HTTP ${response.status}`,
      };
    }

    return { sent: true };
  } catch (error) {
    console.error("Teams webhook error", error);
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "Teams webhook error",
    };
  }
}
