import { Link } from "react-router";

import type { Route } from "./+types/permits";

import { AppHeader } from "~/components/app-header";
import { CatalogLinkCard } from "~/components/catalog-link-card";
import { Badge } from "~/components/ui/badge";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { formatMelbourneDateTime } from "~/lib/datetime";
import {
  listOpenPermitRuns,
  listPermitCards,
} from "~/lib/permits.server";
import { canManageOperators, canReviewRuns } from "~/lib/roles";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Permits | Springvale Solenis" },
    {
      name: "description",
      content:
        "Issue work permits and close out open permits at Solenis Springvale.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, "/permits");
  const [{ permits }, openPermits, pendingCount] = await Promise.all([
    listPermitCards(),
    listOpenPermitRuns({ limit: 20 }),
    canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
  ]);

  return {
    user,
    permits,
    openPermits,
    pendingCount,
    canManage: canManageOperators(user.role),
  };
}

export default function PermitsPage({ loaderData }: Route.ComponentProps) {
  const { permits, openPermits, user, pendingCount, canManage } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="mb-12 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-brand uppercase">
            Solenis
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-brand-navy sm:text-5xl">
            Permits
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Issue a permit before work starts, then close it out when the job is
            finished.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link
              to="/permits/history"
              className="text-brand-navy underline-offset-4 hover:underline"
            >
              All records
            </Link>
            {canManage ? (
              <>
                <Link
                  to="/permits/manage"
                  className="text-brand-navy underline-offset-4 hover:underline"
                >
                  Manage forms
                </Link>
                <Link
                  to="/permits/settings"
                  className="text-brand-navy underline-offset-4 hover:underline"
                >
                  Settings
                </Link>
              </>
            ) : null}
          </div>
        </section>

        <section
          aria-labelledby="open-permits-heading"
          className="mb-14 animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          <div className="mb-4">
            <h2
              id="open-permits-heading"
              className="font-heading text-2xl font-semibold tracking-tight text-brand-navy"
            >
              Open permits
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Permits waiting for close-out.
            </p>
          </div>
          {openPermits.length > 0 ? (
            <ul className="grid gap-3">
              {openPermits.map((permit) => (
                <li key={permit.id}>
                  <Link
                    to={`/permits/runs/${permit.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-white/70 px-4 py-3 transition-colors hover:border-brand/40 hover:bg-brand/5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-brand-navy">
                        {permit.title}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {formatMelbourneDateTime(permit.createdAt)}
                        {permit.equipmentRef
                          ? ` · ${permit.equipmentRef}`
                          : ""}
                        {permit.area ? ` · ${permit.area}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-amber-600/40 text-amber-800"
                    >
                      Open
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No open permits right now.
            </p>
          )}
        </section>

        <section aria-labelledby="permits-heading">
          <h2
            id="permits-heading"
            className="mb-4 font-heading text-2xl font-semibold tracking-tight text-brand-navy"
          >
            Issue a permit
          </h2>
          {permits.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {permits.map((permit, index) => (
                <div
                  key={permit.id}
                  className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
                  style={{ animationDelay: `${80 + index * 60}ms` }}
                >
                  <CatalogLinkCard item={permit} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No permit forms are available yet.
              {canManage
                ? " Add one under Permits → Manage."
                : " Ask a manager to add a permit form."}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
