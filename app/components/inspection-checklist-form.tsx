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
import {
  YES_NO_OPTIONS,
  groupQuestionsBySection,
  type InspectionDefinition,
  type InspectionSummary,
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
  const sections = groupQuestionsBySection(definition.questions);

  const defaultResponses = Object.fromEntries(
    definition.questions.map((question) => [question.id, ""]),
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
            Answer each question, then submit to record this inspection.
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
                {definition.equipmentChoices?.length ? (
                  <select
                    {...getSelectProps(fields.equipmentRef)}
                    key={fields.equipmentRef.key}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
                    required
                  >
                    <option value="">Select unit…</option>
                    {definition.equipmentChoices.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    {...getInputProps(fields.equipmentRef, { type: "text" })}
                    key={fields.equipmentRef.key}
                    placeholder="e.g. FL-01"
                    autoComplete="off"
                  />
                )}
                {fields.equipmentRef.errors ? (
                  <p className="text-sm text-destructive">
                    {fields.equipmentRef.errors.join(" ")}
                  </p>
                ) : null}
              </section>
            ) : null}

            {definition.instructionNotes ? (
              <section
                className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
              >
                {definition.instructionNotes}
              </section>
            ) : null}

            {definition.questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This inspection has no questions yet. Ask a manager to add some.
              </p>
            ) : null}

            {sections.map((section, sectionIndex) => (
              <section
                key={section.title ?? `section-${sectionIndex}`}
                className="grid gap-4"
              >
                {section.title ? (
                  <h3 className="font-heading text-lg font-semibold text-brand-navy">
                    {section.title}
                  </h3>
                ) : null}
                <ul className="grid gap-4">
                  {section.questions.map((question) => {
                    const field = responseFields[question.id];
                    if (!field) {
                      return null;
                    }

                    const choices =
                      question.type === "YES_NO"
                        ? [...YES_NO_OPTIONS]
                        : question.type === "RADIO"
                          ? question.options
                          : [];

                    return (
                      <li
                        key={question.id}
                        className="rounded-lg border border-border/70 bg-background/40 p-4"
                      >
                        <p className="text-sm font-medium text-brand-navy">
                          {question.label}
                          {question.required ? null : (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Optional
                            </span>
                          )}
                        </p>
                        {question.helpText ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {question.helpText}
                          </p>
                        ) : null}

                        {question.type === "TEXT" ? (
                          <div className="mt-3">
                            <textarea
                              id={field.id}
                              name={field.name}
                              key={field.key}
                              defaultValue={
                                typeof field.initialValue === "string"
                                  ? field.initialValue
                                  : ""
                              }
                              rows={3}
                              className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
                              placeholder="Enter details…"
                              aria-invalid={Boolean(field.errors)}
                            />
                          </div>
                        ) : question.type === "NUMBER" ? (
                          <div className="mt-3">
                            <Input
                              {...getInputProps(field, { type: "number" })}
                              key={field.key}
                              inputMode="decimal"
                              step="any"
                              placeholder="e.g. 4025.3"
                              className="max-w-xs"
                            />
                          </div>
                        ) : question.type === "DATE" ? (
                          <div className="mt-3">
                            <Input
                              {...getInputProps(field, { type: "date" })}
                              key={field.key}
                              className="max-w-xs"
                            />
                          </div>
                        ) : (
                          <fieldset className="mt-3">
                            <legend className="sr-only">{question.label}</legend>
                            <div className="flex flex-wrap gap-2">
                              {choices.map((option) => {
                                const optionId = `${field.id}-${option}`;
                                const flagsAttention =
                                  question.attentionValues.includes(option);
                                return (
                                  <label
                                    key={option}
                                    htmlFor={optionId}
                                    className={cn(
                                      "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors has-[:checked]:border-brand/50 has-[:checked]:bg-brand/10",
                                      flagsAttention &&
                                        "has-[:checked]:border-amber-500/50 has-[:checked]:bg-amber-50",
                                    )}
                                  >
                                    <input
                                      {...getInputProps(field, {
                                        type: "radio",
                                        value: option,
                                      })}
                                      id={optionId}
                                      key={`${field.key}-${option}`}
                                      className="size-4 accent-[var(--brand-navy)]"
                                    />
                                    {option}
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        )}

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
              <p className="text-sm text-destructive">{form.errors.join(" ")}</p>
            ) : null}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              disabled={isSubmitting || definition.questions.length === 0}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "Saving…" : "Submit inspection"}
            </Button>
          </CardFooter>
        </Form>
      </Card>

      <Card className="h-fit lg:sticky lg:top-24">
        <CardHeader>
          <CardTitle>Result</CardTitle>
          <CardDescription>
            After submit, answers are stored with a pass or needs-attention
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
              <dl className="grid gap-3 sm:grid-cols-2">
                <Stat
                  label="Answered"
                  value={String(summary.answeredCount)}
                />
                <Stat
                  label="Attention"
                  value={String(summary.attentionCount)}
                  emphasize={summary.attentionCount > 0}
                />
              </dl>
              {summary.attentionItems.length > 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-50/80 p-3">
                  <p className="text-sm font-medium text-amber-900">
                    Items needing attention
                  </p>
                  <ul className="mt-2 grid gap-1 text-sm text-amber-950/90">
                    {summary.attentionItems.map((item) => (
                      <li key={item.itemId}>
                        • {item.label}
                        {item.answer ? ` (${item.answer})` : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete the questions, then submit. Managers are notified when
              anything needs attention.
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
