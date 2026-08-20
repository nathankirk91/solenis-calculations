import { data, Form, Link, redirect } from "react-router";

import type { Route } from "./+types/permits-manage";

import { pageTitle } from "~/lib/brand";
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
import { Textarea } from "~/components/ui/textarea";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireOperatorManager } from "~/lib/auth.server";
import { seedDefaultInspections, setInspectionAvailability } from "~/lib/inspections.server";
import {
  createManagedPermit,
  duplicateManagedPermit,
  listManagedPermits,
} from "~/lib/permits.server";
import { ensureInspectionSchema } from "~/lib/migrate.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Manage permits") },
    {
      name: "description",
      content: "Create and manage work permit forms and questions.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireOperatorManager(request);

  let migrateNote: string | null = null;
  let permits = await listManagedPermits();

  if (permits.length === 0) {
    try {
      await ensureInspectionSchema();
      const seeded = await seedDefaultInspections();
      migrateNote = `Synced ${seeded} built-in forms (including Safe Work Permit).`;
      permits = await listManagedPermits();
    } catch (error) {
      migrateNote =
        error instanceof Error
          ? error.message
          : "Could not load permit forms.";
    }
  }

  const pendingCount = await countPendingRuns();
  return { user, permits, pendingCount, migrateNote };
}

export async function action({ request }: Route.ActionArgs) {
  await requireOperatorManager(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "seed-defaults") {
      await ensureInspectionSchema();
      const seeded = await seedDefaultInspections();
      return { ok: true as const, seeded };
    }

    if (intent === "create") {
      const created = await createManagedPermit({
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        equipmentLabel: String(formData.get("equipmentLabel") ?? ""),
        requiredSignerCount: Number(formData.get("requiredSignerCount") ?? 2),
      });
      throw redirect(`/permits/manage/${created.id}`);
    }

    if (intent === "duplicate") {
      const sourceInspectionId = String(
        formData.get("sourceInspectionId") ?? "",
      );
      if (!sourceInspectionId) {
        return data({ error: "Missing permit to copy." }, { status: 400 });
      }
      const created = await duplicateManagedPermit({
        sourceInspectionId,
        title: String(formData.get("title") ?? ""),
      });
      throw redirect(`/permits/manage/${created.id}`);
    }

    if (intent === "toggle") {
      const inspectionId = String(formData.get("inspectionId") ?? "");
      const isAvailable = String(formData.get("isAvailable") ?? "") === "true";
      if (!inspectionId) {
        return data({ error: "Missing permit." }, { status: 400 });
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
            : "Could not update permits.",
      },
      { status: 400 },
    );
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function PermitsManagePage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, permits, pendingCount, migrateNote } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Management</Badge>
            <Link
              to="/permits"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Permits
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Manage permits
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Build new permit types here — Hot Work, Line Break, Confined Space,
            and so on — without a code deploy. Create a blank form or duplicate
            Safe Work Permit, edit the checklist, then show it on the Permits
            page.
          </p>
          {migrateNote ? (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
              {migrateNote}
            </p>
          ) : null}
          {actionData && "seeded" in actionData && actionData.seeded != null ? (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
              Synced {actionData.seeded} built-in forms.
            </p>
          ) : null}
          {actionData && "error" in actionData && actionData.error ? (
            <p className="mt-3 text-sm text-destructive">{actionData.error}</p>
          ) : null}
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Add permit form</CardTitle>
              <CardDescription>
                Starts empty. After creating, add questions and mark Start time,
                End time, and Area so duration and dashboard display work.
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
                    placeholder="e.g. Hot Work Permit"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={2}
                    placeholder="Short explanation shown on the Permits page"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="equipmentLabel">
                    Equipment ID label (optional)
                  </Label>
                  <Input
                    id="equipmentLabel"
                    name="equipmentLabel"
                    placeholder="e.g. Equipment number"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="requiredSignerCount">
                    Signatures required to open
                  </Label>
                  <select
                    id="requiredSignerCount"
                    name="requiredSignerCount"
                    defaultValue="2"
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="2">2 different people</option>
                    <option value="3">All 3 authorisation slots</option>
                  </select>
                </div>
                <div>
                  <Button type="submit">Create permit form</Button>
                </div>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Permit forms</CardTitle>
              <CardDescription>
                Edit questions, duplicate an existing form as a starting point,
                or hide a form from the Permits page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {permits.length === 0 ? (
                <div className="grid gap-3">
                  <p className="text-sm text-muted-foreground">
                    No permit forms yet. Load the built-in Safe Work Permit to
                    get started.
                  </p>
                  <Form method="post">
                    <input type="hidden" name="intent" value="seed-defaults" />
                    <Button type="submit">Load default permits</Button>
                  </Form>
                </div>
              ) : (
                <ul className="grid gap-3">
                  {permits.map((permit) => (
                    <li
                      key={permit.id}
                      className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-brand-navy">
                            {permit.title}
                          </p>
                          <Badge variant="outline">v{permit.version}</Badge>
                          {!permit.isAvailable ? (
                            <Badge variant="outline">Hidden</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {permit.questionCount} question
                          {permit.questionCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/permits/manage/${permit.id}`}>
                            Edit questions
                          </Link>
                        </Button>
                        <Form method="post">
                          <input type="hidden" name="intent" value="duplicate" />
                          <input
                            type="hidden"
                            name="sourceInspectionId"
                            value={permit.id}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            Duplicate
                          </Button>
                        </Form>
                        <Form method="post">
                          <input type="hidden" name="intent" value="toggle" />
                          <input
                            type="hidden"
                            name="inspectionId"
                            value={permit.id}
                          />
                          <input
                            type="hidden"
                            name="isAvailable"
                            value={String(permit.isAvailable)}
                          />
                          <Button type="submit" variant="ghost" size="sm">
                            {permit.isAvailable ? "Hide" : "Show"}
                          </Button>
                        </Form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {permits.length > 0 ? (
                <Form method="post" className="mt-4">
                  <input type="hidden" name="intent" value="seed-defaults" />
                  <Button type="submit" variant="outline" size="sm">
                    Re-sync built-in defaults
                  </Button>
                </Form>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
