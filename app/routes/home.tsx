import type { Route } from "./+types/home";

import { AppHeader } from "~/components/app-header";
import { CatalogLinkCard } from "~/components/catalog-link-card";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import {
  FALLBACK_CALCULATIONS,
  type CalculationCard,
} from "~/lib/calculations";
import { getPrisma } from "~/lib/db.server";
import {
  FALLBACK_INSPECTIONS,
  buildHomeInspectionCatalog,
  type InspectionCard,
} from "~/lib/inspections";
import { canReviewRuns } from "~/lib/roles";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Springvale Solenis" },
    {
      name: "description",
      content:
        "Plant calculations and inspections for Solenis Springvale production.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, "/");
  const prisma = getPrisma();
  const pendingCount = canReviewRuns(user.role)
    ? await countPendingRuns()
    : 0;

  if (!prisma) {
    return {
      user,
      calculations: FALLBACK_CALCULATIONS,
      inspections: buildHomeInspectionCatalog(FALLBACK_INSPECTIONS),
      pendingCount,
      source: "fallback" as const,
    };
  }

  try {
    const [calculationRows, inspectionRows] = await Promise.all([
      prisma.calculation.findMany({
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          category: true,
          href: true,
          isAvailable: true,
        },
      }),
      prisma.inspection.findMany({
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          category: true,
          href: true,
          isAvailable: true,
        },
      }),
    ]);

    const calculations: CalculationCard[] = calculationRows.length
      ? calculationRows.map((row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          description: row.description,
          category: row.category,
          href: row.href,
          isAvailable: row.isAvailable,
        }))
      : FALLBACK_CALCULATIONS;

    const inspections: InspectionCard[] = buildHomeInspectionCatalog(
      inspectionRows.length
        ? inspectionRows.map((row) => ({
            id: row.id,
            slug: row.slug,
            title: row.title,
            description: row.description,
            category: row.category,
            href: row.href,
            isAvailable: row.isAvailable,
          }))
        : FALLBACK_INSPECTIONS,
    );

    return {
      user,
      calculations,
      inspections,
      pendingCount,
      source: "prisma" as const,
    };
  } catch {
    return {
      user,
      calculations: FALLBACK_CALCULATIONS,
      inspections: buildHomeInspectionCatalog(FALLBACK_INSPECTIONS),
      pendingCount,
      source: "fallback" as const,
    };
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { calculations, inspections, user, pendingCount } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="mb-12 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-brand uppercase">
            Solenis
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-brand-navy sm:text-5xl">
            Springvale
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Calculations for batch make-up and inspections for equipment and
            shift checks — all in one place.
          </p>
        </section>

        <section
          id="calculations"
          aria-labelledby="calculations-heading"
          className="mb-14 scroll-mt-24"
        >
          <div className="mb-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h2
              id="calculations-heading"
              className="font-heading text-2xl font-semibold tracking-tight text-brand-navy sm:text-3xl"
            >
              Calculations
            </h2>
            <p className="mt-2 text-muted-foreground">
              Open a calculator, enter loads, and submit for management approval
              before vessel charge.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {calculations.map((calculation, index) => (
              <div
                key={calculation.id}
                className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
                style={{ animationDelay: `${80 + index * 60}ms` }}
              >
                <CatalogLinkCard item={calculation} />
              </div>
            ))}
          </div>
        </section>

        <section
          id="inspections"
          aria-labelledby="inspections-heading"
          className="scroll-mt-24"
        >
          <div className="mb-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h2
              id="inspections-heading"
              className="font-heading text-2xl font-semibold tracking-tight text-brand-navy sm:text-3xl"
            >
              Inspections
            </h2>
            <p className="mt-2 text-muted-foreground">
              Open forklift checks by unit, or complete daily start-up /
              shut-down checklists. Anything marked for attention notifies
              managers.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inspections.map((inspection, index) => (
              <div
                key={inspection.id}
                className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
                style={{ animationDelay: `${120 + index * 60}ms` }}
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
