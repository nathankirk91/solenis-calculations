import { data, Form, Link, redirect } from "react-router";

import type { Route } from "./+types/inspections-manage";

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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireOperatorManager } from "~/lib/auth.server";
import {
  createManagedInspection,
  listManagedInspections,
  seedDefaultInspections,
  setInspectionAvailability,
} from "~/lib/inspections.server";
import { applyPendingMigrations } from "~/lib/migrate.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Manage inspections | Springvale Solenis" },
    {
      name: "description",
      content: "Create and manage plant inspection checklists and questions.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireOperatorManager(request);

  let migrateNote: string | null = null;
  let inspections = await listManagedInspections();

  // First visit after deploy: create missing inspection tables + seed defaults.
  if (inspections.length === 0) {
    try {
      const results = await applyPendingMigrations();
      const applied = results.filter((row) => row.status === "applied");
      const failed = results.find((row) => row.status === "failed");
      if (failed) {
        migrateNote = `Migration ${failed.name} failed: ${failed.detail ?? "unknown error"}`;
      } else if (applied.length > 0) {
        const seeded = await seedDefaultInspections();
        migrateNote = `Applied ${applied.length} migration(s) and seeded ${seeded} inspections.`;
        inspections = await listManagedInspections();
      }
    } catch (error) {
      migrateNote =
        error instanceof Error
          ? error.message
          : "Could not apply inspection migrations.";
    }
  }

  const pendingCount = await countPendingRuns();
  return { user, inspections, pendingCount, migrateNote };
}

export async function action({ request }: Route.ActionArgs) {
  await requireOperatorManager(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "create") {
      const created = await createManagedInspection({
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        category: String(formData.get("category") ?? ""),
        equipmentLabel: String(formData.get("equipmentLabel") ?? ""),
      });
      throw redirect(`/inspections/manage/${created.id}`);
    }

    if (intent === "toggle") {
      const inspectionId = String(formData.get("inspectionId") ?? "");
      const isAvailable = String(formData.get("isAvailable") ?? "") === "true";
      if (!inspectionId) {
        return data({ error: "Missing inspection." }, { status: 400 });
      }
      await setInspectionAvailability(inspectionId, !isAvailable);
      return { ok: true as const };
    }
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update inspections.",
      },
      { status: 400 },
    );
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function InspectionsManagePage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, inspections, pendingCount, migrateNote } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Management</Badge>
            <Link
              to="/"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Home
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Inspections
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Create checklists and add questions (yes/no, text, or radio
            options). Operators see available inspections on the home page.
          </p>
          {migrateNote ? (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
              {migrateNote}
            </p>
          ) : null}
          {actionData && "error" in actionData && actionData.error ? (
            <p className="mt-3 text-sm text-destructive">{actionData.error}</p>
          ) : null}
        </div>

        <div className="grid gap-4">
          <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <CardHeader>
              <CardTitle>Add inspection</CardTitle>
              <CardDescription>
                After creating, add the questions operators should answer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="grid gap-4">
                <input type="hidden" name="intent" value="create" />
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    required
                    placeholder="e.g. Boiler room weekly check"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    name="description"
                    rows={2}
                    className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    placeholder="Short explanation shown on the home page"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      name="category"
                      placeholder="e.g. Equipment"
                      autoComplete="off"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="equipmentLabel">
                      Equipment ID label (optional)
                    </Label>
                    <Input
                      id="equipmentLabel"
                      name="equipmentLabel"
                      placeholder="e.g. Forklift / unit ID"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div>
                  <Button type="submit">Create inspection</Button>
                </div>
              </Form>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75">
            <CardHeader>
              <CardTitle>All inspections</CardTitle>
              <CardDescription>
                Edit questions, or hide an inspection from the plant home page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inspections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No inspections yet. Create one above, or run{" "}
                  <code className="text-xs">npm run db:seed</code> for the
                  defaults.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {inspections.map((inspection) => (
                    <li
                      key={inspection.id}
                      className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-brand-navy">
                            {inspection.title}
                          </p>
                          <Badge variant="secondary">{inspection.category}</Badge>
                          {!inspection.isAvailable ? (
                            <Badge variant="outline">Hidden</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {inspection.questionCount} question
                          {inspection.questionCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/inspections/manage/${inspection.id}`}>
                            Edit questions
                          </Link>
                        </Button>
                        <Form method="post">
                          <input type="hidden" name="intent" value="toggle" />
                          <input
                            type="hidden"
                            name="inspectionId"
                            value={inspection.id}
                          />
                          <input
                            type="hidden"
                            name="isAvailable"
                            value={String(inspection.isAvailable)}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            {inspection.isAvailable ? "Hide" : "Show"}
                          </Button>
                        </Form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
