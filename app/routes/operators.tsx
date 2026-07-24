import { data, Form, Link } from "react-router";

import type { Route } from "./+types/operators";

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
  createOperator,
  listManagedOperators,
  removeOperator,
} from "~/lib/operators.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Operators | Springvale Solenis" },
    {
      name: "description",
      content: "Add or remove plant operators for calculation submissions.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireOperatorManager(request);
  const [operators, pendingCount] = await Promise.all([
    listManagedOperators(),
    countPendingRuns(),
  ]);

  return { user, operators, pendingCount };
}

export async function action({ request }: Route.ActionArgs) {
  await requireOperatorManager(request);

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "add") {
      const name = String(formData.get("name") ?? "");
      await createOperator(name);
      return { ok: true as const };
    }

    if (intent === "remove") {
      const operatorId = String(formData.get("operatorId") ?? "");
      if (!operatorId) {
        return data({ error: "Missing operator." }, { status: 400 });
      }
      await removeOperator(operatorId);
      return { ok: true as const };
    }
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update operators.",
      },
      { status: 400 },
    );
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function OperatorsPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, operators, pendingCount } = loaderData;

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
              ← All calculators
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Operators
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Add or remove names shown in the operator dropdown on calculation
            forms.
          </p>
          {actionData && "error" in actionData && actionData.error ? (
            <p className="mt-3 text-sm text-destructive">{actionData.error}</p>
          ) : null}
        </div>

        <div className="grid gap-4">
          <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <CardHeader>
              <CardTitle>Add operator</CardTitle>
              <CardDescription>
                New names appear immediately on plant calculator forms.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="flex flex-col gap-3 sm:flex-row">
                <input type="hidden" name="intent" value="add" />
                <div className="grid flex-1 gap-2">
                  <Label htmlFor="operator-name">Name</Label>
                  <Input
                    id="operator-name"
                    name="name"
                    required
                    placeholder="e.g. Jane Smith"
                    autoComplete="off"
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit">Add operator</Button>
                </div>
              </Form>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75">
            <CardHeader>
              <CardTitle>Active operators</CardTitle>
              <CardDescription>
                Removing an operator hides them from new submissions. Past
                approval history is kept.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {operators.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active operators yet. Add one above.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {operators.map((operator) => (
                    <li
                      key={operator.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-2"
                    >
                      <span className="font-medium">{operator.name}</span>
                      <Form method="post">
                        <input type="hidden" name="intent" value="remove" />
                        <input
                          type="hidden"
                          name="operatorId"
                          value={operator.id}
                        />
                        <Button type="submit" variant="outline" size="sm">
                          Remove
                        </Button>
                      </Form>
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
