import { data, Form, Link } from "react-router";

import type { Route } from "./+types/approvals";

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
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import {
  approveRun,
  listPendingRuns,
  rejectRun,
} from "~/lib/approvals.server";
import { requireReviewer } from "~/lib/auth.server";
import { formatMelbourneDateTime } from "~/lib/datetime";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Approvals | Solenis Calculations" },
    {
      name: "description",
      content: "Review pending calculation runs before vessel charge.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireReviewer(request);
  const pending = await listPendingRuns();
  return { user, pending };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireReviewer(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const runId = String(formData.get("runId") ?? "");

  if (!runId) {
    return data({ error: "Missing calculation run." }, { status: 400 });
  }

  try {
    if (intent === "approve") {
      await approveRun(runId, user.id);
      return { ok: true as const };
    }

    if (intent === "reject") {
      const reviewNote = String(formData.get("reviewNote") ?? "");
      await rejectRun(runId, user.id, reviewNote);
      return { ok: true as const };
    }
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update this calculation.",
      },
      { status: 400 },
    );
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function ApprovalsPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, pending } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pending.length} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Management</Badge>
            <Link
              to="/"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← All calculators
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Approvals
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Review operator submissions before DETA is added to the vessel.
          </p>
          {actionData && "error" in actionData && actionData.error ? (
            <p className="mt-3 text-sm text-destructive">{actionData.error}</p>
          ) : null}
        </div>

        {pending.length === 0 ? (
          <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <CardHeader>
              <CardTitle>No pending calculations</CardTitle>
              <CardDescription>
                New submissions from the plant floor will appear here.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pending.map((run, index) => {
              const submittedAt = formatMelbourneDateTime(run.createdAt);

              return (
              <Card
                key={run.id}
                className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
                style={{ animationDelay: `${80 + index * 40}ms` }}
              >
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">
                        {run.calculationTitle}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Operator: {run.operatorName ?? "Unknown"}
                        {run.submittedByEmail
                          ? ` · Submitted via ${run.submittedByEmail}`
                          : null}
                        {submittedAt ? ` · ${submittedAt}` : null}
                      </CardDescription>
                    </div>
                    <Badge>Pending</Badge>
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

                  <Separator />

                  <Form method="post" className="grid gap-3">
                    <input type="hidden" name="runId" value={run.id} />
                    <div className="grid gap-2">
                      <Label htmlFor={`note-${run.id}`}>
                        Rejection note (optional)
                      </Label>
                      <textarea
                        id={`note-${run.id}`}
                        name="reviewNote"
                        rows={2}
                        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        placeholder="Reason if rejecting…"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" name="intent" value="approve">
                        Approve for vessel
                      </Button>
                      <Button
                        type="submit"
                        name="intent"
                        value="reject"
                        variant="outline"
                      >
                        Reject
                      </Button>
                    </div>
                  </Form>
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
