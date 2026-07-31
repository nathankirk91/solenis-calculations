import {
  getFormProps,
  useForm,
  type SubmissionResult,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { Form, Link, useNavigation } from "react-router";
import { data, redirect } from "react-router";

import type { Route } from "./+types/permit-run";

import { AppHeader } from "~/components/app-header";
import { SignaturePad } from "~/components/signature-pad";
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
import { requireUser } from "~/lib/auth.server";
import { formatMelbourneDateTime } from "~/lib/datetime";
import {
  formatLastAnswerDisplay,
  type InspectionAnswerRecord,
} from "~/lib/inspections";
import { createPermitCloseoutSchema } from "~/lib/permit.schema";
import {
  closePermitRun,
  getPermitRunById,
} from "~/lib/permits.server";
import { canReviewRuns } from "~/lib/roles";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Permit record | Springvale Solenis" },
    {
      name: "description",
      content: "View and close out a work permit.",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request, `/permits/runs/${params.permitRunId}`);
  const run = await getPermitRunById(params.permitRunId);
  if (!run) {
    throw new Response("Permit not found", { status: 404 });
  }
  const pendingCount = canReviewRuns(user.role)
    ? await countPendingRuns()
    : 0;
  return { user, pendingCount, run };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request, `/permits/runs/${params.permitRunId}`);
  const run = await getPermitRunById(params.permitRunId);
  if (!run) {
    throw new Response("Permit not found", { status: 404 });
  }
  if (run.status === "CLOSED") {
    return data({ error: "This permit is already closed." }, { status: 400 });
  }

  const formData = await request.formData();
  const submission = parseWithZod(formData, {
    schema: createPermitCloseoutSchema(),
  });
  if (submission.status !== "success") {
    return data(
      { lastResult: submission.reply(), error: null },
      { status: submission.status === "error" ? 400 : 200 },
    );
  }

  try {
    await closePermitRun({
      permitRunId: run.id,
      closedById: user.id,
      closeout: submission.value,
    });
  } catch (error) {
    return data(
      {
        lastResult: submission.reply(),
        error:
          error instanceof Error ? error.message : "Could not close the permit.",
      },
      { status: 400 },
    );
  }

  throw redirect(`/permits/runs/${run.id}`);
}

