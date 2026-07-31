import { Link, redirect } from "react-router";

import type { Route } from "./+types/inspection-page";

import { AppHeader } from "~/components/app-header";
import { InspectionChecklistForm } from "~/components/inspection-checklist-form";
import { Badge } from "~/components/ui/badge";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { handleInspectionSubmit } from "~/lib/inspection-action.server";
import {
  FORKLIFT_INSPECTIONS_HREF,
  isForkliftUnitInspection,
  isPermitInspection,
} from "~/lib/inspections";
import {
  getInspectionDefinition,
  getLastAnswersForInspection,
  isFirstInspectionOfWeek,
  listOpenInspectionActions,
} from "~/lib/inspections.server";
import { listActiveOperators } from "~/lib/operators.server";
import { canReviewRuns } from "~/lib/roles";

/** Prefer /permits/:slug so stale DB hrefs cannot cause a redirect loop. */
function permitIssueHref(definition: {
  slug: string;
  href?: string | null;
}): string {
  if (definition.href?.startsWith("/permits/")) {
    return definition.href;
  }
  return `/permits/${definition.slug}`;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Inspection | Springvale Solenis" },
    {
      name: "description",
      content: "Plant inspection checklist or work permit for Solenis Springvale.",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  // Legacy /inspections/safe-work-permit URLs redirect to /permits/...
  const maybePermit = await getInspectionDefinition(params.inspectionId);
  if (maybePermit && isPermitInspection(maybePermit)) {
    throw redirect(permitIssueHref(maybePermit));
  }

  const definition = maybePermit;
  if (!definition || !definition.isAvailable) {
    throw new Response("Inspection not found", { status: 404 });
  }

  const user = await requireUser(request, definition.href);
  const url = new URL(request.url);
  const shiftParam = url.searchParams.get("shift")?.trim() || null;
  const equipmentParam = url.searchParams.get("equipmentRef")?.trim() || null;
  const equipmentRef =
    definition.fixedEquipmentRef?.trim() || equipmentParam || null;

  const needsEquipmentPick =
    Boolean(definition.equipmentLabel) && !definition.fixedEquipmentRef;
  const canLoadScopedData = !needsEquipmentPick || Boolean(equipmentRef);
  const needsWeekStatus = definition.questions.some(
    (question) => question.firstOfWeekOnly,
  );

  const [operators, pendingCount, lastAnswersResult, openActions, firstOfWeek] =
    await Promise.all([
      listActiveOperators(),
      canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
      canLoadScopedData
        ? getLastAnswersForInspection({
            inspectionId: definition.id,
            equipmentRef,
          })
        : Promise.resolve({
            answers: {} as Record<string, string>,
            runId: null as string | null,
            createdAt: null as string | null,
          }),
      canLoadScopedData
        ? listOpenInspectionActions({
            inspectionId: definition.id,
            equipmentRef,
          })
        : Promise.resolve([]),
      needsWeekStatus && canLoadScopedData && shiftParam
        ? isFirstInspectionOfWeek({
            inspectionId: definition.id,
            equipmentRef,
            shift: shiftParam,
          })
        : Promise.resolve(false),
    ]);

  return {
    user,
    operators,
    pendingCount,
    definition,
    selectedShift: shiftParam,
    equipmentRef,
    isFirstInspectionOfWeek: firstOfWeek,
    lastAnswers: lastAnswersResult.answers,
    lastRunAt: lastAnswersResult.createdAt,
    openActions,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const definition = await getInspectionDefinition(params.inspectionId);
  if (!definition || !definition.isAvailable) {
    throw new Response("Inspection not found", { status: 404 });
  }
  if (isPermitInspection(definition)) {
    throw redirect(permitIssueHref(definition));
  }

  const user = await requireUser(request, definition.href);
  return handleInspectionSubmit({ request, user, definition });
}

export default function InspectionPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const {
    definition,
    user,
    operators,
    pendingCount,
    selectedShift,
    equipmentRef,
    isFirstInspectionOfWeek,
    lastAnswers,
    lastRunAt,
    openActions,
  } = loaderData;
  const backToForklifts = isForkliftUnitInspection(definition);
  const isPermit = isPermitInspection(definition);
  const backHref = backToForklifts
    ? FORKLIFT_INSPECTIONS_HREF
    : isPermit
      ? "/permits"
      : "/inspections";
  const backLabel = backToForklifts
    ? "← Forklift inspections"
    : isPermit
      ? "← Permits"
      : "← Inspections";

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{definition.category}</Badge>
            <Link
              to={backHref}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {backLabel}
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
            selectedShift={selectedShift}
            equipmentRef={equipmentRef}
            isFirstInspectionOfWeek={isFirstInspectionOfWeek}
            lastAnswers={lastAnswers}
            lastRunAt={lastRunAt}
            openActions={openActions}
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
