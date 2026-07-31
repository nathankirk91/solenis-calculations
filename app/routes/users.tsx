import { data, Form, Link } from "react-router";

import type { Route } from "./+types/users";

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
import { listRoles } from "~/lib/roles.server";
import {
  createManagedUser,
  listManagedUsers,
  updateManagedUserRoles,
} from "~/lib/user.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Users | Springvale Solenis" },
    {
      name: "description",
      content: "Create users and assign one or more roles.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAdmin(request);
  const [users, roles, pendingCount] = await Promise.all([
    listManagedUsers(),
    listRoles({ activeOnly: true }),
    countPendingRuns(),
  ]);

  return { user, users, roles, pendingCount };
}

export async function action({ request }: Route.ActionArgs) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const roleIds = formData.getAll("roleIds").map(String);

  try {
    if (intent === "add") {
      await createManagedUser({
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        roleIds,
        assignedById: admin.id,
      });
      return { ok: true as const, message: "User added." };
    }

    if (intent === "update-roles") {
      const userId = String(formData.get("userId") ?? "");
      if (!userId) {
        return data({ error: "Missing user." }, { status: 400 });
      }
      await updateManagedUserRoles({
        userId,
        roleIds,
        assignedById: admin.id,
      });
      return { ok: true as const, message: "Roles updated." };
    }
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error ? error.message : "Could not update users.",
      },
      { status: 400 },
    );
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function UsersPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, users, roles, pendingCount } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Admin</Badge>
            <Link
              to="/"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Home
            </Link>
            <Link
              to="/roles"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Manage roles
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Users
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Create accounts and assign one or more roles. System roles
            (Admin / Manager / Operator) control app access; custom roles can
            unlock permit sign-offs.
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
          <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <CardHeader>
              <CardTitle>Add user</CardTitle>
              <CardDescription>
                Users sign in with their own email and password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="grid gap-4">
                <input type="hidden" name="intent" value="add" />
                <div className="grid gap-2">
                  <Label htmlFor="user-name">Name</Label>
                  <Input
                    id="user-name"
                    name="name"
                    required
                    placeholder="e.g. Alex Operator"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="user-email">Email</Label>
                  <Input
                    id="user-email"
                    name="email"
                    type="email"
                    required
                    placeholder="alex@example.com"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="user-password">Password</Label>
                  <Input
                    id="user-password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                  />
                </div>
                <fieldset className="grid gap-2">
                  <legend className="text-sm font-medium">Roles</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {roles.map((role) => (
                      <label
                        key={role.id}
                        className="flex items-start gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="roleIds"
                          value={role.id}
                          className="mt-1"
                        />
                        <span>
                          <span className="font-medium">{role.name}</span>
                          {role.description ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {role.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="flex justify-end">
                  <Button type="submit">Add user</Button>
                </div>
              </Form>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75">
            <CardHeader>
              <CardTitle>Current users</CardTitle>
              <CardDescription>
                Update role assignments at any time. Users must sign in again
                for access changes to apply.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No users yet. Add one above.
                </p>
              ) : (
                <ul className="grid gap-4">
                  {users.map((managed) => {
                    const assigned = new Set(
                      managed.roles.map((role) => role.id),
                    );
                    return (
                      <li
                        key={managed.id}
                        className="rounded-lg border border-border/70 bg-background/50 px-3 py-3"
                      >
                        <div className="mb-3">
                          <p className="font-medium">
                            {managed.name?.trim() || "Unnamed user"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {managed.email}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Access: {managed.role}
                            {managed.roles.length > 0
                              ? ` · ${managed.roles.map((role) => role.name).join(", ")}`
                              : ""}
                          </p>
                        </div>
                        <Form method="post" className="grid gap-3">
                          <input type="hidden" name="intent" value="update-roles" />
                          <input type="hidden" name="userId" value={managed.id} />
                          <div className="grid gap-2 sm:grid-cols-2">
                            {roles.map((role) => (
                              <label
                                key={role.id}
                                className="flex items-start gap-2 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  name="roleIds"
                                  value={role.id}
                                  defaultChecked={assigned.has(role.id)}
                                  className="mt-1"
                                />
                                <span>{role.name}</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex justify-end">
                            <Button type="submit" variant="outline" size="sm">
                              Save roles
                            </Button>
                          </div>
                        </Form>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
