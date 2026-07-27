import { data, Form, Link } from "react-router";

import type { Route } from "./+types/managers";

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
import { createManager, listManagers } from "~/lib/user.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Managers | Springvale Solenis" },
    {
      name: "description",
      content: "Add manager accounts that can approve plant calculations.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAdmin(request);
  const [managers, pendingCount] = await Promise.all([
    listManagers(),
    countPendingRuns(),
  ]);

  return { user, managers, pendingCount };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "add") {
      await createManager({
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });
      return { ok: true as const };
    }
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create manager.",
      },
      { status: 400 },
    );
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function ManagersPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, managers, pendingCount } = loaderData;

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
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Managers
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Create manager accounts that can review approvals and manage
            operators.
          </p>
          {actionData && "error" in actionData && actionData.error ? (
            <p className="mt-3 text-sm text-destructive">{actionData.error}</p>
          ) : null}
          {actionData && "ok" in actionData && actionData.ok ? (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
              Manager added. They can sign in with the email and password you
              set.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4">
          <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <CardHeader>
              <CardTitle>Add manager</CardTitle>
              <CardDescription>
                Managers sign in with their own email and password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="grid gap-4">
                <input type="hidden" name="intent" value="add" />
                <div className="grid gap-2">
                  <Label htmlFor="manager-name">Name</Label>
                  <Input
                    id="manager-name"
                    name="name"
                    required
                    placeholder="e.g. Alex Manager"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manager-email">Email</Label>
                  <Input
                    id="manager-email"
                    name="email"
                    type="email"
                    required
                    placeholder="alex@example.com"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manager-password">Password</Label>
                  <Input
                    id="manager-password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit">Add manager</Button>
                </div>
              </Form>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75">
            <CardHeader>
              <CardTitle>Current managers</CardTitle>
              <CardDescription>
                These accounts can approve or reject pending calculations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {managers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No managers yet. Add one above.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {managers.map((manager) => (
                    <li
                      key={manager.id}
                      className="rounded-lg border border-border/70 bg-background/50 px-3 py-2"
                    >
                      <p className="font-medium">
                        {manager.name?.trim() || "Unnamed manager"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {manager.email}
                      </p>
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
