import { Form, Link } from "react-router";

import type { Route } from "./+types/home";

import { AppHeader } from "~/components/app-header";
import { CatalogLinkCard } from "~/components/catalog-link-card";
import { ForkliftDayDashboardCard } from "~/components/forklift-day-dashboard";
import { PermitDashboard } from "~/components/permit-dashboard";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import {
  FALLBACK_CALCULATIONS,
  type CalculationCard,
} from "~/lib/calculations";
import {
  formatMelbourneYmd,
  melbourneDateYmd,
  parseYmd,
} from "~/lib/datetime";
import { getPrisma } from "~/lib/db.server";
import { listForkliftChecksForDay } from "~/lib/inspections.server";
import {
  listOpenPermitRuns,
  listPendingAuthorizationPermitRuns,
} from "~/lib/permits.server";
import { canReviewRuns } from "~/lib/roles";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Home | Springvale Solenis" },
    {
      name: "description",
      content:
        "Quick view of today's forklift checks, active permits, and plant calculation shortcuts.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, "/");
  const url = new URL(request.url);
  const date =
    parseYmd(url.searchParams.get("date")) ?? melbourneDateYmd();
  const prisma = getPrisma();

  // Warm schema once before parallel list queries so they do not contend for
  // the small pg pool while dozens of DDL statements run on cold start.
  if (prisma) {
    try {
      const { ensureInspectionSchema } = await import("~/lib/migrate.server");
      await ensureInspectionSchema();
    } catch (error) {
      console.error("[home] ensureInspectionSchema failed", error);
    }
  }

  const [pendingCount, forkliftDay, pendingPermits, openPermits] =
    await Promise.all([
      canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
      listForkliftChecksForDay(date),
      listPendingAuthorizationPermitRuns({ limit: 10 }),
      listOpenPermitRuns({ limit: 10 }),
    ]);

  if (!prisma) {
    return {
      user,
      calculations: FALLBACK_CALCULATIONS,
      pendingCount,
      forkliftDay,
      pendingPermits,
      openPermits,
      date,
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
      forkliftDay,
      pendingPermits,
      openPermits,
      date,
      source: "prisma" as const,
    };
  } catch {
    return {
      user,
      calculations: FALLBACK_CALCULATIONS,
      pendingCount,
      forkliftDay,
      pendingPermits,
      openPermits,
      date,
      source: "fallback" as const,
    };
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const {
    calculations,
    user,
    pendingCount,
    forkliftDay,
    pendingPermits,
    openPermits,
    date,
  } = loaderData;
  const dayLabel = formatMelbourneYmd(date) ?? date;
  const recordsHref = `/inspections/history?date=${encodeURIComponent(date)}`;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="mb-10 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-brand uppercase">
            Solenis
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-brand-navy sm:text-5xl">
            Springvale
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Quick view of forklift checks for {dayLabel}, active permits, and
            shortcuts into plant calculations.
          </p>
        </section>

        <section
          aria-labelledby="dashboard-heading"
          className="mb-14 animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="dashboard-heading"
                className="font-heading text-2xl font-semibold tracking-tight text-brand-navy"
              >
                Forklift checks
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Which forklifts have been inspected on {dayLabel}.
              </p>
            </div>
            <Form method="get" className="flex flex-wrap items-end gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="home-date" className="sr-only">
                  Date
                </Label>
                <Input
                  id="home-date"
                  name="date"
                  type="date"
                  defaultValue={date}
                  className="w-auto"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Show day
              </Button>
            </Form>
          </div>
          <ForkliftDayDashboardCard
            dashboard={forkliftDay}
            recordsHref={recordsHref}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/inspections/forklifts">Start forklift check</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/inspections">All checklists</Link>
            </Button>
          </div>
        </section>

        <section
          aria-labelledby="permits-dashboard-heading"
          className="mb-14 animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          <div className="mb-4">
            <h2
              id="permits-dashboard-heading"
              className="font-heading text-2xl font-semibold tracking-tight text-brand-navy"
            >
              Permits
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pending authorization and open permits.
            </p>
          </div>
          <PermitDashboard
            pendingPermits={pendingPermits}
            openPermits={openPermits}
            compact
          />
        </section>

        <section
          id="calculations"
          aria-labelledby="calculations-heading"
          className="scroll-mt-24"
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
      </main>
    </div>
  );
}
