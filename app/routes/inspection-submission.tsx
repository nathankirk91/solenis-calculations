import { Link } from "react-router";

import type { Route } from "./+types/inspection-submission";

import { AppHeader } from "~/components/app-header";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { formatMelbourneDateTime } from "~/lib/datetime";
import { getInspectionRunById } from "~/lib/inspections.server";
import { canReviewRuns } from "~/lib/roles";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Inspection submission | Springvale Solenis" },
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

  return { user, run, pendingCount };
}

export default function InspectionSubmissionPage({
  loaderData,
}: Route.ComponentProps) {
  const { user, run, pendingCount } = loaderData;
  const submittedAt = formatMelbourneDateTime(run.createdAt);
  const needsAttention = run.status === "NEEDS_ATTENTION";

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Inspection</Badge>
            <Link
              to="/#inspections"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← All tools
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {needsAttention
              ? "Inspection needs attention"
              : "Inspection recorded"}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {needsAttention
              ? "One or more checklist items were marked for follow-up. Managers have been notified."
              : "All checked items passed. This record is saved in history."}
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
            </div>
          </CardHeader>
          <CardContent className="grid gap-6">
            <dl className="grid gap-3 sm:grid-cols-3">
              <Stat label="OK" value={String(run.summary.okCount)} />
              <Stat
                label="Needs attention"
                value={String(run.summary.attentionCount)}
                emphasize={run.summary.attentionCount > 0}
              />
              <Stat label="N/A" value={String(run.summary.naCount)} />
            </dl>

            {run.summary.attentionItems.length > 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-50/80 p-4">
                <h3 className="text-sm font-medium text-amber-900">
                  Follow-up items
                </h3>
                <ul className="mt-2 grid gap-1 text-sm text-amber-950/90">
                  {run.summary.attentionItems.map((item) => (
                    <li key={item.itemId}>
                      <span className="text-amber-800/70">
                        {item.sectionTitle}:
                      </span>{" "}
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-4">
              {groupBySection(run.responseRows).map((group) => (
                <div
                  key={group.title}
                  className="rounded-lg border border-border/70 bg-background/50 p-4"
                >
                  <h3 className="font-medium">{group.title}</h3>
                  <ul className="mt-3 grid gap-2">
                    {group.rows.map((row) => (
                      <li
                        key={row.itemId}
                        className="flex flex-wrap items-start justify-between gap-2 text-sm"
                      >
                        <span className="text-muted-foreground">
                          {row.label}
                        </span>
                        <ResultBadge result={row.result} />
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

            <p className="text-sm text-muted-foreground">
              <Link
                to={run.inspectionHref}
                className="underline-offset-4 hover:underline"
              >
                Run this inspection again
              </Link>
              {" · "}
              <Link to="/history" className="underline-offset-4 hover:underline">
                View history
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
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

function ResultBadge({
  result,
}: {
  result: "ok" | "attention" | "na";
}) {
  const label =
    result === "ok" ? "OK" : result === "attention" ? "Needs attention" : "N/A";

  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0",
        result === "ok" && "border-emerald-600/40 text-emerald-700",
        result === "attention" && "border-amber-600/40 text-amber-800",
      )}
    >
      {label}
    </Badge>
  );
}

function groupBySection(
  rows: Array<{
    itemId: string;
    label: string;
    sectionTitle: string;
    result: "ok" | "attention" | "na";
  }>,
) {
  const groups: Array<{
    title: string;
    rows: typeof rows;
  }> = [];

  for (const row of rows) {
    const existing = groups.find((group) => group.title === row.sectionTitle);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.push({ title: row.sectionTitle, rows: [row] });
    }
  }

  return groups;
}
