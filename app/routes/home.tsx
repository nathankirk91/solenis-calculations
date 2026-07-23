import type { Route } from "./+types/home";

import { AppHeader } from "~/components/app-header";
import { CalculationLinkCard } from "~/components/calculation-link-card";
import { requireUser } from "~/lib/auth.server";
import {
  FALLBACK_CALCULATIONS,
  type CalculationCard,
} from "~/lib/calculations";
import { getPrisma } from "~/lib/db.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Solenis Calculations" },
    {
      name: "description",
      content: "Plant calculation tools for Solenis production processes.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, "/");
  const prisma = getPrisma();

  if (!prisma) {
    return {
      user,
      calculations: FALLBACK_CALCULATIONS,
      source: "fallback" as const,
    };
  }

  try {
    const rows = await prisma.calculation.findMany({
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

    if (!rows.length) {
      return {
        user,
        calculations: FALLBACK_CALCULATIONS,
        source: "fallback" as const,
      };
    }

    const calculations: CalculationCard[] = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      category: row.category,
      href: row.href,
      isAvailable: row.isAvailable,
    }));

    return { user, calculations, source: "prisma" as const };
  } catch {
    return {
      user,
      calculations: FALLBACK_CALCULATIONS,
      source: "fallback" as const,
    };
  }
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { calculations, user } = loaderData;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_oklch(0.97_0.02_220),_transparent_55%),linear-gradient(180deg,_oklch(0.99_0.01_220),_oklch(0.96_0.015_200))]">
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="mb-10 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <p className="mb-3 text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Solenis
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Calculations
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Pick a calculator to open its dedicated page. More process tools
            will land here as cards.
          </p>
        </section>

        <section
          aria-label="Available calculators"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {calculations.map((calculation, index) => (
            <div
              key={calculation.id}
              className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
              style={{ animationDelay: `${80 + index * 60}ms` }}
            >
              <CalculationLinkCard calculation={calculation} />
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
