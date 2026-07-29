import type { Route } from "./+types/inspections";

import { AppHeader } from "~/components/app-header";
import { CatalogLinkCard } from "~/components/catalog-link-card";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { buildHomeInspectionCatalog } from "~/lib/inspections";
import { listInspectionCards } from "~/lib/inspections.server";
import { canReviewRuns } from "~/lib/roles";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Inspections | Springvale Solenis" },
    {
      name: "description",
      content:
        "Plant inspections for equipment and shift checks at Solenis Springvale.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, "/inspections");
  const [{ inspections }, pendingCount] = await Promise.all([
    listInspectionCards(),
    canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
  ]);

  return {
    user,
    inspections: buildHomeInspectionCatalog(inspections),
    pendingCount,
  };
}

export default function InspectionsPage({ loaderData }: Route.ComponentProps) {
  const { inspections, user, pendingCount } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="mb-12 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-brand uppercase">
            Solenis
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-brand-navy sm:text-5xl">
            Inspections
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Open forklift checks by unit, or complete daily start-up /
            shut-down checklists. Anything marked for attention notifies
            managers.
          </p>
        </section>

        <section aria-labelledby="inspections-heading">
          <h2 id="inspections-heading" className="sr-only">
            Available inspections
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inspections.map((inspection, index) => (
              <div
                key={inspection.id}
                className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
                style={{ animationDelay: `${80 + index * 60}ms` }}
              >
                <CatalogLinkCard item={inspection} />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
