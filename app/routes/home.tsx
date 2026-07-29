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
import { canReviewRuns } from "~/lib/roles";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Calculations | Springvale Solenis" },
    {
      name: "description",
      content: "Plant calculations for Solenis Springvale production.",
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
      pendingCount,
      source: "fallback" as const,
    };
  }

  try {
    const calculationRows = await prisma.calculation.findMany({
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
    });

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

    return {
      user,
      calculations,
      pendingCount,
      source: "prisma" as const,
    };
  } catch {
    return {
      user,
      calculations: FALLBACK_CALCULATIONS,
      pendingCount,
      source: "fallback" as const,
    };
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { calculations, user, pendingCount } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="mb-12 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-brand uppercase">
            Solenis
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-brand-navy sm:text-5xl">
            Calculations
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Open a calculator, enter loads, and submit for management approval
            before vessel charge.
          </p>
        </section>

        <section aria-labelledby="calculations-heading">
          <h2 id="calculations-heading" className="sr-only">
            Available calculations
          </h2>
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
      </main>
    </div>
  );
}
