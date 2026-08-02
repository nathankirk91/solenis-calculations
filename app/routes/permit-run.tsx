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
import {
  createPermitCloseoutSchema,
  createPermitSignOffSchema,
  isPermitAuthSlotSigned,
  needsFewerThanTwoSignersReason,
  PERMIT_AUTH_SLOT_KEYS,
  PERMIT_AUTH_SLOT_LABELS,
  type PermitAuthSlotKey,
} from "~/lib/permit.schema";
import {
  closePermitRun,
  getPermitRunById,
  listUnsignedSlotsForUser,
  signOffPermitSlot,
} from "~/lib/permits.server";
import { canReviewRuns } from "~/lib/roles";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Permit record | Springvale Solenis" },
    {
      name: "description",
      content: "Review, authorize, or close out a work permit.",
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
  const signOffSlots =
    run.status === "PENDING_AUTHORIZATION"
      ? await listUnsignedSlotsForUser({
          userId: user.id,
          authorization: run.authorization,
        })
      : [];
  const requireFewerThanTwoReason = signOffSlots.some((slot) =>
    needsFewerThanTwoSignersReason({
      authorization: run.authorization,
      slotKey: slot,
      userId: user.id,
    }),
  );

  return {
    user,
    pendingCount,
    run,
    signOffSlots,
    requireFewerThanTwoReason,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request, `/permits/runs/${params.permitRunId}`);
  const run = await getPermitRunById(params.permitRunId);
  if (!run) {
    throw new Response("Permit not found", { status: 404 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "closeout");

  if (intent === "sign-off") {
    if (run.status !== "PENDING_AUTHORIZATION") {
      return data(
        { error: "This permit is not awaiting authorization.", lastResult: null },
        { status: 400 },
      );
    }

    const allowedSlots = await listUnsignedSlotsForUser({
      userId: user.id,
      authorization: run.authorization,
    });
    const selectedSlot = String(formData.get("slotKey") ?? "") as PermitAuthSlotKey;
    const requireFewerThanTwoReason = needsFewerThanTwoSignersReason({
      authorization: run.authorization,
      slotKey: allowedSlots.includes(selectedSlot)
        ? selectedSlot
        : (allowedSlots[0] ?? "operationsRep"),
      userId: user.id,
    });
    const submission = parseWithZod(formData, {
      schema: createPermitSignOffSchema(allowedSlots, {
        requireFewerThanTwoReason,
      }),
    });
    if (submission.status !== "success") {
      return data(
        { lastResult: submission.reply(), error: null },
        { status: submission.status === "error" ? 400 : 200 },
      );
    }

    try {
      await signOffPermitSlot({
        permitRunId: run.id,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        slotKey: submission.value.slotKey as PermitAuthSlotKey,
        signature: submission.value.signature,
        siteVerified: submission.value.siteVerified === "on",
        fewerThanTwoSignersReason: submission.value.fewerThanTwoSignersReason,
      });
    } catch (error) {
      return data(
        {
          lastResult: submission.reply(),
          error:
            error instanceof Error
              ? error.message
              : "Could not save sign-off.",
        },
        { status: 400 },
      );
    }

    throw redirect(`/permits/runs/${run.id}`);
  }

  if (run.status === "CLOSED") {
    return data({ error: "This permit is already closed." }, { status: 400 });
  }
  if (run.status !== "OPEN") {
    return data(
      { error: "Permit must be fully authorized before close-out." },
      { status: 400 },
    );
  }

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
          error instanceof Error
            ? error.message
            : "Could not close the permit.",
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
  const {
    user,
    pendingCount,
    run,
    signOffSlots,
    requireFewerThanTwoReason,
  } = loaderData;
  const isPending = run.status === "PENDING_AUTHORIZATION";
  const isOpen = run.status === "OPEN";
  const isClosed = run.status === "CLOSED";

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                isPending && "border-sky-600/40 text-sky-800",
                isOpen && "border-amber-600/40 text-amber-800",
                isClosed && "border-emerald-600/40 text-emerald-700",
              )}
            >
              {isPending
                ? "Pending authorization"
                : isOpen
                  ? "Open"
                  : "Closed"}
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
            Submitted {formatMelbourneDateTime(run.createdAt)}
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
                <p className="mt-1 text-xs text-muted-foreground">
                  Technicians, contractors, and visitors authorised to perform
                  the work.
                </p>
                <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
                  {run.authorizedPersonnel.map((name) => (
                    <li key={name}>• {name}</li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3">
                <h3 className="font-medium">Authorization</h3>
                <p className="text-sm text-muted-foreground">
                  Minimum of two separate people must sign unless no other
                  employees are available.
                </p>
                {PERMIT_AUTH_SLOT_KEYS.map((key) => {
                  const person = run.authorization[key];
                  const signed = isPermitAuthSlotSigned(person);
                  return (
                    <AuthorizationDisplay
                      key={key}
                      title={PERMIT_AUTH_SLOT_LABELS[key]}
                      name={person.name}
                      signature={person.signature}
                      siteVerifiedAt={person.siteVerifiedAt}
                      pending={!signed}
                    />
                  );
                })}
                {run.authorization.fewerThanTwoSignersReason ? (
                  <div className="rounded-lg border border-amber-600/30 bg-amber-50/60 p-4">
                    <p className="text-sm font-medium text-amber-950">
                      Fewer than two separate signatures
                    </p>
                    <p className="mt-1 text-sm text-amber-900/80">
                      {run.authorization.fewerThanTwoSignersReason}
                    </p>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {isPending && signOffSlots.length > 0 ? (
            <SignOffForm
              slots={signOffSlots}
              requireFewerThanTwoReason={requireFewerThanTwoReason}
              lastResult={
                actionData && "lastResult" in actionData
                  ? actionData.lastResult
                  : null
              }
              error={
                actionData && "error" in actionData ? actionData.error : null
              }
            />
          ) : null}

          {isPending && signOffSlots.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Awaiting authorization</CardTitle>
                <CardDescription>
                  Operations representative / Account manager, Maintenance
                  representative / Account technician, and Safe work coordinator
                  must each sign off before this permit opens. Approvers must
                  visually inspect the job site first. You do not currently have
                  an unsigned role on this permit.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

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
          ) : null}

          {isClosed && run.closeout ? (
            <Card>
              <CardHeader>
                <CardTitle>Permit close-out</CardTitle>
                <CardDescription>
                  Closed {run.closedAt ? formatMelbourneDateTime(run.closedAt) : ""}
                  {run.closedByName ? ` · ${run.closedByName}` : ""}
                  . Retain closed permits for at least one year.
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

function SignOffForm({
  slots,
  requireFewerThanTwoReason,
  lastResult,
  error,
}: {
  slots: PermitAuthSlotKey[];
  requireFewerThanTwoReason: boolean;
  lastResult?: SubmissionResult<string[]> | null;
  error?: string | null;
}) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const schema = createPermitSignOffSchema(slots, {
    requireFewerThanTwoReason,
  });
  const [form, fields] = useForm({
    lastResult: lastResult ?? undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    defaultValue: {
      intent: "sign-off",
      slotKey: slots[0],
      signature: "",
      siteVerified: "",
      fewerThanTwoSignersReason: "",
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign off</CardTitle>
        <CardDescription>
          Visually inspect the job site, then sign as one of your eligible
          roles. Permits must be approved before work begins.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form method="post" className="grid gap-4" {...getFormProps(form)}>
          <input type="hidden" name="intent" value="sign-off" />
          {slots.length === 1 ? (
            <input type="hidden" name="slotKey" value={slots[0]} />
          ) : (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">
                Sign off as
              </legend>
              {slots.map((slot) => (
                <label
                  key={slot}
                  className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name={fields.slotKey.name}
                    value={slot}
                    defaultChecked={slot === slots[0]}
                  />
                  {PERMIT_AUTH_SLOT_LABELS[slot]}
                </label>
              ))}
              {fields.slotKey.errors ? (
                <p className="text-sm text-destructive">
                  {fields.slotKey.errors.join(" ")}
                </p>
              ) : null}
            </fieldset>
          )}

          <label className="flex items-start gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-3 text-sm">
            <input
              type="checkbox"
              id={fields.siteVerified.id}
              name={fields.siteVerified.name}
              value="on"
              defaultChecked={fields.siteVerified.initialValue === "on"}
              className="mt-1 size-4 shrink-0 rounded border border-input"
              aria-invalid={Boolean(fields.siteVerified.errors)}
            />
            <span className="grid gap-1">
              <span className="font-medium leading-snug">
                I conducted a visual inspection of the job site before approving
              </span>
              <span className="text-xs text-muted-foreground">
                Required by the Safe Work Permitting Process before work begins.
              </span>
              {fields.siteVerified.errors ? (
                <span className="text-sm text-destructive" role="alert">
                  {fields.siteVerified.errors.join(" ")}
                </span>
              ) : null}
            </span>
          </label>

          {requireFewerThanTwoReason ? (
            <div className="grid gap-2">
              <Label htmlFor={fields.fewerThanTwoSignersReason.id}>
                Reason fewer than two separate signatures
              </Label>
              <textarea
                id={fields.fewerThanTwoSignersReason.id}
                name={fields.fewerThanTwoSignersReason.name}
                key={fields.fewerThanTwoSignersReason.key}
                rows={3}
                defaultValue={
                  typeof fields.fewerThanTwoSignersReason.initialValue ===
                  "string"
                    ? fields.fewerThanTwoSignersReason.initialValue
                    : ""
                }
                placeholder="Document why no other employee is available to provide a second signature…"
                className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-invalid={Boolean(
                  fields.fewerThanTwoSignersReason.errors,
                )}
              />
              <p className="text-xs text-muted-foreground">
                Procedure requires a minimum of two separate signatures unless
                no other employees are available.
              </p>
              {fields.fewerThanTwoSignersReason.errors ? (
                <p className="text-sm text-destructive">
                  {fields.fewerThanTwoSignersReason.errors.join(" ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label>Initials</Label>
            <SignaturePad
              name={fields.signature.name}
              id={fields.signature.id}
              required
              error={fields.signature.errors?.join(" ")}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {form.errors ? (
            <p className="text-sm text-destructive">{form.errors.join(" ")}</p>
          ) : null}

          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? "Signing…" : "Submit sign-off"}
          </Button>
        </Form>
      </CardContent>
    </Card>
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
          When Safe Work activities are complete, record the date, time, and
          initials of the operator and maintenance personnel involved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form method="post" className="grid gap-4" {...getFormProps(form)}>
          <input type="hidden" name="intent" value="closeout" />
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
  siteVerifiedAt,
  pending,
}: {
  title: string;
  name: string;
  signature: string;
  siteVerifiedAt?: string;
  pending?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        {pending ? (
          <Badge variant="outline" className="border-sky-600/40 text-sky-800">
            Awaiting
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {pending ? "Not signed yet" : name || "—"}
      </p>
      {!pending && siteVerifiedAt ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Site inspected{" "}
          {formatMelbourneDateTime(siteVerifiedAt) ?? siteVerifiedAt}
        </p>
      ) : null}
      {!pending && signature ? (
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
