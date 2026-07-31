import type { Route } from "./+types/permits";

import { AppHeader } from "~/components/app-header";
import { CatalogLinkCard } from "~/components/catalog-link-card";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { buildPermitCatalog } from "~/lib/inspections";
import { listInspectionCards } from "~/lib/inspections.server";
import { canReviewRuns } from "~/lib/roles";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Permits | Springvale Solenis" },
    {
      name: "description",
      content:
        "Work permits for Solenis Springvale, starting with Safe Work Permit (Form 42801).",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, "/permits");
  const [{ inspections }, pendingCount] = await Promise.all([
    listInspectionCards(),
    canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
  ]);

  return {
    user,
    permits: buildPermitCatalog(inspections),
    pendingCount,
  };
}

export default function PermitsPage({ loaderData }: Route.ComponentProps) {
  const { permits, user, pendingCount } = loaderData;

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
            Issue and complete work permits before the job starts. Begin with
            the Safe Work Permit, then add related permits as needed.
          </p>
        </section>

        <section aria-labelledby="permits-heading">
          <h2 id="permits-heading" className="sr-only">
            Available permits
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
              No permits are available yet. Managers can add them under
              Inspections → Manage with category “Permits”.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
