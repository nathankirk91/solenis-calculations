import { Link } from "react-router";

import type { Route } from "./+types/history";

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
import {
  listCalculationHistory,
  type CalculationRunStatus,
} from "~/lib/history.server";
import {
  listInspectionHistory,
  type InspectionRunStatus,
} from "~/lib/inspections.server";
import { canReviewRuns } from "~/lib/roles";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "History | Springvale Solenis" },
    {
      name: "description",
      content:
        "Previous calculations and inspections with status and Melbourne timestamps.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, "/history");
  const [runs, inspections, pendingCount] = await Promise.all([
    listCalculationHistory(),
    listInspectionHistory(),
    canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
  ]);

  return { user, runs, inspections, pendingCount };
}

export default function HistoryPage({ loaderData }: Route.ComponentProps) {
  const { user, runs, inspections, pendingCount } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">History</Badge>
            <Link
              to="/"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Home
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            History
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Past calculation approvals and completed inspections, with Melbourne
            timestamps.
          </p>
        </div>

        <section className="mb-14" aria-labelledby="calc-history-heading">
          <h2
            id="calc-history-heading"
            className="mb-4 font-heading text-2xl font-semibold tracking-tight text-brand-navy"
          >
            Calculations
          </h2>
          {runs.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No calculations yet</CardTitle>
                <CardDescription>
                  Submitted calculations will appear here with their approval
                  status.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4">
              {runs.map((run, index) => {
                const submittedAt = formatMelbourneDateTime(run.createdAt);
                const reviewedAt = formatMelbourneDateTime(run.reviewedAt);
                const reviewer =
                  run.reviewedByName?.trim() ||
                  run.reviewedByEmail ||
                  null;

                return (
                  <Card
                    key={run.id}
                    className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
                    style={{ animationDelay: `${60 + index * 30}ms` }}
                  >
                    <CardHeader className="gap-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-xl">
                            <Link
                              to={`/submissions/${run.id}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {run.calculationTitle}
                            </Link>
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Operator: {run.operatorName ?? "Unknown"}
                            {submittedAt ? ` · Submitted ${submittedAt}` : null}
                          </CardDescription>
                        </div>
                        <StatusBadge status={run.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Stat
                          label="Extra DETA"
                          value={`${run.outputs.extraDetaKg ?? "—"} kg`}
                          emphasize
                        />
                        <Stat
                          label="Target DETA"
                          value={`${run.outputs.targetDetaKg ?? "—"} kg`}
                        />
                        <Stat
                          label="DETA total"
                          value={`${run.loads.detaChargedKg} kg`}
                        />
                        <Stat
                          label="Adipic total"
                          value={`${run.loads.adipicAcidKg} kg`}
                        />
                      </dl>

                      <div className="rounded-lg border border-border/70 bg-background/50 p-4">
                        <h3 className="text-sm font-medium">Approval</h3>
                        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                          <div className="flex justify-between gap-3 sm:block">
                            <dt className="text-muted-foreground">Status</dt>
                            <dd className="font-medium capitalize">
                              {run.status.toLowerCase()}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3 sm:block">
                            <dt className="text-muted-foreground">
                              Reviewed by
                            </dt>
                            <dd className="font-medium">
                              {run.status === "PENDING"
                                ? "—"
                                : reviewer ?? "Unknown"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3 sm:block">
                            <dt className="text-muted-foreground">
                              Reviewed at (Melbourne)
                            </dt>
                            <dd className="font-medium tabular-nums">
                              {run.status === "PENDING"
                                ? "—"
                                : reviewedAt ?? "—"}
                            </dd>
                          </div>
                          {run.status === "REJECTED" && run.reviewNote ? (
                            <div className="sm:col-span-2">
                              <dt className="text-muted-foreground">
                                Rejection note
                              </dt>
                              <dd className="mt-1 font-medium">
                                {run.reviewNote}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <LoadBreakdown
                          title="DETA loads (IBC / pallet)"
                          emptyLabel="No DETA loads recorded."
                          totalLabel="DETA total"
                          totalKg={run.loads.detaChargedKg}
                          rows={run.loads.detaLoads.map((kg, loadIndex) => ({
                            label: `DETA load ${loadIndex + 1}`,
                            kg,
                          }))}
                        />
                        <LoadBreakdown
                          title="Adipic Acid mix"
                          emptyLabel="No Adipic Acid weights recorded."
                          totalLabel="Adipic total"
                          totalKg={run.loads.adipicAcidKg}
                          rows={run.loads.adipicBags.map((kg, bagIndex) => ({
                            label: `Adipic ${bagIndex + 1}`,
                            kg,
                          }))}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section aria-labelledby="inspection-history-heading">
          <h2
            id="inspection-history-heading"
            className="mb-4 font-heading text-2xl font-semibold tracking-tight text-brand-navy"
          >
            Inspections
          </h2>
          {inspections.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No inspections yet</CardTitle>
                <CardDescription>
                  Completed checklists will appear here with pass / needs
                  attention status.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4">
              {inspections.map((run, index) => {
                const submittedAt = formatMelbourneDateTime(run.createdAt);

                return (
                  <Card
                    key={run.id}
                    className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
                    style={{ animationDelay: `${60 + index * 30}ms` }}
                  >
                    <CardHeader className="gap-2">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-xl">
                            <Link
                              to={`/inspections/submissions/${run.id}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {run.inspectionTitle}
                            </Link>
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Operator: {run.operatorName ?? "Unknown"}
                            {run.equipmentRef
                              ? ` · ${run.equipmentRef}`
                              : null}
                            {submittedAt ? ` · ${submittedAt}` : null}
                          </CardDescription>
                        </div>
                        <InspectionStatusBadge status={run.status} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <dl className="grid gap-3 sm:grid-cols-3">
                        <Stat
                          label="OK"
                          value={String(run.summary.okCount)}
                        />
                        <Stat
                          label="Needs attention"
                          value={String(run.summary.attentionCount)}
                          emphasize={run.summary.attentionCount > 0}
                        />
                        <Stat
                          label="N/A"
                          value={String(run.summary.naCount)}
                        />
                      </dl>
                      {run.summary.attentionItems.length > 0 ? (
                        <ul className="mt-4 grid gap-1 text-sm text-amber-900">
                          {run.summary.attentionItems.map((item) => (
                            <li key={item.itemId}>• {item.label}</li>
                          ))}
                        </ul>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: CalculationRunStatus }) {
  return (
    <Badge
      variant={status === "PENDING" ? "secondary" : "outline"}
      className={cn(
        status === "APPROVED" &&
          "border-emerald-600/40 text-emerald-700 dark:text-emerald-400",
        status === "REJECTED" && "border-destructive/40 text-destructive",
      )}
    >
      {status === "PENDING"
        ? "Pending"
        : status === "APPROVED"
          ? "Approved"
          : "Rejected"}
    </Badge>
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

function LoadBreakdown({
  title,
  emptyLabel,
  totalLabel,
  totalKg,
  rows,
}: {
  title: string;
  emptyLabel: string;
  totalLabel: string;
  totalKg: number;
  rows: Array<{ label: string; kg: number }>;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/50 p-4">
      <h3 className="font-medium">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {rows.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium tabular-nums">{row.kg} kg</span>
            </li>
          ))}
          <li className="mt-1 flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-sm font-semibold">
            <span>{totalLabel}</span>
            <span className="tabular-nums">{totalKg} kg</span>
          </li>
        </ul>
      )}
    </div>
  );
}
