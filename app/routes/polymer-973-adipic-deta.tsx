import { Link } from "react-router";

import type { Route } from "./+types/polymer-973-adipic-deta";

import { AppHeader } from "~/components/app-header";
import { PolymerAdipicDetaForm } from "~/components/polymer-adipic-deta-form";
import { Badge } from "~/components/ui/badge";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { listActiveOperators } from "~/lib/operators.server";
import { handlePolymerAdipicDetaSubmit } from "~/lib/polymer-adipic-deta-action.server";
import { POLYMER_973 } from "~/lib/polymer-adipic-deta";
import { canReviewRuns } from "~/lib/roles";

const product = POLYMER_973;

export function meta({}: Route.MetaArgs) {
  return [
    { title: `${product.title} | Springvale Solenis` },
    {
      name: "description",
      content: `Calculate extra DETA required after charging Adipic Acid for ${product.shortName}.`,
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, product.href);
  const [operators, pendingCount] = await Promise.all([
    listActiveOperators(),
    canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
  ]);
  return { user, operators, pendingCount };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request, product.href);
  return handlePolymerAdipicDetaSubmit({ request, user, product });
}

export default function Polymer973AdipicDetaPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <div className="app-shell">
      <AppHeader
        user={loaderData.user}
        pendingCount={loaderData.pendingCount}
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Polymer</Badge>
            <Link
              to="/"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Home
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {product.title}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Charge ~90% DETA via drums/IBCs, then Adipic Acid pallets (bulk-bag
            actual weights). Submit for management approval before vessel
            charge.
          </p>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
          <PolymerAdipicDetaForm
            product={product}
            operators={loaderData.operators}
            lastResult={actionData?.lastResult}
            result={actionData?.result}
            status={actionData?.status}
            formError={actionData?.formError}
          />
        </div>
      </main>
    </div>
  );
}
