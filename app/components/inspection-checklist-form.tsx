import {
  getFormProps,
  getInputProps,
  getSelectProps,
  useForm,
  type SubmissionResult,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { Form, useNavigation } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { createInspectionSchema } from "~/lib/inspection.schema";
import type {
  InspectionDefinition,
  InspectionItemResult,
  InspectionSummary,
} from "~/lib/inspections";
import type { OperatorOption } from "~/lib/operators.server";
import { cn } from "~/lib/utils";

type Props = {
  definition: InspectionDefinition;
  operators: OperatorOption[];
  lastResult?: SubmissionResult<string[]> | null;
  summary?: InspectionSummary | null;
  status?: InspectionSummary["status"] | null;
  formError?: string | null;
};

const RESULT_OPTIONS: Array<{
  value: InspectionItemResult;
  label: string;
}> = [
  { value: "ok", label: "OK" },
  { value: "attention", label: "Needs attention" },
  { value: "na", label: "N/A" },
];

export function InspectionChecklistForm({
  definition,
  operators,
  lastResult,
  summary,
  status,
  formError,
}: Props) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const schema = createInspectionSchema(definition);

  const defaultResponses = Object.fromEntries(
    definition.sections.flatMap((section) =>
      section.items.map((item) => [item.id, ""]),
    ),
  );

  const [form, fields] = useForm({
    lastResult: lastResult ?? undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    defaultValue: {
      operatorId: "",
      equipmentRef: "",
      notes: "",
      responses: defaultResponses,
    },
  });

  const responseFields = fields.responses.getFieldset();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Checklist</CardTitle>
          <CardDescription>
            Mark every item, then submit to record this inspection.
          </CardDescription>
        </CardHeader>
        <Form method="post" {...getFormProps(form)}>
          <CardContent className="grid gap-8 pb-6">
            <section className="grid gap-2">
              <Label htmlFor={fields.operatorId.id}>
                Operator / who is doing this inspection
              </Label>
              <select
                {...getSelectProps(fields.operatorId)}
                key={fields.operatorId.key}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
                required
              >
                <option value="">Select operator…</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name}
                  </option>
                ))}
              </select>
              {fields.operatorId.errors ? (
                <p className="text-sm text-destructive">
                  {fields.operatorId.errors.join(" ")}
                </p>
              ) : null}
            </section>

            {definition.equipmentLabel ? (
              <section className="grid gap-2">
                <Label htmlFor={fields.equipmentRef.id}>
                  {definition.equipmentLabel}
                </Label>
                <Input
                  {...getInputProps(fields.equipmentRef, { type: "text" })}
                  key={fields.equipmentRef.key}
                  placeholder="e.g. FL-01"
                  autoComplete="off"
                />
                {fields.equipmentRef.errors ? (
                  <p className="text-sm text-destructive">
                    {fields.equipmentRef.errors.join(" ")}
                  </p>
                ) : null}
              </section>
            ) : null}

            {definition.sections.map((section) => (
              <section key={section.id} className="grid gap-4">
                <h3 className="font-heading text-lg font-semibold text-brand-navy">
                  {section.title}
                </h3>
                <ul className="grid gap-4">
                  {section.items.map((item) => {
                    const field = responseFields[item.id];
                    if (!field) {
                      return null;
                    }

                    return (
                      <li
                        key={item.id}
                        className="rounded-lg border border-border/70 bg-background/40 p-4"
                      >
                        <p className="text-sm font-medium text-brand-navy">
                          {item.label}
                        </p>
                        {item.help ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.help}
                          </p>
                        ) : null}
                        <fieldset className="mt-3">
                          <legend className="sr-only">{item.label}</legend>
                          <div className="flex flex-wrap gap-2">
                            {RESULT_OPTIONS.map((option) => {
                              const optionId = `${field.id}-${option.value}`;
                              return (
                                <label
                                  key={option.value}
                                  htmlFor={optionId}
                                  className={cn(
                                    "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors has-[:checked]:border-brand/50 has-[:checked]:bg-brand/10",
                                    option.value === "attention" &&
                                      "has-[:checked]:border-amber-500/50 has-[:checked]:bg-amber-50",
                                  )}
                                >
                                  <input
                                    {...getInputProps(field, {
                                      type: "radio",
                                      value: option.value,
                                    })}
                                    id={optionId}
                                    key={`${field.key}-${option.value}`}
                                    className="size-4 accent-[var(--brand-navy)]"
                                  />
                                  {option.label}
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>
                        {field.errors ? (
                          <p className="mt-2 text-sm text-destructive">
                            {field.errors.join(" ")}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            <section className="grid gap-2">
              <Label htmlFor={fields.notes.id}>Notes (optional)</Label>
              <textarea
                id={fields.notes.id}
                name={fields.notes.name}
                key={fields.notes.key}
                defaultValue={
                  typeof fields.notes.initialValue === "string"
                    ? fields.notes.initialValue
                    : ""
                }
                rows={3}
                className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
                placeholder="Defects, follow-up, or other comments…"
                aria-invalid={Boolean(fields.notes.errors)}
              />
              {fields.notes.errors ? (
                <p className="text-sm text-destructive">
                  {fields.notes.errors.join(" ")}
                </p>
              ) : null}
            </section>

            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
            {form.errors ? (
              <p className="text-sm text-destructive">
                {form.errors.join(" ")}
              </p>
            ) : null}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? "Saving…" : "Submit inspection"}
            </Button>
          </CardFooter>
        </Form>
      </Card>

      <Card className="h-fit lg:sticky lg:top-24">
        <CardHeader>
          <CardTitle>Result</CardTitle>
          <CardDescription>
            After submit, the checklist is stored with a pass or needs-attention
            outcome.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {summary && status ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    status === "PASSED" &&
                      "border-emerald-600/40 text-emerald-700",
                    status === "NEEDS_ATTENTION" &&
                      "border-amber-600/40 text-amber-800",
                  )}
                >
                  {status === "PASSED" ? "Passed" : "Needs attention"}
                </Badge>
              </div>
              <dl className="grid gap-3 sm:grid-cols-3">
                <Stat label="OK" value={String(summary.okCount)} />
                <Stat
                  label="Attention"
                  value={String(summary.attentionCount)}
                  emphasize={summary.attentionCount > 0}
                />
                <Stat label="N/A" value={String(summary.naCount)} />
              </dl>
              {summary.attentionItems.length > 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-50/80 p-3">
                  <p className="text-sm font-medium text-amber-900">
                    Items needing attention
                  </p>
                  <ul className="mt-2 grid gap-1 text-sm text-amber-950/90">
                    {summary.attentionItems.map((item) => (
                      <li key={item.itemId}>• {item.label}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete every checklist item, then submit. Managers are notified
              when anything needs attention.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={
          emphasize
            ? "font-heading text-2xl font-semibold tabular-nums text-amber-800"
            : "font-heading text-lg font-semibold tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}
