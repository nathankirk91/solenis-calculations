import { data, Form, Link } from "react-router";
import { useState } from "react";

import type { Route } from "./+types/inspections-manage-detail";

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
  INSPECTION_QUESTION_TYPES,
  INSPECTION_SHIFT_OPTIONS,
  YES_NO_OPTIONS,
  looksLikeAttentionOption,
  questionTypeLabel,
  type InspectionQuestionDef,
  type InspectionQuestionType,
} from "~/lib/inspections";
import {
  addInspectionQuestion,
  getManagedInspection,
  moveInspectionQuestion,
  publishInspectionVersion,
  removeInspectionQuestion,
  updateInspectionQuestion,
  updateManagedInspection,
  type InspectionVersionHistoryItem,
} from "~/lib/inspections.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Edit inspection | Springvale Solenis" },
    {
      name: "description",
      content: "Edit inspection details and checklist questions.",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireOperatorManager(request);
  const inspection = await getManagedInspection(params.inspectionId);
  if (!inspection) {
    throw new Response("Inspection not found", { status: 404 });
  }
  const pendingCount = await countPendingRuns();
  return { user, inspection, pendingCount };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireOperatorManager(request);
  const inspectionId = params.inspectionId;
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "update") {
      await updateManagedInspection({
        id: inspectionId,
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        category: String(formData.get("category") ?? ""),
        equipmentLabel: String(formData.get("equipmentLabel") ?? ""),
        isAvailable: String(formData.get("isAvailable") ?? "") === "on",
      });
      return { ok: true as const, message: "Inspection details saved." };
    }

    if (intent === "publish-version") {
      const version = await publishInspectionVersion({
        inspectionId,
        changeComment: String(formData.get("changeComment") ?? ""),
        changedById: user.id,
      });
      return {
        ok: true as const,
        message: `Checklist published as revision ${version}.`,
      };
    }

    if (intent === "add-question" || intent === "update-question") {
      const type = String(
        formData.get("type") ?? "YES_NO",
      ) as InspectionQuestionType;
      if (!INSPECTION_QUESTION_TYPES.includes(type)) {
        return data({ error: "Invalid question type." }, { status: 400 });
      }

      const optionsRaw = String(formData.get("options") ?? "");
      const options = optionsRaw
        .split(/\n|,/)
        .map((option) => option.trim())
        .filter(Boolean);

      const attentionRaw = formData.getAll("attentionValues").map(String);
      const applicableEquipmentRefs = formData
        .getAll("applicableEquipmentRefs")
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean);
      const applicableShifts = formData
        .getAll("applicableShifts")
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean);
      const payload = {
        label: String(formData.get("label") ?? ""),
        helpText: String(formData.get("helpText") ?? ""),
        sectionTitle: String(formData.get("sectionTitle") ?? ""),
        type,
        options,
        attentionValues: attentionRaw,
        required: String(formData.get("required") ?? "") === "on",
        showLastValue: String(formData.get("showLastValue") ?? "") === "on",
        applicableEquipmentRefs,
        applicableShifts,
        firstOfWeekOnly: String(formData.get("firstOfWeekOnly") ?? "") === "on",
      };

      if (intent === "add-question") {
        await addInspectionQuestion({
          inspectionId,
          ...payload,
        });
        return {
          ok: true as const,
          message:
            "Question added. Publish a revision when your checklist edits are ready.",
        };
      }

      const questionId = String(formData.get("questionId") ?? "");
      if (!questionId) {
        return data({ error: "Missing question." }, { status: 400 });
      }
      await updateInspectionQuestion({
        questionId,
        ...payload,
      });
      return {
        ok: true as const,
        message:
          "Question updated. Publish a revision when your checklist edits are ready.",
      };
    }

    if (intent === "remove-question") {
      const questionId = String(formData.get("questionId") ?? "");
      if (!questionId) {
        return data({ error: "Missing question." }, { status: 400 });
      }
      await removeInspectionQuestion({
        questionId,
      });
      return {
        ok: true as const,
        message:
          "Question removed. Publish a revision when your checklist edits are ready.",
      };
    }

    if (intent === "move-question") {
      const questionId = String(formData.get("questionId") ?? "");
      const direction = String(formData.get("direction") ?? "");
      if (!questionId || (direction !== "up" && direction !== "down")) {
        return data({ error: "Invalid move request." }, { status: 400 });
      }
      await moveInspectionQuestion({
        questionId,
        direction,
      });
      return {
        ok: true as const,
        message:
          "Question order updated. Publish a revision when your checklist edits are ready.",
      };
    }
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update this inspection.",
      },
      { status: 400 },
    );
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

