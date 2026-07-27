import { Link } from "react-router";

import type { Route } from "./+types/inspection-page";

import { AppHeader } from "~/components/app-header";
import { InspectionChecklistForm } from "~/components/inspection-checklist-form";
import { Badge } from "~/components/ui/badge";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { handleInspectionSubmit } from "~/lib/inspection-action.server";
import { getInspectionDefinition } from "~/lib/inspections.server";
import { listActiveOperators } from "~/lib/operators.server";
import { canReviewRuns } from "~/lib/roles";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Inspection | Springvale Solenis" },
    {
      name: "description",
      content: "Plant inspection checklist for Solenis Springvale.",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const definition = await getInspectionDefinition(params.inspectionId);
  if (!definition || !definition.isAvailable) {
    throw new Response("Inspection not found", { status: 404 });
  }

  const user = await requireUser(request, definition.href);
  const [operators, pendingCount] = await Promise.all([
    listActiveOperators(),
    canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
  ]);

  return { user, operators, pendingCount, definition };
}

export async function action({ request, params }: Route.ActionArgs) {
  const definition = await getInspectionDefinition(params.inspectionId);
  if (!definition || !definition.isAvailable) {
    throw new Response("Inspection not found", { status: 404 });
  }

  const user = await requireUser(request, definition.href);
  return handleInspectionSubmit({ request, user, definition });
}

export default function InspectionPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { definition, user, operators, pendingCount } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{definition.category}</Badge>
            <Link
              to="/#inspections"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← All tools
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {definition.title}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {definition.description}
          </p>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
          <InspectionChecklistForm
            definition={definition}
            operators={operators}
            lastResult={actionData?.lastResult}
            summary={actionData?.summary}
            status={actionData?.status}
            formError={actionData?.formError}
          />
        </div>
      </main>
    </div>
  );
}
