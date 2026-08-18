import {
  getFormProps,
  useForm,
  type SubmissionResult,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { useRef } from "react";
import { Form, useNavigation } from "react-router";

import { SignaturePad } from "~/components/signature-pad";
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
import { listPermitFormIssues } from "~/lib/permit-form-errors";
import { createPermitIssueFormSchema } from "~/lib/permit.schema";
import {
  YES_NO_OPTIONS,
  groupQuestionsBySection,
  parseCheckboxAnswer,
  serializeCheckboxAnswer,
  type InspectionDefinition,
  type InspectionSummary,
} from "~/lib/inspections";
import { cn } from "~/lib/utils";

type Props = {
  definition: InspectionDefinition;
  lastResult?: SubmissionResult<string[]> | null;
  summary?: InspectionSummary | null;
  status?: InspectionSummary["status"] | null;
  formError?: string | null;
};

export function PermitIssueForm({
  definition,
  lastResult,
  summary,
  status,
  formError,
}: Props) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const schema = createPermitIssueFormSchema(definition);
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
      equipmentRef: "",
      authorizedPersonnel: [{ name: "", signature: "" }],
      responses: defaultResponses,
    },
  });

  const responseFields = fields.responses.getFieldset();
  const personnelFields = fields.authorizedPersonnel.getFieldList();
  const issueItems = listPermitFormIssues({
    definition,
    formError,
    formErrors: form.errors,
    allErrors: form.allErrors,
  });
  const issueKey = issueItems
    .map((issue) => `${issue.path}:${issue.messages.join("|")}`)
    .join(";");
  const scrolledIssueKeyRef = useRef("");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>Issue permit</CardTitle>
          <CardDescription>
            Complete the checks and authorized personnel (technicians,
            contractors, or visitors). Duration is calculated from start and end
            time (max 12 hours). The permit opens after{" "}
            {definition.requiredSignerCount === 3
              ? "all three authorisation signatures"
              : "two different people sign off"}
            .
          </CardDescription>
        </CardHeader>
        <Form method="post" {...getFormProps(form)}>
          <CardContent className="grid gap-8">
            {definition.instructionNotes ? (
              <section className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                {definition.instructionNotes}
              </section>
            ) : null}

            {definition.equipmentLabel ? (
              <section className="grid gap-2">
                <Label htmlFor={fields.equipmentRef.id}>
                  {definition.equipmentLabel}
                </Label>
                <Input
                  id={fields.equipmentRef.id}
                  name={fields.equipmentRef.name}
                  key={fields.equipmentRef.key}
                  defaultValue={
                    typeof fields.equipmentRef.initialValue === "string"
                      ? fields.equipmentRef.initialValue
                      : ""
                  }
                  placeholder="e.g. P-120"
                  aria-invalid={Boolean(fields.equipmentRef.errors)}
                />
                {fields.equipmentRef.errors ? (
                  <p className="text-sm text-destructive">
                    {fields.equipmentRef.errors.join(" ")}
                  </p>
                ) : null}
              </section>
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
                    const fieldName =
                      field?.name ?? `responses[${question.id}]`;
                    const fieldId = field?.id ?? question.id;
                    const fieldKey = field?.key ?? question.id;
                    const fieldErrors = field?.errors;
                    const choices =
                      question.type === "YES_NO"
                        ? [...YES_NO_OPTIONS]
                        : question.type === "RADIO" ||
                            question.type === "CHECKBOX"
                          ? question.options
                          : [];
                    const value =
                      typeof field?.value === "string"
                        ? field.value
                        : typeof field?.initialValue === "string"
                          ? field.initialValue
                          : "";
                    const checkboxSelected =
                      question.type === "CHECKBOX"
                        ? new Set(parseCheckboxAnswer(value))
                        : null;

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
                              id={fieldId}
                              name={fieldName}
                              key={fieldKey}
                              defaultValue={value}
                              rows={3}
                              className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                              placeholder="Enter details…"
                              aria-invalid={Boolean(fieldErrors)}
                            />
                          </div>
                        ) : question.type === "NUMBER" ? (
                          <div className="mt-3">
                            <Input
                              id={fieldId}
                              name={fieldName}
                              key={fieldKey}
                              type="number"
                              defaultValue={value}
                              inputMode="decimal"
                              step="any"
                              className="max-w-xs"
                              aria-invalid={Boolean(fieldErrors)}
                            />
                          </div>
                        ) : question.type === "DATE" ? (
                          <div className="mt-3">
                            <Input
                              id={fieldId}
                              name={fieldName}
                              key={fieldKey}
                              type="date"
                              defaultValue={value}
                              className="max-w-xs"
                              aria-invalid={Boolean(fieldErrors)}
                            />
                          </div>
                        ) : question.type === "TIME" ? (
                          <div className="mt-3">
                            <Input
                              id={fieldId}
                              name={fieldName}
                              key={fieldKey}
                              type="time"
                              defaultValue={value}
                              className="max-w-xs"
                              aria-invalid={Boolean(fieldErrors)}
                            />
                          </div>
                        ) : question.type === "CHECKBOX" ? (
                          <fieldset className="mt-3">
                            <legend className="sr-only">{question.label}</legend>
                            <input type="hidden" name={fieldName} value={value} />
                            <div className="flex flex-wrap gap-2">
                              {choices.map((option) => {
                                const optionId = `${fieldId}-${option}`;
                                const checked =
                                  checkboxSelected?.has(option) ?? false;
                                return (
                                  <label
                                    key={option}
                                    htmlFor={optionId}
                                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors has-[:checked]:border-brand/50 has-[:checked]:bg-brand/10"
                                  >
                                    <input
                                      type="checkbox"
                                      id={optionId}
                                      checked={checked}
                                      onChange={(event) => {
                                        const next = new Set(
                                          checkboxSelected ?? [],
                                        );
                                        if (event.target.checked) {
                                          next.add(option);
                                        } else {
                                          next.delete(option);
                                        }
                                        form.update({
                                          name: fieldName,
                                          value: serializeCheckboxAnswer([
                                            ...next,
                                          ]),
                                          validated: false,
                                        });
                                      }}
                                      className="size-4 accent-[var(--brand-navy)]"
                                    />
                                    {option}
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        ) : (
                          <fieldset className="mt-3">
                            <legend className="sr-only">{question.label}</legend>
                            <div className="flex flex-wrap gap-2">
                              {choices.map((option) => {
                                const optionId = `${fieldId}-${option}`;
                                return (
                                  <label
                                    key={option}
                                    htmlFor={optionId}
                                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors has-[:checked]:border-brand/50 has-[:checked]:bg-brand/10"
                                  >
                                    <input
                                      type="radio"
                                      id={optionId}
                                      name={fieldName}
                                      value={option}
                                      checked={value === option}
                                      onChange={() => {
                                        form.update({
                                          name: fieldName,
                                          value: option,
                                          validated: false,
                                        });
                                      }}
                                      className="size-4 accent-[var(--brand-navy)]"
                                    />
                                    {option}
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        )}

                        {fieldErrors ? (
                          <p className="mt-2 text-sm text-destructive">
                            {fieldErrors.join(" ")}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            <section className="grid gap-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="font-heading text-lg font-semibold text-brand-navy">
                    Authorized personnel
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Technicians, contractors, and visitors authorised to perform
                    the work. The first person must sign; additional signatures
                    are optional.
                  </p>
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  {...form.insert.getButtonProps({
                    name: fields.authorizedPersonnel.name,
                    defaultValue: { name: "", signature: "" },
                  })}
                >
                  Add person
                </Button>
              </div>
              <div className="grid gap-4">
                {personnelFields.map((field, index) => {
                  const person = field.getFieldset();
                  return (
                    <div
                      key={field.key}
                      className="grid gap-3 rounded-lg border border-border/70 bg-background/40 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor={person.name.id}>
                          {index === 0
                            ? "Authorized person"
                            : `Authorized person ${index + 1}`}
                          {index === 0 ? (
                            <span className="ml-1 text-destructive">*</span>
                          ) : null}
                        </Label>
                        {personnelFields.length > 1 ? (
                          <button
                            type="submit"
                            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
                            {...form.remove.getButtonProps({
                              name: fields.authorizedPersonnel.name,
                              index,
                            })}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <Input
                        id={person.name.id}
                        name={person.name.name}
                        key={person.name.key}
                        defaultValue={
                          typeof person.name.initialValue === "string"
                            ? person.name.initialValue
                            : ""
                        }
                        placeholder="Full name"
                        aria-invalid={Boolean(person.name.errors)}
                      />
                      {person.name.errors ? (
                        <p className="text-sm text-destructive">
                          {person.name.errors.join(" ")}
                        </p>
                      ) : null}
                      <div className="grid gap-2">
                        <Label>
                          Sign-off
                          {index === 0 ? (
                            <span className="ml-1 text-destructive">*</span>
                          ) : (
                            <span className="ml-1 font-normal text-muted-foreground">
                              (optional)
                            </span>
                          )}
                        </Label>
                        <SignaturePad
                          name={person.signature.name}
                          id={person.signature.id}
                          required={index === 0}
                          error={person.signature.errors?.join(" ")}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {issueItems.length > 0 ? (
              <div
                ref={(node) => {
                  if (!node || !issueKey || scrolledIssueKeyRef.current === issueKey) {
                    return;
                  }
                  scrolledIssueKeyRef.current = issueKey;
                  node.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
                role="alert"
              >
                <p className="text-sm font-medium text-destructive">
                  {formError
                    ? "Permit was not saved"
                    : "Permit could not be submitted"}
                </p>
                <ul className="mt-2 grid gap-1 text-sm text-destructive">
                  {issueItems.map((issue) => (
                    <li key={`${issue.path}:${issue.messages.join("|")}`}>
                      {issue.path ? (
                        <>
                          <span className="font-medium">{issue.label}:</span>{" "}
                        </>
                      ) : null}
                      {issue.messages.join(" ")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              disabled={isSubmitting || definition.questions.length === 0}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "Submitting…" : "Submit for authorization"}
            </Button>
          </CardFooter>
        </Form>
      </Card>

      <Card className="h-fit lg:sticky lg:top-24">
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>
            After submit, the permit is pending until{" "}
            {definition.requiredSignerCount === 3
              ? "all three authorisation slots are signed"
              : "two different people sign off"}
            .
            {definition.requiredSignerCount === 3
              ? ""
              : " A third role can still sign after it opens."}{" "}
            Approvers must visually inspect the job site first.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {formError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">Not saved</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This is a save problem, not a safety rejection. The checklist
                was accepted, but the permit was not stored.
              </p>
            </div>
          ) : summary && status ? (
            <>
              <Badge
                variant="outline"
                className={cn(
                  status === "PASSED" &&
                    "border-sky-600/40 text-sky-800",
                  status === "NEEDS_ATTENTION" &&
                    "border-amber-600/40 text-amber-800",
                )}
              >
                {status === "PASSED"
                  ? "Pending authorization"
                  : "Pending · needs attention"}
              </Badge>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                    Answered
                  </dt>
                  <dd className="font-heading text-lg font-semibold tabular-nums">
                    {summary.answeredCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs tracking-wide text-muted-foreground uppercase">
                    Attention
                  </dt>
                  <dd
                    className={cn(
                      "font-heading text-lg font-semibold tabular-nums",
                      summary.attentionCount > 0 && "text-amber-800",
                    )}
                  >
                    {summary.attentionCount}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete the form to submit for authorization.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