function QuestionFields({
  questionType,
  setQuestionType,
  radioOptions,
  setRadioOptions,
  unitOptions = [],
  defaults,
}: {
  questionType: InspectionQuestionType;
  setQuestionType: (type: InspectionQuestionType) => void;
  radioOptions: string;
  setRadioOptions: (value: string) => void;
  unitOptions?: Array<{ value: string; label: string }>;
  defaults?: {
    label?: string;
    helpText?: string | null;
    sectionTitle?: string | null;
    required?: boolean;
    showLastValue?: boolean;
    applicableEquipmentRefs?: string[];
    applicableShifts?: string[];
    firstOfWeekOnly?: boolean;
    attentionValues?: string[];
  };
}) {
  const radioOptionList = radioOptions
    .split(/\n|,/)
    .map((option) => option.trim())
    .filter(Boolean);

  const attentionChoices =
    questionType === "YES_NO"
      ? [...YES_NO_OPTIONS]
      : questionType === "RADIO"
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
          <option value="RADIO">Radio options</option>
        </select>
      </div>

      {questionType === "RADIO" ? (
        <div className="grid gap-2">
          <Label>Options (one per line, or comma-separated)</Label>
          <textarea
            name="options"
            rows={4}
            value={radioOptions}
            onChange={(event) => setRadioOptions(event.target.value)}
            className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            required
          />
        </div>
      ) : (
        <input type="hidden" name="options" value="" />
      )}

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
            Operators see the prior report’s answer when one exists (useful for
            service date).
          </span>
        </span>
      </label>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Applies to shifts</legend>
        <p className="text-xs text-muted-foreground">
          Leave all unchecked to include this question on every shift. Tick Day
          and/or Afternoon to limit it (e.g. weekly items on day shift only).
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
            Week starts Monday (after Sunday) in Melbourne time. Combined with
            shift limits, this is how weekly day-shift checks work.
          </span>
        </span>
      </label>
      {unitOptions.length > 0 ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Applies to units</legend>
          <p className="text-xs text-muted-foreground">
            Leave all unchecked to include this question on every unit form. Tick
            specific units to limit it.
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
  );
}

