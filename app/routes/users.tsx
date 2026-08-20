import { data, Form, Link } from "react-router";

import type { Route } from "./+types/users";

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
import { ACCESS_LEVEL_LABELS, type UserRole } from "~/lib/roles";
import {
  isAccessLevelRole,
  listRoles,
} from "~/lib/roles.server";
import {
  createManagedUser,
  listManagedUsers,
  updateManagedUser,
} from "~/lib/user.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Users") },
    {
      name: "description",
      content: "Create users and assign one or more roles.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAdmin(request);
  const [users, allRoles, pendingCount] = await Promise.all([
    listManagedUsers(),
    listRoles({ activeOnly: true }),
    countPendingRuns(),
  ]);

  const accessLevels = allRoles.filter((role) => isAccessLevelRole(role.slug));
  const businessRoles = allRoles.filter(
    (role) => !isAccessLevelRole(role.slug),
  );

  return { user, users, accessLevels, businessRoles, pendingCount };
}

export async function action({ request }: Route.ActionArgs) {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const roleIds = [
    String(formData.get("accessLevelRoleId") ?? ""),
    ...formData.getAll("roleIds").map(String),
  ].filter(Boolean);

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

    if (intent === "update") {
      const userId = String(formData.get("userId") ?? "");
      if (!userId) {
        return data({ error: "Missing user." }, { status: 400 });
      }
      const password = String(formData.get("password") ?? "");
      await updateManagedUser({
        userId,
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: password || undefined,
        roleIds,
        assignedById: admin.id,
      });
      return {
        ok: true as const,
        message: password
          ? "User updated (password changed)."
          : "User updated.",
      };
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
  const { user, users, accessLevels, businessRoles, pendingCount } =
    loaderData;

  function accessLevelRoleIdFor(userRole: UserRole) {
    const slug =
      userRole === "ADMIN"
        ? "admin"
        : userRole === "APPROVER"
          ? "approver"
          : "standard";
    return (
      accessLevels.find(
        (level) =>
          level.slug === slug ||
          (slug === "approver" && level.slug === "manager") ||
          (slug === "standard" && level.slug === "operator"),
      )?.id ??
      accessLevels[0]?.id ??
      ""
    );
  }

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
            Create accounts, set an access level (Admin, Approver, or Standard
            access), and assign business roles such as hSolenis Operator.
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
                  <legend className="text-sm font-medium">Access level</legend>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {accessLevels.map((level) => (
                      <label
                        key={level.id}
                        className="flex items-start gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
                      >
                        <input
                          type="radio"
                          name="accessLevelRoleId"
                          value={level.id}
                          defaultChecked={level.slug === "standard"}
                          required
                          className="mt-1"
                        />
                        <span>
                          <span className="font-medium">
                            {ACCESS_LEVEL_LABELS[
                              level.slug === "admin"
                                ? "ADMIN"
                                : level.slug === "approver"
                                  ? "APPROVER"
                                  : "STANDARD"
                            ] ?? level.name}
                          </span>
                          {level.description ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {level.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {businessRoles.length > 0 ? (
                  <fieldset className="grid gap-2">
                    <legend className="text-sm font-medium">Roles</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {businessRoles.map((role) => (
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
                ) : null}
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
                Edit name, email, roles, or set a new password. Leave password
                blank to keep the current one. Users must sign in again for
                access changes to apply.
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
                    const assignedBusiness = new Set(
                      managed.roles
                        .filter((role) => !isAccessLevelRole(role.slug))
                        .map((role) => role.id),
                    );
                    const accessLevelRoleId = accessLevelRoleIdFor(
                      managed.role,
                    );
                    return (
                      <li
                        key={managed.id}
                        className="rounded-lg border border-border/70 bg-background/50 px-3 py-3"
                      >
                        <Form method="post" className="grid gap-3">
                          <input type="hidden" name="intent" value="update" />
                          <input type="hidden" name="userId" value={managed.id} />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-2">
                              <Label htmlFor={`name-${managed.id}`}>Name</Label>
                              <Input
                                id={`name-${managed.id}`}
                                name="name"
                                required
                                defaultValue={managed.name ?? ""}
                                autoComplete="off"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor={`email-${managed.id}`}>
                                Email
                              </Label>
                              <Input
                                id={`email-${managed.id}`}
                                name="email"
                                type="email"
                                required
                                defaultValue={managed.email}
                                autoComplete="off"
                              />
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={`password-${managed.id}`}>
                              New password
                            </Label>
                            <Input
                              id={`password-${managed.id}`}
                              name="password"
                              type="password"
                              minLength={6}
                              placeholder="Leave blank to keep current password"
                              autoComplete="new-password"
                            />
                          </div>
                          <fieldset className="grid gap-2">
                            <legend className="text-sm font-medium">
                              Access level
                            </legend>
                            <div className="grid gap-2 sm:grid-cols-3">
                              {accessLevels.map((level) => (
                                <label
                                  key={level.id}
                                  className="flex items-start gap-2 text-sm"
                                >
                                  <input
                                    type="radio"
                                    name="accessLevelRoleId"
                                    value={level.id}
                                    defaultChecked={
                                      level.id === accessLevelRoleId
                                    }
                                    required
                                    className="mt-1"
                                  />
                                  <span>
                                    {ACCESS_LEVEL_LABELS[
                                      level.slug === "admin"
                                        ? "ADMIN"
                                        : level.slug === "approver"
                                          ? "APPROVER"
                                          : "STANDARD"
                                    ] ?? level.name}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </fieldset>
                          {businessRoles.length > 0 ? (
                            <fieldset className="grid gap-2">
                              <legend className="text-sm font-medium">
                                Roles
                              </legend>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {businessRoles.map((role) => (
                                  <label
                                    key={role.id}
                                    className="flex items-start gap-2 text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      name="roleIds"
                                      value={role.id}
                                      defaultChecked={assignedBusiness.has(
                                        role.id,
                                      )}
                                      className="mt-1"
                                    />
                                    <span>{role.name}</span>
                                  </label>
                                ))}
                              </div>
                            </fieldset>
                          ) : null}
                          <div className="flex justify-end">
                            <Button type="submit" variant="outline" size="sm">
                              Save user
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
