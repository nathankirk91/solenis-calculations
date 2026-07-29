import { Link } from "react-router";

import type { Route } from "./+types/inspections-forklifts";

import { AppHeader } from "~/components/app-header";
import { CatalogLinkCard } from "~/components/catalog-link-card";
import { Badge } from "~/components/ui/badge";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { getPrisma } from "~/lib/db.server";
import {
  FORKLIFT_UNIT_FORMS,
  FORKLIFT_UNITS,
  isForkliftUnitInspection,
  type InspectionCard,
} from "~/lib/inspections";
import { canReviewRuns } from "~/lib/roles";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Forklift inspections | Springvale Solenis" },
    {
      name: "description",
      content:
        "Choose a forklift unit to complete the daily safety check (Form 78).",
    },
  ];
}

function forkliftCardTitle(card: InspectionCard): string {
  const unit = FORKLIFT_UNITS.find(
    (entry) =>
      card.id.toLowerCase().includes(entry.value.toLowerCase()) ||
      card.slug.toLowerCase().includes(entry.value.toLowerCase()) ||
      card.title.toUpperCase().includes(entry.value),
  );
  return unit?.label ?? card.title;
}

function forkliftCardDescription(card: InspectionCard): string {
  const unit = FORKLIFT_UNITS.find(
    (entry) =>
      card.id.toLowerCase().includes(entry.value.toLowerCase()) ||
      card.slug.toLowerCase().includes(entry.value.toLowerCase()),
  );
  if (unit) {
    return `Start-of-shift safety check before use (Form 78). Unit ${unit.value}.`;
  }
  return card.description;
}

async function listForkliftUnitCards(): Promise<InspectionCard[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return FORKLIFT_UNIT_FORMS.filter((row) => row.isAvailable).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      category: row.category,
      href: row.href,
      isAvailable: row.isAvailable,
    }));
  }

  try {
    const rows = await prisma.inspection.findMany({
      where: { isAvailable: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        category: true,
        href: true,
        isAvailable: true,
        fixedEquipmentRef: true,
        templateInspectionId: true,
      },
    });

    const forklifts = rows.filter((row) => isForkliftUnitInspection(row));
    if (forklifts.length === 0) {
      return FORKLIFT_UNIT_FORMS.filter((row) => row.isAvailable).map(
        (row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          description: row.description,
          category: row.category,
          href: row.href,
          isAvailable: row.isAvailable,
        }),
      );
    }

    return forklifts.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      category: row.category,
      href: row.href,
      isAvailable: row.isAvailable,
    }));
  } catch {
    return FORKLIFT_UNIT_FORMS.filter((row) => row.isAvailable).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      category: row.category,
      href: row.href,
      isAvailable: row.isAvailable,
    }));
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, "/inspections/forklifts");
  const [forklifts, pendingCount] = await Promise.all([
    listForkliftUnitCards(),
    canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
  ]);

  return { user, forklifts, pendingCount };
}

export default function ForkliftInspectionsPage({
  loaderData,
}: Route.ComponentProps) {
  const { user, forklifts, pendingCount } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Equipment</Badge>
            <Link
              to="/#inspections"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Inspections
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Forklift inspections
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Select a unit to run the daily safety check (Form 78) at the start
            of each shift.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forklifts.map((forklift, index) => (
            <div
              key={forklift.id}
              className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500"
              style={{ animationDelay: `${80 + index * 50}ms` }}
            >
              <CatalogLinkCard
                item={{
                  ...forklift,
                  title: forkliftCardTitle(forklift),
                  description: forkliftCardDescription(forklift),
                  category: "Forklift",
                }}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