function QuestionEditor({
  question,
  index,
  total,
  isEditing,
  onEdit,
  onCancel,
  unitOptions = [],
}: {
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

  if (isEditing) {
    return (
      <li className="rounded-lg border border-border/70 bg-background/50 px-3 py-3">
        <Form method="post" className="grid gap-4" onSubmit={onCancel}>
          <input type="hidden" name="intent" value="update-question" />
          <input type="hidden" name="questionId" value={question.id} />
          <p className="text-sm font-medium text-brand-navy">Edit question</p>
          <QuestionFields
            questionType={questionType}
            setQuestionType={setQuestionType}
            radioOptions={radioOptions}
            setRadioOptions={setRadioOptions}
            unitOptions={unitOptions}
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
            {!question.required ? (
              <Badge variant="outline">Optional</Badge>
            ) : null}
            {question.showLastValue ? (
              <Badge variant="outline">Shows last value</Badge>
            ) : null}
            {question.applicableEquipmentRefs.length > 0 ? (
              <Badge variant="outline">
                {question.applicableEquipmentRefs.length === 1
                  ? question.applicableEquipmentRefs[0]
                  : `${question.applicableEquipmentRefs.length} units`}
              </Badge>
            ) : null}
            {question.applicableShifts.length > 0 ? (
              <Badge variant="outline">
                {question.applicableShifts.join(" / ")} shift
              </Badge>
            ) : null}
            {question.firstOfWeekOnly ? (
              <Badge variant="outline">First of week</Badge>
            ) : null}
          </div>
          {question.sectionTitle ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Section: {question.sectionTitle}
            </p>
          ) : null}
          {question.type === "RADIO" ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Options: {question.options.join(", ")}
            </p>
          ) : null}
          {question.attentionValues.length > 0 ? (
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

function formatVersionDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function VersionHistory({
  versions,
}: {
  versions: InspectionVersionHistoryItem[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No version history yet.</p>
    );
  }

  return (
    <ul className="grid gap-3">
      {versions.map((version) => {
        const expanded = expandedId === version.id;
        const author =
          version.changedByName || version.changedByEmail || "System";
        return (
          <li
            key={version.id}
            className="rounded-lg border border-border/70 bg-background/50 px-3 py-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">v{version.version}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatVersionDate(version.createdAt)}
                  </span>
                  <span className="text-sm text-muted-foreground">· {author}</span>
                </div>
                <p className="mt-2 text-sm text-brand-navy">
                  {version.changeComment}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {version.questionCount} question
                  {version.questionCount === 1 ? "" : "s"} in this snapshot
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setExpandedId(expanded ? null : version.id)
                }
              >
                {expanded ? "Hide questions" : "Show questions"}
              </Button>
            </div>
            {expanded ? (
              <ol className="mt-3 grid gap-2 border-t border-border/60 pt-3">
                {version.snapshot.questions.map((question, index) => (
                  <li key={`${version.id}-${question.id || index}`} className="text-sm">
                    <span className="text-muted-foreground">#{index + 1}</span>{" "}
                    {question.label}
                    <span className="text-muted-foreground">
                      {" "}
                      ({questionTypeLabel(question.type)})
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default function InspectionsManageDetailPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, inspection, pendingCount } = loaderData;
  const [questionType, setQuestionType] =
    useState<InspectionQuestionType>("YES_NO");
  const [radioOptions, setRadioOptions] = useState("OK\nNeeds attention\nN/A");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null,
  );

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Management</Badge>
            <Badge variant="outline">Version {inspection.version}</Badge>
            {inspection.hasUnpublishedChanges ? (
              <Badge variant="outline">Unpublished changes</Badge>
            ) : null}
            {inspection.unitFormCount > 0 ? (
              <Badge variant="outline">
                Master template · {inspection.unitFormCount} unit forms
              </Badge>
            ) : null}
            {inspection.inheritsQuestions ? (
              <Badge variant="outline">Shared questions</Badge>
            ) : null}
            {inspection.fixedEquipmentRef ? (
              <Badge variant="outline">
                Unit {inspection.fixedEquipmentRef}
              </Badge>
            ) : null}
            <Link
              to="/inspections/manage"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← All inspections
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {inspection.title}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {inspection.inheritsQuestions ? (
              <>
                This unit form inherits its checklist from the master template.
                Change questions once on the template and every unit form updates.
                Operators fill this out on{" "}
                <Link
                  to={inspection.href}
                  className="underline-offset-4 hover:underline"
                >
                  the inspection form
                </Link>
                .
              </>
            ) : inspection.unitFormCount > 0 ? (
              <>
                This is the master forklift checklist. Question edits here apply
                to all {inspection.unitFormCount} unit forms. Publish one
                revision when your batch of edits is done. The template itself
                is hidden from operators.
              </>
            ) : (
              <>
                Update details and edit questions freely. When you are done,
                publish one form revision with a single comment. Operators fill
                these out on{" "}
                <Link
                  to={inspection.href}
                  className="underline-offset-4 hover:underline"
                >
                  the inspection form
                </Link>
                .
              </>
            )}
          </p>
          {actionData && "error" in actionData && actionData.error ? (
            <p className="mt-3 text-sm text-destructive">{actionData.error}</p>
          ) : null}
          {actionData && "message" in actionData && actionData.message ? (
            <p className="mt-3 text-sm text-emerald-700">{actionData.message}</p>
          ) : null}
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>
                Title and availability changes do not create a new revision.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="grid gap-4">
                <input type="hidden" name="intent" value="update" />
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    required
                    defaultValue={inspection.title}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    name="description"
                    rows={2}
                    defaultValue={inspection.description}
                    className="flex w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      name="category"
                      defaultValue={inspection.category}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="equipmentLabel">Equipment ID label</Label>
                    <Input
                      id="equipmentLabel"
                      name="equipmentLabel"
                      defaultValue={inspection.equipmentLabel ?? ""}
                      placeholder="Leave blank if not needed"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isAvailable"
                    defaultChecked={inspection.isAvailable}
                    className="size-4 accent-[var(--brand-navy)]"
                  />
                  Show on Inspections page
                </label>
                <div>
                  <Button type="submit">Save details</Button>
                </div>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add question</CardTitle>
              <CardDescription>
                {inspection.inheritsQuestions ? (
                  <>
                    Questions are edited on the master template, not this unit
                    form.
                  </>
                ) : (
                  <>
                    Choose yes/no, number, date, a text box, or radio options.
                    Mark which answers should flag “needs attention”. Question
                    edits go live right away
                    {inspection.unitFormCount > 0
                      ? " for every unit form"
                      : ""}
                    ; publish one revision when the whole batch is ready.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inspection.inheritsQuestions && inspection.questionSourceId ? (
                <div className="grid gap-3">
                  <p className="text-sm text-muted-foreground">
                    Shared checklist:{" "}
                    <span className="font-medium text-foreground">
                      {inspection.questionSourceTitle}
                    </span>
                  </p>
                  <div>
                    <Button asChild>
                      <Link
                        to={`/inspections/manage/${inspection.questionSourceId}`}
                      >
                        Edit shared questions
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <Form method="post" className="grid gap-4">
                  <input type="hidden" name="intent" value="add-question" />
                  <QuestionFields
                    questionType={questionType}
                    setQuestionType={setQuestionType}
                    radioOptions={radioOptions}
                    setRadioOptions={setRadioOptions}
                    unitOptions={inspection.unitOptions}
                  />
                  <div>
                    <Button type="submit">Add question</Button>
                  </div>
                </Form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Questions ({inspection.questions.length})</CardTitle>
              <CardDescription>
                {inspection.inheritsQuestions ? (
                  <>
                    Read-only preview of the shared checklist. Use “Edit shared
                    questions” above to change wording, options, or order.
                  </>
                ) : (
                  <>
                    Edit wording and options, or move questions up and down.
                    Removing a question hides it from new submissions; past runs
                    keep their answers. Publish a form revision when you finish
                    a set of changes.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {inspection.inheritsQuestions ? (
                <ol className="grid gap-3">
                  {inspection.questions.map((question, index) => (
                    <li
                      key={question.id}
                      className="rounded-lg border border-border/70 px-3 py-3 text-sm"
                    >
                      <p className="font-medium text-brand-navy">
                        <span className="text-muted-foreground">
                          #{index + 1}
                        </span>{" "}
                        {question.label}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {questionTypeLabel(question.type)}
                        {question.sectionTitle
                          ? ` · ${question.sectionTitle}`
                          : ""}
                        {question.required ? "" : " · Optional"}
                        {question.showLastValue ? " · Shows last value" : ""}
                        {question.applicableEquipmentRefs.length > 0
                          ? ` · ${question.applicableEquipmentRefs.join(", ")}`
                          : ""}
                        {question.applicableShifts.length > 0
                          ? ` · ${question.applicableShifts.join("/")} shift`
                          : ""}
                        {question.firstOfWeekOnly ? " · First of week" : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : inspection.questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No questions yet. Add one above.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {inspection.questions.map((question, index) => (
                    <QuestionEditor
                      key={question.id}
                      question={question}
                      index={index}
                      total={inspection.questions.length}
                      isEditing={editingQuestionId === question.id}
                      onEdit={() => setEditingQuestionId(question.id)}
                      onCancel={() => setEditingQuestionId(null)}
                      unitOptions={inspection.unitOptions}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {!inspection.inheritsQuestions ? (
            <Card>
              <CardHeader>
                <CardTitle>Publish revision</CardTitle>
                <CardDescription>
                  Batch any number of question edits into one form revision.
                  Five question changes still become Rev {inspection.version} →
                  Rev {inspection.version + 1}, with one overall comment.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {inspection.hasUnpublishedChanges ? (
                  <Form
                    method="post"
                    className="grid gap-4"
                    key={`publish-${inspection.version}`}
                  >
                    <input type="hidden" name="intent" value="publish-version" />
                    <div className="grid gap-2 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-3">
                      <Label htmlFor="changeComment-publish">
                        Revision comment (required)
                      </Label>
                      <textarea
                        id="changeComment-publish"
                        name="changeComment"
                        rows={3}
                        required
                        placeholder="Summarise what changed in this checklist revision and why"
                        className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      />
                      <p className="text-xs text-muted-foreground">
                        This creates version {inspection.version + 1} and stores
                        a snapshot of the full checklist.
                      </p>
                    </div>
                    <div>
                      <Button type="submit">
                        Publish as version {inspection.version + 1}
                      </Button>
                    </div>
                  </Form>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Checklist matches published version {inspection.version}.
                    Edit questions above, then come back here to publish one
                    revision for the whole batch.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Version history</CardTitle>
              <CardDescription>
                {inspection.inheritsQuestions
                  ? "Version history for the shared master checklist."
                  : "Each published revision stores one manager comment and a snapshot of the full checklist."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VersionHistory versions={inspection.versions} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
