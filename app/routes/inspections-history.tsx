import { Link } from "react-router";

import type { Route } from "./+types/inspections-history";

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
        "Completed inspection checklists with pass / needs-attention status.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, "/inspections/history");
  const [inspections, pendingCount] = await Promise.all([
    listInspectionHistory(),
    canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
  ]);

  return { user, inspections, pendingCount };
}

export default function InspectionsHistoryPage({
  loaderData,
}: Route.ComponentProps) {
  const { user, inspections, pendingCount } = loaderData;

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
            Completed checklists with pass / needs-attention status and
            Melbourne timestamps.
          </p>
        </div>

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
                          {run.equipmentRef ? ` · ${run.equipmentRef}` : null}
                          {submittedAt ? ` · ${submittedAt}` : null}
                        </CardDescription>
                      </div>
                      <InspectionStatusBadge status={run.status} />
                    </div>
                  </CardHeader>
                  <CardContent>
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
