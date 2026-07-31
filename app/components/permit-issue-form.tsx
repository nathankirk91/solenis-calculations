import {
  getFormProps,
  useForm,
  type SubmissionResult,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
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
      authorizedPersonnel: [""],
      authorization: {
        operationsRep: { name: "", signature: "" },
        maintenanceRep: { name: "", signature: "" },
        safeWorkCoordinator: { name: "", signature: "" },
      },
      responses: defaultResponses,
    },
  });

  const responseFields = fields.responses.getFieldset();
  const personnelFields = fields.authorizedPersonnel.getFieldList();
  const authorizationFields = fields.authorization.getFieldset();
  const opsFields = authorizationFields.operationsRep.getFieldset();
  const maintFields = authorizationFields.maintenanceRep.getFieldset();
  const coordinatorFields =
    authorizationFields.safeWorkCoordinator.getFieldset();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>Issue permit</CardTitle>
          <CardDescription>
            Complete the checks and authorisation to open this permit. Close-out
            happens later from the open permits list.
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
                    People authorised to perform the work.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  {...form.insert.getButtonProps({
                    name: fields.authorizedPersonnel.name,
                    defaultValue: "",
                  })}
                >
                  Add person
                </Button>
              </div>
              <div className="grid gap-3">
                {personnelFields.map((field, index) => (
                  <div key={field.key} className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={field.id}>
                        {index === 0
                          ? "Authorized person"
                          : `Authorized person ${index + 1}`}
                      </Label>
                      {personnelFields.length > 1 ? (
                        <button
                          type="button"
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
                      id={field.id}
                      name={field.name}
                      key={field.key}
                      defaultValue={
                        typeof field.initialValue === "string"
                          ? field.initialValue
                          : ""
                      }
                      placeholder="Full name"
                      aria-invalid={Boolean(field.errors)}
                    />
                    {field.errors ? (
                      <p className="text-sm text-destructive">
                        {field.errors.join(" ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-4">
              <div>
                <h3 className="font-heading text-lg font-semibold text-brand-navy">
                  Authorization to conduct work
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter each representative’s name and initials.
                </p>
              </div>
              <AuthorizationPersonFields
                title="Operations rep"
                nameField={opsFields.name}
                signatureField={opsFields.signature}
              />
              <AuthorizationPersonFields
                title="Maintenance rep"
                nameField={maintFields.name}
                signatureField={maintFields.signature}
              />
              <AuthorizationPersonFields
                title="Safe work coordinator"
                nameField={coordinatorFields.name}
                signatureField={coordinatorFields.signature}
              />
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
              {isSubmitting ? "Opening…" : "Open permit"}
            </Button>
          </CardFooter>
        </Form>
      </Card>

      <Card className="h-fit lg:sticky lg:top-24">
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>
            After submit, the permit stays open until close-out.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {summary && status ? (
            <>
              <Badge
                variant="outline"
                className={cn(
                  status === "PASSED" &&
                    "border-emerald-600/40 text-emerald-700",
                  status === "NEEDS_ATTENTION" &&
                    "border-amber-600/40 text-amber-800",
                )}
              >
                {status === "PASSED" ? "Opened" : "Opened · needs attention"}
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
              Complete the form and authorisation to open the permit.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AuthorizationPersonFields({
  title,
  nameField,
  signatureField,
}: {
  title: string;
  nameField: {
    id: string;
    name: string;
    key?: string;
    initialValue?: string | string[] | undefined | null;
    errors?: string[];
  };
  signatureField: {
    id: string;
    name: string;
    errors?: string[];
  };
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border/70 bg-background/40 p-4">
      <p className="text-sm font-medium text-brand-navy">{title}</p>
      <div className="grid gap-2">
        <Label htmlFor={nameField.id}>Name</Label>
        <Input
          id={nameField.id}
          name={nameField.name}
          key={nameField.key ?? nameField.id}
          defaultValue={
            typeof nameField.initialValue === "string"
              ? nameField.initialValue
              : ""
          }
          placeholder="Full name"
          aria-invalid={Boolean(nameField.errors)}
        />
        {nameField.errors ? (
          <p className="text-sm text-destructive">
            {nameField.errors.join(" ")}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label>Initials</Label>
        <SignaturePad
          name={signatureField.name}
          id={signatureField.id}
          required
          error={signatureField.errors?.join(" ")}
        />
      </div>
    </div>
  );
}
