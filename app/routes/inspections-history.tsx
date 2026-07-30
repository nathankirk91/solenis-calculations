import { Form, Link, useNavigation } from "react-router";

import type { Route } from "./+types/inspections-history";

import { AppHeader } from "~/components/app-header";
import { ForkliftDayDashboardCard } from "~/components/forklift-day-dashboard";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import {
  formatMelbourneDate,
  formatMelbourneTime,
  melbourneDateYmd,
  parseYmd,
} from "~/lib/datetime";
import {
  parseInspectionHistorySort,
  type InspectionHistorySort,
} from "~/lib/inspection-history";
import {
  listForkliftChecksForDay,
  listInspectionHistory,
  type InspectionRunStatus,
} from "~/lib/inspections.server";
import { canReviewRuns } from "~/lib/roles";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Inspection records | Springvale Solenis" },
    {
      name: "description",
      content:
        "Completed inspection checklists with pass / needs-attention status and actions raised.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, "/inspections/history");
  const url = new URL(request.url);
  const date =
    parseYmd(url.searchParams.get("date")) ?? melbourneDateYmd();
  const sort = parseInspectionHistorySort(url.searchParams.get("sort"));

  const [inspections, forkliftDay, pendingCount] = await Promise.all([
    listInspectionHistory({ date, sort, limit: 100 }),
    listForkliftChecksForDay(date),
    canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
  ]);

  return { user, inspections, forkliftDay, pendingCount, date, sort };
}

const SORT_OPTIONS: Array<{ value: InspectionHistorySort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "attention", label: "Needs attention first" },
  { value: "actions", label: "Actions raised first" },
];

export default function InspectionsHistoryPage({
  loaderData,
}: Route.ComponentProps) {
  const { user, inspections, forkliftDay, pendingCount, date, sort } =
    loaderData;
  const navigation = useNavigation();
  const filtering = navigation.state !== "idle";

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Inspections</Badge>
            <Link
              to="/inspections"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Inspections
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Inspection records
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            See which forklifts were checked on a given day, filter records by
            date, and surface runs that need attention or have actions raised.
          </p>
        </div>

        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <ForkliftDayDashboardCard
            dashboard={forkliftDay}
            filterAction="/inspections/history"
            hiddenFields={{ sort }}
          />
        </div>

        <Form
          method="get"
          className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border/70 bg-background/60 p-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="records-date">Filter by date</Label>
            <Input
              id="records-date"
              name="date"
              type="date"
              defaultValue={date}
              className="w-auto"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="records-sort">Sort</Label>
            <select
              id="records-sort"
              name="sort"
              defaultValue={sort}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="secondary" disabled={filtering}>
            {filtering ? "Updating…" : "Apply"}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/inspections/history">Today</Link>
          </Button>
        </Form>

        {inspections.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No inspections for this day</CardTitle>
              <CardDescription>
                Try another date, or complete a checklist to see it here.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4">
            {inspections.map((run, index) => {
              const dayLabel = formatMelbourneDate(run.createdAt);
              const timeLabel = formatMelbourneTime(run.createdAt);

              return (
                <Card
                  key={run.id}
                  className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
                  style={{ animationDelay: `${60 + index * 30}ms` }}
                >
                  <CardHeader className="gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-heading text-2xl font-semibold tracking-tight text-brand-navy sm:text-3xl">
                          {dayLabel}
                          {timeLabel ? (
                            <span className="ml-2 text-lg font-medium text-muted-foreground sm:text-xl">
                              {timeLabel}
                            </span>
                          ) : null}
                        </p>
                        <CardTitle className="mt-2 text-lg">
                          <Link
                            to={`/inspections/submissions/${run.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {run.inspectionTitle}
                          </Link>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Operator: {run.operatorName ?? "Unknown"}
                          {run.equipmentRef ? ` · ${run.equipmentRef}` : null}
                        </CardDescription>
                      </div>
                      <InspectionStatusBadge status={run.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid gap-3 sm:grid-cols-3">
                      <Stat
                        label="Answered"
                        value={String(run.summary.answeredCount)}
                      />
                      <Stat
                        label="Needs attention"
                        value={String(run.summary.attentionCount)}
                        emphasize={run.summary.attentionCount > 0}
                      />
                      <Stat
                        label="Actions raised"
                        value={String(run.actionCount)}
                        emphasize={run.actionCount > 0}
                        emphasizeClassName="text-sky-800"
                      />
                    </dl>
                    {run.summary.attentionItems.length > 0 ? (
                      <ul className="mt-4 grid gap-1 text-sm text-amber-900">
                        {run.summary.attentionItems.map((item) => (
                          <li key={item.itemId}>
                            • {item.label}
                            {item.answer ? ` (${item.answer})` : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function InspectionStatusBadge({ status }: { status: InspectionRunStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === "PASSED" && "border-emerald-600/40 text-emerald-700",
        status === "NEEDS_ATTENTION" && "border-amber-600/40 text-amber-800",
      )}
    >
      {status === "PASSED" ? "Passed" : "Needs attention"}
    </Badge>
  );
}

function Stat({
  label,
  value,
  emphasize = false,
  emphasizeClassName = "text-amber-800",
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  emphasizeClassName?: string;
}) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={
          emphasize
            ? cn(
                "font-heading text-2xl font-semibold tabular-nums",
                emphasizeClassName,
              )
            : "font-heading text-lg font-semibold tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}
