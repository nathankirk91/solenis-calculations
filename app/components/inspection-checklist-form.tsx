import {
  getFormProps,
  getInputProps,
  getSelectProps,
  useForm,
  type SubmissionResult,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { Form, useFetcher, useNavigation } from "react-router";
import { useEffect, useState } from "react";

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
import { SignaturePad } from "~/components/signature-pad";
import { createInspectionSchema } from "~/lib/inspection.schema";
import {
  YES_NO_OPTIONS,
  filterQuestionsForContext,
  findShiftQuestion,
  formatLastAnswerDisplay,
  groupQuestionsBySection,
  type InspectionDefinition,
  type InspectionQuestionType,
  type InspectionSummary,
  type LastInspectionAnswers,
} from "~/lib/inspections";
import type { InspectionActionItem } from "~/lib/inspections.server";
import type { OperatorOption } from "~/lib/operators.server";
import { formatMelbourneDateTime } from "~/lib/datetime";
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
  const shiftQuestion = findShiftQuestion(definition.questions);
  const needsWeekStatus = definition.questions.some(
    (question) => question.firstOfWeekOnly,
  );
  const [selectedShift, setSelectedShift] = useState("");
  const [isFirstInspectionOfWeek, setIsFirstInspectionOfWeek] = useState(true);
  const schema = createInspectionSchema(definition, {
    isFirstInspectionOfWeek,
  });
  const visibleQuestions = filterQuestionsForContext(definition.questions, {
    shift: selectedShift || null,
    isFirstInspectionOfWeek,
  });
  const sections = groupQuestionsBySection(visibleQuestions);
  const [signature, setSignature] = useState("");
  const fixedEquipmentRef = definition.fixedEquipmentRef?.trim() || "";
  const [equipmentRef, setEquipmentRef] = useState(fixedEquipmentRef);
  const [equipmentRefForFetch, setEquipmentRefForFetch] =
    useState(fixedEquipmentRef);
  const [responseOverrides, setResponseOverrides] = useState<
    Record<string, string>
  >({});
  const [actionFields, setActionFields] = useState<string[]>([""]);

  const needsLastAnswers = definition.questions.some(
    (question) => question.showLastValue,
  );

  const lastAnswersFetcher = useFetcher<LastInspectionAnswers>();
  const openActionsFetcher = useFetcher<{ actions: InspectionActionItem[] }>();
  const weekStatusFetcher = useFetcher<{ isFirstInspectionOfWeek: boolean }>();
  const lastAnswers = lastAnswersFetcher.data?.answers ?? {};
  const lastRunAt = lastAnswersFetcher.data?.createdAt ?? null;
  const openActions = openActionsFetcher.data?.actions ?? [];
  const needsEquipmentPick =
    Boolean(definition.equipmentLabel) && !fixedEquipmentRef;
  const canLoadScopedData =
    !needsEquipmentPick || Boolean(equipmentRefForFetch.trim());
  const canLoadLastAnswers = needsLastAnswers && canLoadScopedData;
  const isLoadingLastAnswers =
    lastAnswersFetcher.state === "loading" ||
    lastAnswersFetcher.state === "submitting";
  const isLoadingOpenActions =
    openActionsFetcher.state === "loading" ||
    openActionsFetcher.state === "submitting";

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
      equipmentRef: fixedEquipmentRef,
      notes: "",
      signature: "",
      responses: defaultResponses,
    },
  });

  const responseFields = fields.responses.getFieldset();

  useEffect(() => {
    if (fixedEquipmentRef) {
      setEquipmentRef(fixedEquipmentRef);
      setEquipmentRefForFetch(fixedEquipmentRef);
      return;
    }
    if (definition.equipmentChoices?.length) {
      setEquipmentRefForFetch(equipmentRef);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setEquipmentRefForFetch(equipmentRef.trim());
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [
    equipmentRef,
    definition.equipmentChoices?.length,
    fixedEquipmentRef,
  ]);

  useEffect(() => {
    setResponseOverrides({});
    setSelectedShift("");
  }, [equipmentRefForFetch]);

  useEffect(() => {
    if (!canLoadLastAnswers) {
      return;
    }

    const params = new URLSearchParams();
    if (equipmentRefForFetch.trim()) {
      params.set("equipmentRef", equipmentRefForFetch.trim());
    }
    const query = params.toString();
    const href = `/inspections/${definition.id}/last-answers${
      query ? `?${query}` : ""
    }`;
    lastAnswersFetcher.load(href);
    // fetcher identity is unstable; load when inspection/equipment changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [definition.id, equipmentRefForFetch, canLoadLastAnswers]);

  useEffect(() => {
    if (!canLoadScopedData) {
      return;
    }

    const params = new URLSearchParams();
    if (equipmentRefForFetch.trim()) {
      params.set("equipmentRef", equipmentRefForFetch.trim());
    }
    const query = params.toString();
    const href = `/inspections/${definition.id}/open-actions${
      query ? `?${query}` : ""
    }`;
    openActionsFetcher.load(href);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [definition.id, equipmentRefForFetch, canLoadScopedData]);

  useEffect(() => {
    if (!needsWeekStatus || !canLoadScopedData) {
      setIsFirstInspectionOfWeek(true);
      return;
    }

    const params = new URLSearchParams();
    if (equipmentRefForFetch.trim()) {
      params.set("equipmentRef", equipmentRefForFetch.trim());
    }
    if (selectedShift.trim()) {
      params.set("shift", selectedShift.trim());
    }
    const query = params.toString();
    const href = `/inspections/${definition.id}/week-status${
      query ? `?${query}` : ""
    }`;
    weekStatusFetcher.load(href);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [
    definition.id,
    equipmentRefForFetch,
    selectedShift,
    needsWeekStatus,
    canLoadScopedData,
  ]);

  useEffect(() => {
    if (weekStatusFetcher.data) {
      setIsFirstInspectionOfWeek(
        Boolean(weekStatusFetcher.data.isFirstInspectionOfWeek),
      );
    }
  }, [weekStatusFetcher.data]);
  function fieldValue(
    questionId: string,
    initialValue: unknown,
  ): string {
    if (Object.prototype.hasOwnProperty.call(responseOverrides, questionId)) {
      return responseOverrides[questionId] ?? "";
    }
    return typeof initialValue === "string" ? initialValue : "";
  }

  function useLastValue(questionId: string) {
    const lastValue = lastAnswers[questionId];
    if (!lastValue) {
      return;
    }
    setResponseOverrides((previous) => ({
      ...previous,
      [questionId]: lastValue,
    }));
  }

  function updateActionField(index: number, value: string) {
    setActionFields((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    );
  }

  function addActionField() {
    setActionFields((previous) => [...previous, ""]);
  }

  function removeActionField(index: number) {
    setActionFields((previous) => {
      if (previous.length <= 1) {
        return [""];
      }
      return previous.filter((_, itemIndex) => itemIndex !== index);
    });
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Checklist</CardTitle>
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
                    {isLoadingLastAnswers
                      ? "Loading previous answers…"
                      : lastRunAt
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
                    onChange={(event) => setEquipmentRef(event.target.value)}
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
                    onChange={(event) => setEquipmentRef(event.target.value)}
                    onBlur={(event) =>
                      setEquipmentRef(event.target.value.trim())
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
                    {canLoadLastAnswers
                      ? isLoadingLastAnswers
                        ? "Loading previous answers…"
                        : lastRunAt
                          ? `Previous report: ${formatMelbourneDateTime(lastRunAt)}`
                          : "No previous report for this unit yet."
                      : "Select a unit to load previous answers."}
                  </p>
                ) : null}
              </section>
            ) : null}

            {needsLastAnswers &&
            !needsEquipmentPick &&
            !fixedEquipmentRef &&
            lastRunAt ? (
              <p className="text-xs text-muted-foreground">
                Previous report: {formatMelbourneDateTime(lastRunAt)}
              </p>
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
                    const value = fieldValue(question.id, field.initialValue);
                    const lastValue = lastAnswers[question.id] ?? "";
                    const showConfiguredLastValue =
                      question.showLastValue &&
                      canLoadLastAnswers &&
                      Boolean(lastValue);
                    const inputKey = `${field.key}-${value}`;

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
                            onUse={() => useLastValue(question.id)}
                          />
                        ) : null}

                        {question.type === "TEXT" ? (
                          <div className="mt-3">
                            <textarea
                              id={field.id}
                              name={field.name}
                              key={inputKey}
                              defaultValue={value}
                              rows={3}
                              className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
                              placeholder="Enter details…"
                              aria-invalid={Boolean(field.errors)}
                            />
                          </div>
                        ) : question.type === "NUMBER" ? (
                          <div className="mt-3">
                            <Input
                              id={field.id}
                              name={field.name}
                              key={inputKey}
                              type="number"
                              defaultValue={value}
                              inputMode="decimal"
                              step="any"
                              placeholder="e.g. 4025.3"
                              className="max-w-xs"
                              aria-invalid={Boolean(field.errors)}
                            />
                          </div>
                        ) : question.type === "DATE" ? (
                          <div className="mt-3">
                            <Input
                              id={field.id}
                              name={field.name}
                              key={inputKey}
                              type="date"
                              defaultValue={value}
                              className="max-w-xs"
                              aria-invalid={Boolean(field.errors)}
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
                                      type="radio"
                                      id={optionId}
                                      name={field.name}
                                      value={option}
                                      key={`${inputKey}-${option}`}
                                      defaultChecked={value === option}
                                      className="size-4 accent-[var(--brand-navy)]"
                                      onChange={() => {
                                        setResponseOverrides((previous) => ({
                                          ...previous,
                                          [question.id]: option,
                                        }));
                                        if (
                                          shiftQuestion &&
                                          question.id === shiftQuestion.id
                                        ) {
                                          setSelectedShift(option);
                                        }
                                      }}
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
                  onClick={addActionField}
                >
                  Add action
                </Button>
              </div>

              {canLoadScopedData ? (
                isLoadingOpenActions && openActions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Checking for open actions…
                  </p>
                ) : openActions.length > 0 ? (
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
                {actionFields.map((value, index) => (
                  <div key={`action-${index}`} className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={`action-${index}`}>
                        Action {index + 1}
                      </Label>
                      {actionFields.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeActionField(index)}
                          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <textarea
                      id={`action-${index}`}
                      name="actions"
                      value={value}
                      onChange={(event) =>
                        updateActionField(index, event.target.value)
                      }
                      rows={2}
                      className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Describe the action that needs completing…"
                    />
                  </div>
                ))}
              </div>
            </section>

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
                value={signature}
                onChange={setSignature}
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
