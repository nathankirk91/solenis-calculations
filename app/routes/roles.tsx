import { data, Form, Link } from "react-router";

import type { Route } from "./+types/roles";

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
import { countPendingRuns } from "~/lib/approvals.server";
import { requireAdmin } from "~/lib/auth.server";
import {
  createRole,
  deleteRole,
  listRoles,
  updateRole,
} from "~/lib/roles.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Roles") },
    {
      name: "description",
      content: "Create and manage roles that can be assigned to users.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAdmin(request, "/roles");
  const [roles, pendingCount] = await Promise.all([
    listRoles(),
    countPendingRuns(),
  ]);
  return { user, roles, pendingCount };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request, "/roles");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "add") {
      await createRole({
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
      });
      return { ok: true as const, message: "Role created." };
    }

    if (intent === "update") {
      await updateRole({
        roleId: String(formData.get("roleId") ?? ""),
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        isActive: formData.get("isActive") === "on",
      });
      return { ok: true as const, message: "Role updated." };
    }

    if (intent === "delete") {
      await deleteRole(String(formData.get("roleId") ?? ""));
      return { ok: true as const, message: "Role deleted." };
    }
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error ? error.message : "Could not update roles.",
      },
      { status: 400 },
    );
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function RolesPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, roles, pendingCount } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Admin</Badge>
            <Link
              to="/users"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Users
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Roles
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Built-in roles control app access. Add custom roles for permit
            sign-offs and other assignments.
          </p>
          {actionData && "error" in actionData && actionData.error ? (
            <p className="mt-3 text-sm text-destructive">{actionData.error}</p>
          ) : null}
          {actionData && "ok" in actionData && actionData.ok ? (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
              {actionData.message}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Add role</CardTitle>
              <CardDescription>
                New roles can be assigned to users and permit sign-off slots.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="grid gap-4">
                <input type="hidden" name="intent" value="add" />
                <div className="grid gap-2">
                  <Label htmlFor="role-name">Name</Label>
                  <Input
                    id="role-name"
                    name="name"
                    required
                    placeholder="e.g. Area supervisor"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role-description">Description</Label>
                  <Input
                    id="role-description"
                    name="description"
                    placeholder="Optional"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit">Add role</Button>
                </div>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing roles</CardTitle>
              <CardDescription>
                System roles stay active and cannot be deleted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-4">
                {roles.map((role) => (
                  <li
                    key={role.id}
                    className="rounded-lg border border-border/70 px-3 py-3"
                  >
                    <Form method="post" className="grid gap-3">
                      <input type="hidden" name="intent" value="update" />
                      <input type="hidden" name="roleId" value={role.id} />
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          name="name"
                          defaultValue={role.name}
                          required
                          className="max-w-xs"
                        />
                        {role.isSystem ? (
                          <Badge variant="secondary">System</Badge>
                        ) : null}
                        {!role.isActive ? (
                          <Badge variant="outline">Inactive</Badge>
                        ) : null}
                      </div>
                      <Input
                        name="description"
                        defaultValue={role.description}
                        placeholder="Description"
                      />
                      {!role.isSystem ? (
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="isActive"
                            defaultChecked={role.isActive}
                          />
                          Active
                        </label>
                      ) : (
                        <input type="hidden" name="isActive" value="on" />
                      )}
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button type="submit" size="sm" variant="outline">
                          Save
                        </Button>
                      </div>
                    </Form>
                    {!role.isSystem ? (
                      <Form method="post" className="mt-2 flex justify-end">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="roleId" value={role.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Delete
                        </Button>
                      </Form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
