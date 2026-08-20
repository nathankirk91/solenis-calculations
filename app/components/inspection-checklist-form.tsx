import {
  getFormProps,
  getInputProps,
  getSelectProps,
  useForm,
  type SubmissionResult,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { Form, useNavigation, useSearchParams } from "react-router";

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
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Textarea } from "~/components/ui/textarea";
import { SignaturePad } from "~/components/signature-pad";
import { createInspectionFormSchema } from "~/lib/inspection.schema";
import {
  YES_NO_OPTIONS,
  filterQuestionsForContext,
  findShiftQuestion,
  formatLastAnswerDisplay,
  groupQuestionsBySection,
  isPermitInspection,
  parseCheckboxAnswer,
  serializeCheckboxAnswer,
  type InspectionDefinition,
  type InspectionQuestionType,
  type InspectionSummary,
} from "~/lib/inspections";
import type { InspectionActionItem } from "~/lib/inspections.server";
import type { OperatorOption } from "~/lib/operators.server";
import { formatMelbourneDateTime } from "~/lib/datetime";
import { cn } from "~/lib/utils";

type Props = {
  definition: InspectionDefinition;
  operators: OperatorOption[];
  /** Shift from the route loader (URL ?shift=). */
  selectedShift: string | null;
  /** Equipment from the route loader (fixed unit or ?equipmentRef=). */
  equipmentRef: string | null;
  isFirstInspectionOfWeek: boolean;
  lastAnswers: Record<string, string>;
  lastRunAt: string | null;
  openActions: InspectionActionItem[];
  lastResult?: SubmissionResult<string[]> | null;
  summary?: InspectionSummary | null;
  status?: InspectionSummary["status"] | null;
  formError?: string | null;
};