export default function PermitRunPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, pendingCount, run } = loaderData;
  const isOpen = run.status === "OPEN";

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                isOpen
                  ? "border-amber-600/40 text-amber-800"
                  : "border-emerald-600/40 text-emerald-700",
              )}
            >
              {isOpen ? "Open" : "Closed"}
            </Badge>
            <Link
              to="/permits"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Permits
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {run.inspectionTitle}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Opened {formatMelbourneDateTime(run.createdAt)}
            {run.submittedByName ? ` · ${run.submittedByName}` : ""}
            {run.equipmentRef ? ` · ${run.equipmentRef}` : ""}
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Permit details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {groupAnswersBySection(run.answers).map((group) => (
                <div
                  key={group.title ?? "general"}
                  className="rounded-lg border border-border/70 bg-background/50 p-4"
                >
                  {group.title ? (
                    <h3 className="font-medium">{group.title}</h3>
                  ) : (
                    <h3 className="font-medium">Answers</h3>
                  )}
                  <ul className="mt-3 grid gap-2">
                    {group.rows.map((row) => (
                      <li
                        key={row.questionId}
                        className="flex flex-wrap items-start justify-between gap-2 text-sm"
                      >
                        <span className="text-muted-foreground">{row.label}</span>
                        <Badge
                          variant="outline"
                          className="max-w-full shrink-0 whitespace-normal text-left"
                        >
                          {row.answer
                            ? formatLastAnswerDisplay(row.answer, row.type)
                            : "—"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="rounded-lg border border-border/70 bg-background/50 p-4">
                <h3 className="font-medium">Authorized personnel</h3>
                <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
                  {run.authorizedPersonnel.map((name) => (
                    <li key={name}>• {name}</li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3">
                <h3 className="font-medium">Authorization</h3>
                <AuthorizationDisplay
                  title="Operations rep"
                  name={run.authorization.operationsRep.name}
                  signature={run.authorization.operationsRep.signature}
                />
                <AuthorizationDisplay
                  title="Maintenance rep"
                  name={run.authorization.maintenanceRep.name}
                  signature={run.authorization.maintenanceRep.signature}
                />
                <AuthorizationDisplay
                  title="Safe work coordinator"
                  name={run.authorization.safeWorkCoordinator.name}
                  signature={run.authorization.safeWorkCoordinator.signature}
                />
              </div>
            </CardContent>
          </Card>

          {isOpen ? (
            <CloseoutForm
              lastResult={
                actionData && "lastResult" in actionData
                  ? actionData.lastResult
                  : null
              }
              error={
                actionData && "error" in actionData ? actionData.error : null
              }
            />
          ) : run.closeout ? (
            <Card>
              <CardHeader>
                <CardTitle>Permit close-out</CardTitle>
                <CardDescription>
                  Closed {run.closedAt ? formatMelbourneDateTime(run.closedAt) : ""}
                  {run.closedByName ? ` · ${run.closedByName}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                      Date
                    </dt>
                    <dd className="text-sm font-medium">{run.closeout.date}</dd>
                  </div>
                  <div>
                    <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                      Time
                    </dt>
                    <dd className="text-sm font-medium">{run.closeout.time}</dd>
                  </div>
                </dl>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium">Operators initials</p>
                    <img
                      src={run.closeout.operatorsInitials}
                      alt="Operators initials"
                      className="h-20 w-auto rounded border border-border/50 bg-white object-contain"
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium">
                      Maintenance initials
                    </p>
                    <img
                      src={run.closeout.maintenanceInitials}
                      alt="Maintenance initials"
                      className="h-20 w-auto rounded border border-border/50 bg-white object-contain"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function CloseoutForm({
  lastResult,
  error,
}: {
  lastResult?: SubmissionResult<string[]> | null;
  error?: string | null;
}) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const [form, fields] = useForm({
    lastResult: lastResult ?? undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createPermitCloseoutSchema() });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    defaultValue: {
      date: "",
      time: "",
      operatorsInitials: "",
      maintenanceInitials: "",
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Close out this permit</CardTitle>
        <CardDescription>
          Complete when the job is finished. This marks the permit closed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form method="post" className="grid gap-4" {...getFormProps(form)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={fields.date.id}>Close-out date</Label>
              <Input
                id={fields.date.id}
                name={fields.date.name}
                key={fields.date.key}
                type="date"
                defaultValue={
                  typeof fields.date.initialValue === "string"
                    ? fields.date.initialValue
                    : ""
                }
                aria-invalid={Boolean(fields.date.errors)}
              />
              {fields.date.errors ? (
                <p className="text-sm text-destructive">
                  {fields.date.errors.join(" ")}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor={fields.time.id}>Close-out time</Label>
              <Input
                id={fields.time.id}
                name={fields.time.name}
                key={fields.time.key}
                type="time"
                defaultValue={
                  typeof fields.time.initialValue === "string"
                    ? fields.time.initialValue
                    : ""
                }
                aria-invalid={Boolean(fields.time.errors)}
              />
              {fields.time.errors ? (
                <p className="text-sm text-destructive">
                  {fields.time.errors.join(" ")}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Operators initials</Label>
            <SignaturePad
              name={fields.operatorsInitials.name}
              id={fields.operatorsInitials.id}
              required
              error={fields.operatorsInitials.errors?.join(" ")}
            />
          </div>
          <div className="grid gap-2">
            <Label>Maintenance initials</Label>
            <SignaturePad
              name={fields.maintenanceInitials.name}
              id={fields.maintenanceInitials.id}
              required
              error={fields.maintenanceInitials.errors?.join(" ")}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {form.errors ? (
            <p className="text-sm text-destructive">{form.errors.join(" ")}</p>
          ) : null}

          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? "Closing…" : "Close permit"}
          </Button>
        </Form>
      </CardContent>
    </Card>
  );
}

function AuthorizationDisplay({
  title,
  name,
  signature,
}: {
  title: string;
  name: string;
  signature: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/50 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{name || "—"}</p>
      {signature ? (
        <img
          src={signature}
          alt={`${title} initials`}
          className="mt-3 h-16 w-auto rounded border border-border/50 bg-white object-contain"
        />
      ) : null}
    </div>
  );
}

function groupAnswersBySection(rows: InspectionAnswerRecord[]) {
  const groups: Array<{
    title: string | null;
    rows: InspectionAnswerRecord[];
  }> = [];
  for (const row of rows) {
    const title = row.sectionTitle;
    const existing = groups.find((group) => group.title === title);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.push({ title, rows: [row] });
    }
  }
  return groups;
}
