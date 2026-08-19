import { Link } from "react-router";

import type { Route } from "./+types/permits";

import { pageTitle } from "~/lib/brand";
import { AppHeader } from "~/components/app-header";
import { CatalogLinkCard } from "~/components/catalog-link-card";
import { Badge } from "~/components/ui/badge";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { listPermitCards } from "~/lib/permits.server";
import { canManageOperators, canReviewRuns } from "~/lib/roles";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Issue permit") },
    {
      name: "description",
      content: "Choose a permit form to issue at Hercules 1612.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, "/permits");
  const [{ permits }, pendingCount] = await Promise.all([
    listPermitCards(),
    canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
  ]);

  return {
    user,
    permits,
    pendingCount,
    canManage: canManageOperators(user.role),
  };
}

export default function PermitsPage({ loaderData }: Route.ComponentProps) {
  const { permits, user, pendingCount, canManage } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="mb-12 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Permits</Badge>
            <Link
              to="/permits/dashboard"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Dashboard
            </Link>
          </div>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-brand-navy sm:text-5xl">
            Issue a permit
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Choose a form to start. After submit it goes for authorization
            sign-off.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link
              to="/permits/dashboard"
              className="text-brand-navy underline-offset-4 hover:underline"
            >
              Dashboard
            </Link>
            <Link
              to="/permits/history"
              className="text-brand-navy underline-offset-4 hover:underline"
            >
              Records
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

        <section aria-labelledby="permits-heading">
          <h2
            id="permits-heading"
            className="mb-4 font-heading text-2xl font-semibold tracking-tight text-brand-navy"
          >
            Forms
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
