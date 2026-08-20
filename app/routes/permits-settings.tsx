import { data, Form, Link } from "react-router";

import type { Route } from "./+types/permits-settings";

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
import { countPendingRuns } from "~/lib/approvals.server";
import { requireOperatorManager } from "~/lib/auth.server";
import { canReviewRuns } from "~/lib/roles";
import {
  listPermitSignOffSlots,
  listRoles,
  updatePermitSignOffSlotRoles,
} from "~/lib/roles.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Permit settings") },
    {
      name: "description",
      content:
        "Choose which roles may sign each permit authorisation slot.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireOperatorManager(request, "/permits/settings");
  const [slots, roles, pendingCount] = await Promise.all([
    listPermitSignOffSlots(),
    listRoles({ activeOnly: true, excludeAccessLevels: true }),
    canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
  ]);
  return { user, slots, roles, pendingCount };
}

export async function action({ request }: Route.ActionArgs) {
  await requireOperatorManager(request, "/permits/settings");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "save-slot") {
      const slotCode = String(formData.get("slotCode") ?? "");
      const roleIds = formData.getAll("roleIds").map(String);
      await updatePermitSignOffSlotRoles({ slotCode, roleIds });
      return { ok: true as const, message: "Sign-off roles updated." };
    }
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update permit settings.",
      },
      { status: 400 },
    );
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function PermitsSettingsPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, slots, roles, pendingCount } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Permits</Badge>
            <Link
              to="/permits"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Permits
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Permit settings
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Choose which roles may sign each authorisation slot when a permit is
            issued. Create roles on the Roles page, assign them to users, then
            select which roles may sign each slot here.
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
          {slots.map((slot) => {
            const selected = new Set(slot.allowedRoleIds);
            return (
              <Card key={slot.id}>
                <CardHeader>
                  <CardTitle>{slot.label}</CardTitle>
                  <CardDescription>
                    Users need at least one of the selected roles to sign this
                    slot.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form method="post" className="grid gap-4">
                    <input type="hidden" name="intent" value="save-slot" />
                    <input type="hidden" name="slotCode" value={slot.code} />
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
                            defaultChecked={selected.has(role.id)}
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
                    <div className="flex justify-end">
                      <Button type="submit" size="sm">
                        Save
                      </Button>
                    </div>
                  </Form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
