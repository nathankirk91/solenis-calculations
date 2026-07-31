import { Link } from "react-router";

import type { Route } from "./+types/permit-page";

import { AppHeader } from "~/components/app-header";
import { PermitIssueForm } from "~/components/permit-issue-form";
import { Badge } from "~/components/ui/badge";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { handlePermitIssueSubmit } from "~/lib/permit-action.server";
import { getPermitDefinition } from "~/lib/permits.server";
import { canReviewRuns } from "~/lib/roles";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Permit | Springvale Solenis" },
    {
      name: "description",
      content: "Issue a work permit for Solenis Springvale.",
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

  return { user, pendingCount, definition };
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
  const { definition, user, pendingCount } = loaderData;

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
          />
        </div>
      </main>
    </div>
  );
}
