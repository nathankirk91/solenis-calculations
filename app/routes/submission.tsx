import { useEffect, useState } from "react";
import { Link, useNavigate, useRevalidator } from "react-router";

import type { Route } from "./+types/submission";

import { AppHeader } from "~/components/app-header";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
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
import { getCalculationRunById } from "~/lib/history.server";
import { canReviewRuns } from "~/lib/roles";
import { cn } from "~/lib/utils";

const POLL_MS = 60_000;

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Submission | Springvale Solenis" },
    {
      name: "description",
      content: "Waiting for management approval of a submitted calculation.",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request, `/submissions/${params.runId}`);
  const run = await getCalculationRunById(params.runId);

  if (!run) {
    throw new Response("Submission not found", { status: 404 });
  }

  const pendingCount = canReviewRuns(user.role)
    ? await countPendingRuns()
    : 0;

  return { user, run, pendingCount };
}

export default function SubmissionPage({ loaderData }: Route.ComponentProps) {
  const { user, run, pendingCount } = loaderData;
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(
    run.status === "APPROVED" || run.status === "REJECTED",
  );

  useEffect(() => {
    if (run.status === "APPROVED" || run.status === "REJECTED") {
      setModalOpen(true);
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        revalidator.revalidate();
      }
    }, POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [run.status, revalidator]);

  const submittedAt = formatMelbourneDateTime(run.createdAt);
  const reviewedAt = formatMelbourneDateTime(run.reviewedAt);
  const reviewer =
    run.reviewedByName?.trim() || run.reviewedByEmail || "Unknown";

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Submission</Badge>
            <Link
              to="/"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Home
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {run.status === "PENDING"
              ? "Waiting for approval"
              : run.status === "APPROVED"
                ? "Calculation approved"
                : "Calculation rejected"}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {run.status === "PENDING"
              ? "Your calculation has been submitted. This page refreshes every minute until a manager approves or rejects it."
              : "Review the calculation you submitted below."}
          </p>
        </div>

        <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">
                  {run.calculationTitle}
                </CardTitle>
                <CardDescription className="mt-1">
                  Operator: {run.operatorName ?? "Unknown"}
                  {submittedAt ? ` · Submitted ${submittedAt}` : null}
                  {run.status === "PENDING"
                    ? " · Checking for updates every minute"
                    : null}
                </CardDescription>
              </div>
              <Badge
                variant={run.status === "PENDING" ? "secondary" : "outline"}
                className={cn(
                  run.status === "APPROVED" &&
                    "border-emerald-600/40 text-emerald-700 dark:text-emerald-400",
                  run.status === "REJECTED" &&
                    "border-destructive/40 text-destructive",
                )}
              >
                {run.status === "PENDING"
                  ? "Pending"
                  : run.status === "APPROVED"
                    ? "Approved"
                    : "Rejected"}
              </Badge>
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

            <div className="grid gap-4 lg:grid-cols-2">
              <LoadBreakdown
                title="DETA loads (IBC / pallet)"
                emptyLabel="No DETA loads recorded."
                totalLabel="DETA total"
                totalKg={run.loads.detaChargedKg}
                rows={run.loads.detaLoads.map((kg, index) => ({
                  label: `DETA load ${index + 1}`,
                  kg,
                }))}
              />
              <LoadBreakdown
                title="Adipic Acid mix"
                emptyLabel="No Adipic Acid weights recorded."
                totalLabel="Adipic total"
                totalKg={run.loads.adipicAcidKg}
                rows={run.loads.adipicBags.map((kg, index) => ({
                  label: `Adipic ${index + 1}`,
                  kg,
                }))}
              />
            </div>

            {run.status === "PENDING" ? (
              <p className="text-sm text-muted-foreground">
                Keep this page open. When a manager decides, you’ll see a
                confirmation message here.
              </p>
            ) : (
              <div className="rounded-lg border border-border/70 bg-background/50 p-4 text-sm">
                <p>
                  Status:{" "}
                  <span className="font-medium capitalize">
                    {run.status.toLowerCase()}
                  </span>
                </p>
                <p className="mt-1 text-muted-foreground">
                  Reviewed by {reviewer}
                  {reviewedAt ? ` · ${reviewedAt}` : null}
                </p>
                {run.status === "REJECTED" && run.reviewNote ? (
                  <p className="mt-2">Note: {run.reviewNote}</p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {modalOpen &&
      (run.status === "APPROVED" || run.status === "REJECTED") ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="decision-title"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-lg">
            <h2
              id="decision-title"
              className="font-heading text-2xl font-semibold tracking-tight"
            >
              {run.status === "APPROVED"
                ? "Calculation approved"
                : "Calculation rejected"}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {run.status === "APPROVED"
                ? "Management has approved this calculation for vessel charge."
                : "Management has rejected this calculation."}
            </p>
            {run.status === "REJECTED" && run.reviewNote ? (
              <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
                {run.reviewNote}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-muted-foreground">
              Reviewed by {reviewer}
              {reviewedAt ? ` · ${reviewedAt}` : null}
            </p>
            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  navigate(run.calculationHref);
                }}
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      ) : null}
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
            ? "font-heading text-2xl font-semibold tabular-nums"
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
