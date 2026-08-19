import { Form, Link, useNavigation } from "react-router";

import type { Route } from "./+types/inspection-submission";

import { pageTitle } from "~/lib/brand";
import { AppHeader } from "~/components/app-header";
import { DownloadPdfLink } from "~/components/download-pdf-link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { formatMelbourneDateTime } from "~/lib/datetime";
import {
  formatLastAnswerDisplay,
  type InspectionAnswerRecord,
  type InspectionQuestionType,
} from "~/lib/inspections";
import {
  closeInspectionAction,
  getInspectionRunById,
  type InspectionActionItem,
} from "~/lib/inspections.server";
import { canReviewRuns } from "~/lib/roles";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Inspection submission") },
    {
      name: "description",
      content: "Recorded plant inspection checklist results.",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(
    request,
    `/inspections/submissions/${params.runId}`,
  );
  const run = await getInspectionRunById(params.runId);

  if (!run) {
    throw new Response("Inspection submission not found", { status: 404 });
  }

  const pendingCount = canReviewRuns(user.role)
    ? await countPendingRuns()
    : 0;

  return {
    user,
    run,
    pendingCount,
    canCloseActions: canReviewRuns(user.role),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(
    request,
    `/inspections/submissions/${params.runId}`,
  );

  if (!canReviewRuns(user.role)) {
    return {
      ok: false as const,
      error: "Only managers can close actions.",
      actionId: null as string | null,
    };
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  if (intent !== "close-action") {
    return {
      ok: false as const,
      error: "Unknown action.",
      actionId: null as string | null,
    };
  }

  const actionId = String(formData.get("actionId") ?? "").trim();
  const completionComment = String(
    formData.get("completionComment") ?? "",
  ).trim();

  if (!actionId) {
    return {
      ok: false as const,
      error: "Action not found.",
      actionId: null as string | null,
    };
  }

  const run = await getInspectionRunById(params.runId);
  if (!run) {
    throw new Response("Inspection submission not found", { status: 404 });
  }

  const belongsToRun = run.actions.some((item) => item.id === actionId);
  if (!belongsToRun) {
    return {
      ok: false as const,
      error: "That action does not belong to this submission.",
      actionId,
    };
  }

  const result = await closeInspectionAction({
    actionId,
    closedByUserId: user.id,
    completionComment,
  });

  if (!result.ok) {
    return { ok: false as const, error: result.error, actionId };
  }

  return { ok: true as const, error: null as string | null, actionId };
}

export default function InspectionSubmissionPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, run, pendingCount, canCloseActions } = loaderData;
  const submittedAt = formatMelbourneDateTime(run.createdAt);
  const needsAttention = run.status === "NEEDS_ATTENTION";
  const openActionCount = run.actions.filter(
    (item) => item.status === "OPEN",
  ).length;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Inspection</Badge>
            <Link
              to="/inspections"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Inspections
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {needsAttention
              ? "Inspection needs attention"
              : "Inspection recorded"}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {needsAttention
              ? "One or more answers were flagged for follow-up. Managers have been notified."
              : openActionCount > 0
                ? "This inspection passed. Open actions still need manager follow-up."
                : "This inspection passed. The record is saved in history."}
          </p>
        </div>

        <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">
                  {run.inspectionTitle}
                </CardTitle>
                <CardDescription className="mt-1">
                  Operator: {run.operatorName ?? "Unknown"}
                  {run.equipmentRef ? ` · ${run.equipmentRef}` : null}
                  {submittedAt ? ` · ${submittedAt}` : null}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    !needsAttention &&
                      "border-emerald-600/40 text-emerald-700",
                    needsAttention && "border-amber-600/40 text-amber-800",
                  )}
                >
                  {needsAttention ? "Needs attention" : "Passed"}
                </Badge>
                <DownloadPdfLink
                  href={`/inspections/submissions/${run.id}/pdf`}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Stat
                label="Answered"
                value={String(run.summary.answeredCount)}
              />
              <Stat
                label="Needs attention"
                value={String(run.summary.attentionCount)}
                emphasize={run.summary.attentionCount > 0}
              />
            </dl>

            {run.summary.attentionItems.length > 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-50/80 p-4">
                <h3 className="text-sm font-medium text-amber-900">
                  Follow-up items
                </h3>
                <ul className="mt-2 grid gap-1 text-sm text-amber-950/90">
                  {run.summary.attentionItems.map((item) => (
                    <li key={item.itemId}>
                      {item.sectionTitle ? (
                        <span className="text-amber-800/70">
                          {item.sectionTitle}:{" "}
                        </span>
                      ) : null}
                      {item.label}
                      {item.answer ? ` — ${item.answer}` : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {run.actions.length > 0 ? (
              <div className="rounded-lg border border-border/70 bg-background/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">Actions</h3>
                  {openActionCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="border-amber-600/40 text-amber-800"
                    >
                      {openActionCount} open
                    </Badge>
                  ) : null}
                </div>
                <ul className="mt-4 grid gap-4">
                  {run.actions.map((item) => (
                    <ActionRow
                      key={item.id}
                      action={item}
                      canClose={canCloseActions}
                      error={
                        actionData &&
                        !actionData.ok &&
                        actionData.actionId === item.id
                          ? actionData.error
                          : null
                      }
                    />
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-4">
              {groupAnswersBySection(run.answers).map((group) => (
                <div
                  key={group.title ?? "general"}
                  className="rounded-lg border border-border/70 bg-background/50 p-4"
                >
                  {group.title ? (
                    <h3 className="font-medium">{group.title}</h3>
                  ) : (
                    <h3 className="font-medium">Answers</h3>
                  )}
                  <ul className="mt-3 grid gap-2">
                    {group.rows.map((row) => (
                      <li
                        key={row.questionId}
                        className="flex flex-wrap items-start justify-between gap-2 text-sm"
                      >
                        <span className="text-muted-foreground">
                          {row.label}
                        </span>
                        <AnswerBadge
                          answer={row.answer}
                          flagged={row.flagged}
                          type={row.type}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {run.notes ? (
              <div className="rounded-lg border border-border/70 bg-background/50 p-4 text-sm">
                <p className="font-medium">Notes</p>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {run.notes}
                </p>
              </div>
            ) : null}

            {run.signature ? (
              <div className="rounded-lg border border-border/70 bg-background/50 p-4">
                <p className="text-sm font-medium">Operator signature</p>
                <div className="mt-2">
                  <img
                    src={run.signature}
                    alt="Operator signature"
                    className="h-24 w-auto rounded border border-border/50 bg-white object-contain sm:h-32"
                  />
                </div>
              </div>
            ) : null}

            <p className="text-sm text-muted-foreground">
              <Link
                to={run.inspectionHref}
                className="underline-offset-4 hover:underline"
              >
                Run this inspection again
              </Link>
              {" · "}
              <Link
                to="/inspections/history"
                className="underline-offset-4 hover:underline"
              >
                View history
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function ActionRow({
  action,
  canClose,
  error,
}: {
  action: InspectionActionItem;
  canClose: boolean;
  error: string | null;
}) {
  const navigation = useNavigation();
  const isClosing =
    navigation.state !== "idle" &&
    navigation.formData?.get("intent") === "close-action" &&
    navigation.formData?.get("actionId") === action.id;
  const isOpen = action.status === "OPEN";

  return (
    <li className="rounded-lg border border-border/60 bg-background/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="whitespace-pre-wrap text-sm">{action.description}</p>
        <Badge
          variant="outline"
          className={cn(
            isOpen
              ? "border-amber-600/40 text-amber-800"
              : "border-emerald-600/40 text-emerald-700",
          )}
        >
          {isOpen ? "Open" : "Closed"}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Reported {formatMelbourneDateTime(action.createdAt)}
        {action.createdByOperatorName
          ? ` · ${action.createdByOperatorName}`
          : ""}
      </p>
      {!isOpen ? (
        <div className="mt-3 rounded-md border border-emerald-600/20 bg-emerald-50/70 p-3 text-sm">
          <p className="font-medium text-emerald-900">Completed</p>
          <p className="mt-1 whitespace-pre-wrap text-emerald-950/90">
            {action.completionComment || "—"}
          </p>
          <p className="mt-2 text-xs text-emerald-900/70">
            Closed {formatMelbourneDateTime(action.closedAt)}
            {action.closedByName ? ` · ${action.closedByName}` : ""}
          </p>
        </div>
      ) : null}
      {isOpen && canClose ? (
        <Form method="post" className="mt-3 grid gap-2">
          <input type="hidden" name="intent" value="close-action" />
          <input type="hidden" name="actionId" value={action.id} />
          <Label htmlFor={`completion-${action.id}`}>
            Completion comment
          </Label>
          <textarea
            id={`completion-${action.id}`}
            name="completionComment"
            required
            rows={2}
            className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="What was completed to close this action?"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" size="sm" disabled={isClosing} className="w-fit">
            {isClosing ? "Closing…" : "Close action"}
          </Button>
        </Form>
      ) : null}
      {isOpen && !canClose ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Waiting for a manager to complete and close this action.
        </p>
      ) : null}
    </li>
  );
}

function Stat({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={
          emphasize
            ? "font-heading text-2xl font-semibold tabular-nums text-amber-800"
            : "font-heading text-lg font-semibold tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function AnswerBadge({
  answer,
  flagged,
  type,
}: {
  answer: string;
  flagged: boolean;
  type: InspectionQuestionType;
}) {
  const display = answer
    ? formatLastAnswerDisplay(answer, type)
    : "—";
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full shrink-0 whitespace-normal text-left",
        flagged
          ? "border-amber-600/40 text-amber-800"
          : "border-emerald-600/40 text-emerald-700",
      )}
    >
      {display}
    </Badge>
  );
}

function groupAnswersBySection(rows: InspectionAnswerRecord[]) {
  const groups: Array<{
    title: string | null;
    rows: InspectionAnswerRecord[];
  }> = [];

  for (const row of rows) {
    const title = row.sectionTitle;
    const existing = groups.find((group) => group.title === title);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.push({ title, rows: [row] });
    }
  }

  return groups;
}
