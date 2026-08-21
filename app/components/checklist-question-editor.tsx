import { Form } from "react-router";
import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  INSPECTION_SHIFT_OPTIONS,
  PERMIT_FIELD_ROLE_LABELS,
  PERMIT_FIELD_ROLES,
  YES_NO_OPTIONS,
  looksLikeAttentionOption,
  questionTypeLabel,
  resolvePermitFieldRole,
  type ChecklistQuestionKind,
  type InspectionQuestionDef,
  type InspectionQuestionType,
  type PermitFieldRole,
} from "~/lib/inspections";

export type { ChecklistQuestionKind } from "~/lib/inspections";
export { parseChecklistQuestionFormData } from "~/lib/inspections";

export type ChecklistQuestionFieldDefaults = {
  label?: string;
  helpText?: string | null;
  sectionTitle?: string | null;
  required?: boolean;
  showLastValue?: boolean;
  applicableEquipmentRefs?: string[];
  applicableShifts?: string[];
  firstOfWeekOnly?: boolean;
  attentionValues?: string[];
  permitFieldRole?: PermitFieldRole | null;
};

export function ChecklistQuestionFields({
  kind,
  questionType,
  setQuestionType,
  radioOptions,
  setRadioOptions,
  unitOptions = [],
  defaults,
}: {
  kind: ChecklistQuestionKind;
  questionType: InspectionQuestionType;
  setQuestionType: (type: InspectionQuestionType) => void;
  radioOptions: string;
  setRadioOptions: (value: string) => void;
  unitOptions?: Array<{ value: string; label: string }>;
  defaults?: ChecklistQuestionFieldDefaults;
}) {
  const radioOptionList = radioOptions
    .split(/\n|,/)
    .map((option) => option.trim())
    .filter(Boolean);

  const attentionChoices =
    kind === "inspection" && questionType === "YES_NO"
      ? [...YES_NO_OPTIONS]
      : kind === "inspection" &&
          (questionType === "RADIO" || questionType === "CHECKBOX")
        ? radioOptionList
        : [];

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`label-${defaults?.label ?? "new"}`}>Question</Label>
        <Input
          id={`label-${defaults?.label ?? "new"}`}
          name="label"
          required
          defaultValue={defaults?.label ?? ""}
          placeholder="e.g. Are walkways clear?"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-2">
        <Label>Help text (optional)</Label>
        <Input
          name="helpText"
          defaultValue={defaults?.helpText ?? ""}
          placeholder="Extra guidance for operators"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-2">
        <Label>Section (optional)</Label>
        <Input
          name="sectionTitle"
          defaultValue={defaults?.sectionTitle ?? ""}
          placeholder="e.g. Pre-start visual"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-2">
        <Label>Answer type</Label>
        <select
          name="type"
          value={questionType}
          onChange={(event) =>
            setQuestionType(event.target.value as InspectionQuestionType)
          }
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="YES_NO">Yes / No</option>
          <option value="TEXT">Text box</option>
          <option value="NUMBER">Number</option>
          <option value="DATE">Date</option>
          <option value="TIME">Time (24-hour)</option>
          <option value="RADIO">Radio options</option>
          <option value="CHECKBOX">Checkboxes (multi-select)</option>
        </select>
      </div>

      {kind === "permit" ? (
        <div className="grid gap-2">
          <Label htmlFor="permitFieldRole">Special permit field</Label>
          <select
            id="permitFieldRole"
            name="permitFieldRole"
            defaultValue={defaults?.permitFieldRole ?? ""}
            className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">None (ordinary checklist item)</option>
            {PERMIT_FIELD_ROLES.map((role) => (
              <option key={role} value={role}>
                {PERMIT_FIELD_ROLE_LABELS[role]}
                {role === "start_time" || role === "end_time"
                  ? " — use Time type"
                  : " — use Text type"}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Mark start time, end time, and area once per form so the 12-hour
            duration rule and dashboard area column work without coding.
          </p>
        </div>
      ) : (
        <input type="hidden" name="permitFieldRole" value="" />
      )}

      {questionType === "RADIO" || questionType === "CHECKBOX" ? (
        <div className="grid gap-2">
          <Label>Options (one per line, or comma-separated)</Label>
          <Textarea
            name="options"
            rows={4}
            value={radioOptions}
            onChange={(event) => setRadioOptions(event.target.value)}
            required
          />
        </div>
      ) : (
        <input type="hidden" name="options" value="" />
      )}

      {kind === "inspection" ? (
        <>
          {attentionChoices.length > 0 ? (
            <fieldset key={`${questionType}-attention`} className="grid gap-2">
              <legend className="text-sm font-medium">
                Flag as needs attention when answer is
              </legend>
              <p className="text-xs text-muted-foreground">
                Leave all unchecked if no answer should flag the inspection.
              </p>
              <div className="flex flex-wrap gap-3">
                {attentionChoices.map((option) => (
                  <label
                    key={option}
                    className="inline-flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="attentionValues"
                      value={option}
                      defaultChecked={
                        defaults?.attentionValues
                          ? defaults.attentionValues.includes(option)
                          : questionType === "YES_NO"
                            ? option === "No"
                            : looksLikeAttentionOption(option)
                      }
                      className="size-4 accent-[var(--brand-navy)]"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="required"
              defaultChecked={defaults?.required ?? true}
              className="size-4 accent-[var(--brand-navy)]"
            />
            Required
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="showLastValue"
              defaultChecked={defaults?.showLastValue ?? false}
              className="mt-0.5 size-4 accent-[var(--brand-navy)]"
            />
            <span>
              Show last value
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                Operators see the prior report’s answer when one exists (useful
                for service date).
              </span>
            </span>
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Applies to shifts</legend>
            <p className="text-xs text-muted-foreground">
              Leave all unchecked to include this question on every shift. Tick
              Day and/or Afternoon to limit it (e.g. weekly items on day shift
              only).
            </p>
            <div className="flex flex-wrap gap-3">
              {INSPECTION_SHIFT_OPTIONS.map((shift) => (
                <label
                  key={shift}
                  className="inline-flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="applicableShifts"
                    value={shift}
                    defaultChecked={Boolean(
                      defaults?.applicableShifts?.includes(shift),
                    )}
                    className="size-4 accent-[var(--brand-navy)]"
                  />
                  {shift}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="firstOfWeekOnly"
              defaultChecked={defaults?.firstOfWeekOnly ?? false}
              className="mt-0.5 size-4 accent-[var(--brand-navy)]"
            />
            <span>
              First inspection of the week only
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                Week starts Monday (after Sunday) in Melbourne time. Combined
                with shift limits, this is how weekly day-shift checks work.
              </span>
            </span>
          </label>
          {unitOptions.length > 0 ? (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">Applies to units</legend>
              <p className="text-xs text-muted-foreground">
                Leave all unchecked to include this question on every unit form.
                Tick specific units to limit it.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {unitOptions.map((unit) => (
                  <label
                    key={unit.value}
                    className="inline-flex items-start gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="applicableEquipmentRefs"
                      value={unit.value}
                      defaultChecked={Boolean(
                        defaults?.applicableEquipmentRefs?.includes(unit.value),
                      )}
                      className="mt-0.5 size-4 accent-[var(--brand-navy)]"
                    />
                    <span>{unit.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </>
      ) : null}
    </>
  );
}

export function ChecklistQuestionEditor({
  kind,
  question,
  index,
  total,
  isEditing,
  onEdit,
  onCancel,
  unitOptions = [],
}: {
  kind: ChecklistQuestionKind;
  question: InspectionQuestionDef;
  index: number;
  total: number;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  unitOptions?: Array<{ value: string; label: string }>;
}) {
  const [questionType, setQuestionType] = useState<InspectionQuestionType>(
    question.type,
  );
  const [radioOptions, setRadioOptions] = useState(
    question.options.length > 0
      ? question.options.join("\n")
      : "OK\nNeeds attention\nN/A",
  );
  const fieldRole =
    kind === "permit" ? resolvePermitFieldRole(question) : null;

  if (isEditing) {
    return (
      <li className="rounded-lg border border-border/70 bg-background/50 px-3 py-3">
        <Form method="post" className="grid gap-4" onSubmit={onCancel}>
          <input type="hidden" name="intent" value="update-question" />
          <input type="hidden" name="questionId" value={question.id} />
          <p className="text-sm font-medium text-brand-navy">Edit question</p>
          <ChecklistQuestionFields
            kind={kind}
            questionType={questionType}
            setQuestionType={setQuestionType}
            radioOptions={radioOptions}
            setRadioOptions={setRadioOptions}
            unitOptions={kind === "inspection" ? unitOptions : []}
            defaults={{
              label: question.label,
              helpText: question.helpText,
              sectionTitle: question.sectionTitle,
              required: question.required,
              showLastValue: question.showLastValue,
              applicableEquipmentRefs: question.applicableEquipmentRefs,
              applicableShifts: question.applicableShifts,
              firstOfWeekOnly: question.firstOfWeekOnly,
              attentionValues: question.attentionValues,
              permitFieldRole: fieldRole,
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Save question</Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </Form>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border/70 bg-background/50 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">#{index + 1}</span>
            <p className="font-medium text-brand-navy">{question.label}</p>
            <Badge variant="secondary">
              {questionTypeLabel(question.type)}
            </Badge>
            {fieldRole ? (
              <Badge variant="outline">
                {PERMIT_FIELD_ROLE_LABELS[fieldRole]}
              </Badge>
            ) : null}
            {kind === "inspection" && !question.required ? (
              <Badge variant="outline">Optional</Badge>
            ) : null}
            {kind === "inspection" && question.showLastValue ? (
              <Badge variant="outline">Shows last value</Badge>
            ) : null}
            {kind === "inspection" &&
            question.applicableEquipmentRefs.length > 0 ? (
              <Badge variant="outline">
                {question.applicableEquipmentRefs.length === 1
                  ? question.applicableEquipmentRefs[0]
                  : `${question.applicableEquipmentRefs.length} units`}
              </Badge>
            ) : null}
            {kind === "inspection" && question.applicableShifts.length > 0 ? (
              <Badge variant="outline">
                {question.applicableShifts.join(" / ")} shift
              </Badge>
            ) : null}
            {kind === "inspection" && question.firstOfWeekOnly ? (
              <Badge variant="outline">First of week</Badge>
            ) : null}
          </div>
          {question.sectionTitle ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Section: {question.sectionTitle}
            </p>
          ) : null}
          {question.type === "RADIO" || question.type === "CHECKBOX" ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Options: {question.options.join(", ")}
            </p>
          ) : null}
          {kind === "inspection" && question.attentionValues.length > 0 ? (
            <p className="mt-1 text-sm text-amber-800">
              Flags attention: {question.attentionValues.join(", ")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Form method="post">
            <input type="hidden" name="intent" value="move-question" />
            <input type="hidden" name="questionId" value={question.id} />
            <input type="hidden" name="direction" value="up" />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={index === 0}
            >
              Move up
            </Button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="move-question" />
            <input type="hidden" name="questionId" value={question.id} />
            <input type="hidden" name="direction" value="down" />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={index >= total - 1}
            >
              Move down
            </Button>
          </Form>
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Form method="post">
            <input type="hidden" name="intent" value="remove-question" />
            <input type="hidden" name="questionId" value={question.id} />
            <Button type="submit" variant="outline" size="sm">
              Remove
            </Button>
          </Form>
        </div>
      </div>
    </li>
  );
}
