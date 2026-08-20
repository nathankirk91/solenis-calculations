import { Link, data, redirect } from "react-router";

import type { Route } from "./+types/permit-run-copy";

import { pageTitle } from "~/lib/brand";
import { AppHeader } from "~/components/app-header";
import { PermitCopyForm } from "~/components/permit-copy-form";
import { Badge } from "~/components/ui/badge";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { formatMelbourneDateTime } from "~/lib/datetime";
import {
  buildPermitCopyIssueHref,
  createPermitCopyFormSchema,
  listCopyablePermitHeadings,
  permitIssuePath,
  selectedHeadingsFromFormData,
} from "~/lib/permit-copy";
import {
  permitRecordHeading,
  workDescriptionFromAnswers,
} from "~/lib/permit-display";
import { getPermitDefinition, getPermitRunById } from "~/lib/permits.server";
import { canReviewRuns } from "~/lib/roles";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Copy permit") },
    {
      name: "description",
      content: "Copy a closed permit to start a new one.",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(
    request,
    `/permits/runs/${params.permitRunId}/copy`,
  );
  const run = await getPermitRunById(params.permitRunId);
  if (!run) {
    throw new Response("Permit not found", { status: 404 });
  }
  if (run.status !== "CLOSED") {
    throw redirect(`/permits/runs/${run.id}`);
  }

  const definition = await getPermitDefinition(run.inspectionId);
  if (!definition || !definition.isAvailable) {
    throw new Response("This permit form is no longer available.", {
      status: 404,
    });
  }

  const pendingCount = canReviewRuns(user.role)
    ? await countPendingRuns()
    : 0;
  const headings = listCopyablePermitHeadings({
    answers: run.answers,
    equipmentRef: run.equipmentRef,
    equipmentLabel: definition.equipmentLabel,
  });

  return { user, pendingCount, run, definition, headings };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request, `/permits/runs/${params.permitRunId}/copy`);
  const run = await getPermitRunById(params.permitRunId);
  if (!run) {
    throw new Response("Permit not found", { status: 404 });
  }
  if (run.status !== "CLOSED") {
    return data(
      { lastResult: null, error: "Only closed permits can be copied." },
      { status: 400 },
    );
  }

  const definition = await getPermitDefinition(run.inspectionId);
  if (!definition || !definition.isAvailable) {
    return data(
      {
        lastResult: null,
        error: "This permit form is no longer available to issue.",
      },
      { status: 400 },
    );
  }

  const headings = listCopyablePermitHeadings({
    answers: run.answers,
    equipmentRef: run.equipmentRef,
    equipmentLabel: definition.equipmentLabel,
  });
  const formData = await request.formData();
  const selectedHeadings = selectedHeadingsFromFormData(formData);
  const parsed = createPermitCopyFormSchema(
    headings.map((heading) => heading.key),
  ).safeParse({ heading: selectedHeadings });
  if (!parsed.success) {
    return data(
      {
        lastResult: null,
        error: "Select headings from this permit only.",
      },
      { status: 400 },
    );
  }

  throw redirect(
    buildPermitCopyIssueHref(
      permitIssuePath(definition),
      run.id,
      parsed.data.heading,
    ),
  );
}

export default function PermitRunCopyPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, pendingCount, run, definition, headings } = loaderData;
  const heading = permitRecordHeading({
    workDescription: workDescriptionFromAnswers(run.answers),
    equipmentRef: run.equipmentRef,
    permitNumber: run.permitNumber,
  });

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-emerald-600/40 text-emerald-700">
              Closed
            </Badge>
            <Link
              to={`/permits/runs/${run.id}`}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Permit record
            </Link>
            <Link
              to="/permits/history"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Records
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Copy {definition.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {run.permitNumber ? (
              <>
                <span className="font-medium text-foreground">
                  #{run.permitNumber}
                </span>
                {" · "}
              </>
            ) : null}
            {heading}
            {run.closedAt ? ` · Closed ${formatMelbourneDateTime(run.closedAt)}` : ""}
          </p>
        </div>

        <PermitCopyForm
          headings={headings}
          lastResult={actionData?.lastResult}
          error={actionData?.error}
        />
      </main>
    </div>
  );
}
