import { Form, Link } from "react-router";

import type { Route } from "./+types/permits-history";

import { AppHeader } from "~/components/app-header";
import { PermitRecordCard } from "~/components/permit-record-card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { listPermitRuns } from "~/lib/permits.server";
import { canReviewRuns } from "~/lib/roles";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Permit records | Springvale Solenis" },
    {
      name: "description",
      content: "Open and closed work permit history.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, "/permits/history");
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam === "OPEN" ||
    statusParam === "CLOSED" ||
    statusParam === "PENDING_AUTHORIZATION"
      ? statusParam
      : "ALL";
  const [runs, pendingCount] = await Promise.all([
    listPermitRuns({ status, limit: 100 }),
    canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
  ]);
  return { user, runs, pendingCount, status };
}

export default function PermitsHistoryPage({
  loaderData,
}: Route.ComponentProps) {
  const { user, runs, pendingCount, status } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Records</Badge>
            <Link
              to="/permits"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Permits
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Permit records
          </h1>
          <p className="mt-2 text-muted-foreground">
            Pending, open, and closed permits. Closed Safe Work Permits are
            retained for at least one year.
          </p>
        </div>

        <Form method="get" className="mb-6 flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              className="flex h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="ALL">All</option>
              <option value="PENDING_AUTHORIZATION">Pending authorization</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Filter
          </Button>
        </Form>

        {runs.length > 0 ? (
          <ul className="grid gap-3">
            {runs.map((run) => (
              <PermitRecordCard key={run.id} run={run} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">No permits match this filter.</p>
        )}
      </main>
    </div>
  );
}