export function InspectionChecklistForm({
  definition,
  operators,
  selectedShift,
  equipmentRef,
  isFirstInspectionOfWeek,
  lastAnswers,
  lastRunAt,
  openActions,
  lastResult,
  summary,
  status,
  formError,
}: Props) {
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSubmitting = navigation.state !== "idle";
  const isRevalidating =
    navigation.state === "loading" &&
    navigation.formMethod == null &&
    Boolean(navigation.location);

  const shiftQuestion = findShiftQuestion(definition.questions);
  const fixedEquipmentRef = definition.fixedEquipmentRef?.trim() || "";
  const needsEquipmentPick =
    Boolean(definition.equipmentLabel) && !fixedEquipmentRef;
  const canLoadScopedData = !needsEquipmentPick || Boolean(equipmentRef?.trim());
  const needsLastAnswers = definition.questions.some(
    (question) => question.showLastValue,
  );

  // Pending URL while the loader revalidates — radio UI only, not filtering.
  const pendingShift = isRevalidating
    ? new URLSearchParams(navigation.location?.search ?? "").get("shift")
    : null;
  const displayShift = pendingShift ?? selectedShift ?? "";

  // Filtering uses loader data only (shift + week status from the same request).
  const schema = createInspectionFormSchema(definition, {
    isFirstInspectionOfWeek,
  });
  const visibleQuestions = filterQuestionsForContext(definition.questions, {
    shift: selectedShift,
    isFirstInspectionOfWeek,
  });
  const sections = groupQuestionsBySection(visibleQuestions);

  const defaultResponses = Object.fromEntries(
    definition.questions.map((question) => [
      question.id,
      question.id === shiftQuestion?.id && selectedShift ? selectedShift : "",
    ]),
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
      equipmentRef: fixedEquipmentRef || equipmentRef || "",
      notes: "",
      signature: "",
      actions: [""],
      responses: defaultResponses,
    },
  });

  const responseFields = fields.responses.getFieldset();
  const actionFields = fields.actions.getFieldList();
  const isPermit = isPermitInspection(definition);
  const formNoun = isPermit ? "permit" : "inspection";

  function updateSearchParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) {
      next.set(key, value.trim());
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }

  function useLastValue(questionId: string, fieldName: string) {
    const lastValue = lastAnswers[questionId];
    if (!lastValue) {
      return;
    }
    form.update({
      name: fieldName,
      value: lastValue,
      validated: false,
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{isPermit ? "Permit form" : "Checklist"}</CardTitle>
          <CardDescription>
            Answer each question, then sign and submit to record this
            inspection.
          </CardDescription>
        </CardHeader>
        <Form method="post" {...getFormProps(form)}>
          <CardContent className="grid gap-8 pb-6">
            {fixedEquipmentRef ? (
              <section className="grid gap-2">
                <input
                  type="hidden"
                  name={fields.equipmentRef.name}
                  value={fixedEquipmentRef}
                  readOnly
                />
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-brand-navy">
                    {definition.equipmentLabel ?? "Unit"}:
                  </span>{" "}
                  {fixedEquipmentRef}
                </p>
                {needsLastAnswers ? (
                  <p className="text-xs text-muted-foreground">
                    {lastRunAt
                      ? `Previous report: ${formatMelbourneDateTime(lastRunAt)}`
                      : "No previous report for this unit yet."}
                  </p>
                ) : null}
              </section>
            ) : definition.equipmentLabel ? (
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
                    defaultValue={equipmentRef ?? ""}
                    onChange={(event) =>
                      updateSearchParam("equipmentRef", event.target.value)
                    }
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
                    defaultValue={equipmentRef ?? ""}
                    onBlur={(event) =>
                      updateSearchParam("equipmentRef", event.target.value)
                    }
                  />
                )}
                {fields.equipmentRef.errors ? (
                  <p className="text-sm text-destructive">
                    {fields.equipmentRef.errors.join(" ")}
                  </p>
                ) : null}
                {needsLastAnswers ? (
                  <p className="text-xs text-muted-foreground">
                    {canLoadScopedData
                      ? lastRunAt
                        ? `Previous report: ${formatMelbourneDateTime(lastRunAt)}`
                        : "No previous report for this unit yet."
                      : "Select a unit to load previous answers."}
                  </p>
                ) : null}
              </section>
            ) : null}

            {definition.instructionNotes ? (
              <section className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                {definition.instructionNotes}
              </section>
            ) : null}

            {definition.questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This inspection has no questions yet. Ask a manager to add some.
              </p>
            ) : null}

            {isRevalidating && shiftQuestion ? (
              <p className="text-xs text-muted-foreground">
                Updating checklist for {displayShift || "selected"} shift…
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
                    const fieldName =
                      field?.name ?? `responses[${question.id}]`;
                    const fieldId = field?.id ?? question.id;
                    const fieldKey = field?.key ?? question.id;
                    const fieldErrors = field?.errors;
                    const isShiftField =
                      Boolean(shiftQuestion) &&
                      question.id === shiftQuestion?.id;

                    const choices =
                      question.type === "YES_NO"
                        ? [...YES_NO_OPTIONS]
                        : question.type === "RADIO" ||
                            question.type === "CHECKBOX"
                          ? question.options
                          : [];
                    const value = isShiftField
                      ? displayShift
                      : typeof field?.value === "string"
                        ? field.value
                        : typeof field?.initialValue === "string"
                          ? field.initialValue
                          : "";
                    const checkboxSelected =
                      question.type === "CHECKBOX"
                        ? new Set(parseCheckboxAnswer(value))
                        : null;
                    const lastValue = lastAnswers[question.id] ?? "";
                    const showConfiguredLastValue =
                      question.showLastValue &&
                      canLoadScopedData &&
                      Boolean(lastValue);

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

                        {showConfiguredLastValue ? (
                          <LastValueHint
                            questionId={question.id}
                            questionType={question.type}
                            lastValue={lastValue}
                            currentValue={value}
                            onUse={() => useLastValue(question.id, fieldName)}
                          />
                        ) : null}

                        {question.type === "TEXT" ? (
                          <div className="mt-3">
                            <Textarea
                              id={fieldId}
                              name={fieldName}
                              key={fieldKey}
                              defaultValue={value}
                              rows={3}
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
                              placeholder="e.g. 4025.3"
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
                                const flagsAttention =
                                  question.attentionValues.includes(option);
                                return (
                                  <label
                                    key={option}
                                    htmlFor={optionId}
                                    className={cn(
                                      "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors has-[[data-state=checked]]:border-brand/50 has-[[data-state=checked]]:bg-brand/10",
                                      flagsAttention &&
                                        "has-[[data-state=checked]]:border-amber-500/50 has-[[data-state=checked]]:bg-amber-50",
                                    )}
                                  >
                                    <Checkbox
                                      id={optionId}
                                      checked={checked}
                                      onCheckedChange={(nextChecked) => {
                                        const next = new Set(
                                          checkboxSelected ?? [],
                                        );
                                        if (nextChecked === true) {
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
                            <input type="hidden" name={fieldName} value={value} />
                            <RadioGroup
                              value={value || undefined}
                              onValueChange={(option) => {
                                if (isShiftField) {
                                  updateSearchParam("shift", option);
                                } else {
                                  form.update({
                                    name: fieldName,
                                    value: option,
                                    validated: false,
                                  });
                                }
                              }}
                              className="flex flex-wrap gap-2"
                              aria-invalid={Boolean(fieldErrors)}
                            >
                              {choices.map((option) => {
                                const optionId = `${fieldId}-${option}`;
                                const flagsAttention =
                                  question.attentionValues.includes(option);
                                return (
                                  <label
                                    key={option}
                                    htmlFor={optionId}
                                    className={cn(
                                      "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors has-[[data-state=checked]]:border-brand/50 has-[[data-state=checked]]:bg-brand/10",
                                      flagsAttention &&
                                        "has-[[data-state=checked]]:border-amber-500/50 has-[[data-state=checked]]:bg-amber-50",
                                    )}
                                  >
                                    <RadioGroupItem
                                      id={optionId}
                                      value={option}
                                    />
                                    {option}
                                  </label>
                                );
                              })}
                            </RadioGroup>
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
                  <h3 className="text-sm font-medium">Actions</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Record follow-up work for managers. Open actions stay
                    visible on future inspections until closed.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  {...form.insert.getButtonProps({
                    name: fields.actions.name,
                    defaultValue: "",
                  })}
                >
                  Add action
                </Button>
              </div>

              {canLoadScopedData ? (
                openActions.length > 0 ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-50/70 p-3">
                    <p className="text-sm font-medium text-amber-950">
                      Still open
                    </p>
                    <ul className="mt-2 grid gap-2">
                      {openActions.map((action) => (
                        <li
                          key={action.id}
                          className="text-sm text-amber-950/90"
                        >
                          <span className="whitespace-pre-wrap">
                            {action.description}
                          </span>
                          <span className="mt-0.5 block text-xs text-amber-900/70">
                            Open since{" "}
                            {formatMelbourneDateTime(action.createdAt)}
                            {action.createdByOperatorName
                              ? ` · ${action.createdByOperatorName}`
                              : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null
              ) : (
                <p className="text-xs text-muted-foreground">
                  Select a unit to see any open actions.
                </p>
              )}

              <div className="grid gap-3">
                {actionFields.map((field, index) => (
                  <div key={field.key} className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={field.id}>Action {index + 1}</Label>
                      {actionFields.length > 1 ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
                          {...form.remove.getButtonProps({
                            name: fields.actions.name,
                            index,
                          })}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <Textarea
                      id={field.id}
                      name={field.name}
                      key={field.key}
                      defaultValue={
                        typeof field.initialValue === "string"
                          ? field.initialValue
                          : ""
                      }
                      rows={2}
                      placeholder="Describe the action that needs completing…"
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-2">
              <Label htmlFor={fields.notes.id}>Notes (optional)</Label>
              <Textarea
                id={fields.notes.id}
                name={fields.notes.name}
                key={fields.notes.key}
                defaultValue={
                  typeof fields.notes.initialValue === "string"
                    ? fields.notes.initialValue
                    : ""
                }
                rows={3}
                placeholder="Defects, follow-up, or other comments…"
                aria-invalid={Boolean(fields.notes.errors)}
              />
              {fields.notes.errors ? (
                <p className="text-sm text-destructive">
                  {fields.notes.errors.join(" ")}
                </p>
              ) : null}
            </section>

            <hr className="border-border/60" />

            <section className="grid gap-2">
              <Label htmlFor={fields.operatorId.id}>
                Operator / who filled out this form
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

            <section className="grid gap-2">
              <Label>Signature / initials</Label>
              <SignaturePad
                name={fields.signature.name}
                id={fields.signature.id}
                required
                error={fields.signature.errors?.join(" ")}
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
              {isSubmitting
                ? "Saving…"
                : definition.questions.length === 0
                  ? `No questions configured`
                  : `Submit ${formNoun}`}
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

function LastValueHint({
  questionId,
  questionType,
  lastValue,
  currentValue,
  onUse,
}: {
  questionId: string;
  questionType: InspectionQuestionType;
  lastValue: string;
  currentValue: string;
  onUse: () => void;
}) {
  const alreadyUsing = currentValue === lastValue;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <p id={`${questionId}-last-value`}>
        Last value:{" "}
        <span className="font-medium text-foreground">
          {formatLastAnswerDisplay(lastValue, questionType)}
        </span>
      </p>
      {!alreadyUsing ? (
        <button
          type="button"
          onClick={onUse}
          className="font-medium text-brand-navy underline-offset-4 hover:underline"
        >
          Use
        </button>
      ) : null}
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
