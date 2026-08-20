import { Link } from "react-router";

import type { Route } from "./+types/permit-page";

import { pageTitle } from "~/lib/brand";
import { AppHeader } from "~/components/app-header";
import { PermitIssueForm } from "~/components/permit-issue-form";
import { Badge } from "~/components/ui/badge";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { handlePermitIssueSubmit } from "~/lib/permit-action.server";
import {
  copyPermitFieldValues,
  headingTitleForKey,
  parseCopyHeadingsFromSearchParams,
} from "~/lib/permit-copy";
import { getPermitDefinition, getPermitRunById } from "~/lib/permits.server";
import { canReviewRuns } from "~/lib/roles";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Permit") },
    {
      name: "description",
      content: "Issue a work permit for Hercules 1612.",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const definition = await getPermitDefinition(params.permitId);
  if (!definition || !definition.isAvailable) {
    throw new Response("Permit not found", { status: 404 });
  }

  const user = await requireUser(request, definition.href);
  const pendingCount = canReviewRuns(user.role)
    ? await countPendingRuns()
    : 0;

  const url = new URL(request.url);
  const copyFromId = url.searchParams.get("copyFrom")?.trim() || null;
  const selectedHeadings = parseCopyHeadingsFromSearchParams(url.searchParams);

  let copiedEquipmentRef = "";
  let copiedResponses: Record<string, string> = {};
  let copiedFrom: {
    permitNumber: string | null;
    headingTitles: string[];
  } | null = null;

  if (copyFromId) {
    const source = await getPermitRunById(copyFromId);
    if (
      source &&
      source.status === "CLOSED" &&
      source.inspectionId === definition.id
    ) {
      const copied = copyPermitFieldValues({
        sourceAnswers: source.answers,
        sourceEquipmentRef: source.equipmentRef,
        selectedHeadingKeys: selectedHeadings,
        questions: definition.questions,
      });
      copiedEquipmentRef = copied.equipmentRef;
      copiedResponses = copied.responses;
      copiedFrom = {
        permitNumber: source.permitNumber,
        headingTitles: selectedHeadings.map((key) =>
          headingTitleForKey(key, definition.equipmentLabel),
        ),
      };
    }
  }

  return {
    user,
    pendingCount,
    definition,
    copiedEquipmentRef,
    copiedResponses,
    copiedFrom,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const definition = await getPermitDefinition(params.permitId);
  if (!definition || !definition.isAvailable) {
    throw new Response("Permit not found", { status: 404 });
  }

  const user = await requireUser(request, definition.href);
  return handlePermitIssueSubmit({ request, user, definition });
}

export default function PermitPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const {
    definition,
    user,
    pendingCount,
    copiedEquipmentRef,
    copiedResponses,
    copiedFrom,
  } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{definition.category}</Badge>
            <Link
              to="/permits"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Permits
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
          <PermitIssueForm
            definition={definition}
            lastResult={actionData?.lastResult}
            summary={actionData?.summary}
            status={actionData?.status}
            formError={actionData?.formError}
            initialEquipmentRef={copiedEquipmentRef}
            initialResponses={copiedResponses}
            copiedFrom={copiedFrom}
          />
        </div>
      </main>
    </div>
  );
}
