import { data, Form, Link } from "react-router";

import type { Route } from "./+types/admin-db-migrate";

import { AppHeader } from "~/components/app-header";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireAdmin } from "~/lib/auth.server";
import { seedDefaultInspections } from "~/lib/inspections.server";
import { applyPendingMigrations } from "~/lib/migrate.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "DB migrate | Springvale Solenis" },
    {
      name: "description",
      content: "Apply pending Prisma migrations through the app database connection.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAdmin(request, "/admin/db-migrate");
  const pendingCount = await countPendingRuns();
  return { user, pendingCount };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request, "/admin/db-migrate");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "migrate") {
      const results = await applyPendingMigrations();
      return { ok: true as const, results };
    }
    if (intent === "seed") {
      const seeded = await seedDefaultInspections();
      return { ok: true as const, seeded };
    }
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error ? error.message : "Could not apply migrations.",
      },
      { status: 500 },
    );
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function AdminDbMigratePage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, pendingCount } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Admin</Badge>
            <Link
              to="/"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Home
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Apply database migrations
          </h1>
          <p className="mt-2 text-muted-foreground">
            Use this if a Vercel build-time migrate hangs on the Supabase
            pooler. Applies any pending Prisma migrations through the app DB
            connection.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending migrations</CardTitle>
            <CardDescription>
              Safe to run more than once — already-applied migrations are
              skipped. After migrations succeed, seed the default forklift and
              daily checklists.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {actionData && "error" in actionData && actionData.error ? (
              <p className="text-sm text-destructive">{actionData.error}</p>
            ) : null}
            {actionData && "results" in actionData && actionData.results ? (
              <ul className="grid gap-2 text-sm">
                {actionData.results.map((result) => (
                  <li
                    key={result.name}
                    className="rounded-lg border border-border/70 px-3 py-2"
                  >
                    <span className="font-medium">{result.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      {result.status}
                      {result.detail ? ` — ${result.detail}` : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {actionData && "seeded" in actionData && actionData.seeded != null ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                Seeded {actionData.seeded} default inspections with questions.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Form method="post">
                <input type="hidden" name="intent" value="migrate" />
                <Button type="submit">Apply pending migrations</Button>
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value="seed" />
                <Button type="submit" variant="outline">
                  Seed default inspections
                </Button>
              </Form>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
