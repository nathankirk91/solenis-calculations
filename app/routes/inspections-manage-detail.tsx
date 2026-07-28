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
  YES_NO_OPTIONS,
  type InspectionQuestionDef,
  type InspectionQuestionType,
} from "~/lib/inspections";
import {
  addInspectionQuestion,
  getManagedInspection,
  moveInspectionQuestion,
  removeInspectionQuestion,
  updateInspectionQuestion,
  updateManagedInspection,
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
  await requireOperatorManager(request);
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
      const payload = {
        label: String(formData.get("label") ?? ""),
        helpText: String(formData.get("helpText") ?? ""),
        sectionTitle: String(formData.get("sectionTitle") ?? ""),
        type,
        options,
        attentionValues: attentionRaw,
        required: String(formData.get("required") ?? "") === "on",
      };

      if (intent === "add-question") {
        await addInspectionQuestion({
          inspectionId,
          ...payload,
        });
        return { ok: true as const, message: "Question added." };
      }

      const questionId = String(formData.get("questionId") ?? "");
      if (!questionId) {
        return data({ error: "Missing question." }, { status: 400 });
      }
      await updateInspectionQuestion({
        questionId,
        ...payload,
      });
      return { ok: true as const, message: "Question updated." };
    }

    if (intent === "remove-question") {
      const questionId = String(formData.get("questionId") ?? "");
      if (!questionId) {
        return data({ error: "Missing question." }, { status: 400 });
      }
      await removeInspectionQuestion(questionId);
      return { ok: true as const, message: "Question removed." };
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
      return { ok: true as const, message: "Question order updated." };
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
  defaults,
}: {
  questionType: InspectionQuestionType;
  setQuestionType: (type: InspectionQuestionType) => void;
  radioOptions: string;
  setRadioOptions: (value: string) => void;
  defaults?: {
    label?: string;
    helpText?: string | null;
    sectionTitle?: string | null;
    required?: boolean;
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
                        : /need|fail|no|attention|defect/i.test(option)
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
}: {
  question: InspectionQuestionDef;
  index: number;
  total: number;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
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
            defaults={{
              label: question.label,
              helpText: question.helpText,
              sectionTitle: question.sectionTitle,
              required: question.required,
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
              {question.type === "YES_NO"
                ? "Yes / No"
                : question.type === "TEXT"
                  ? "Text"
                  : "Radio"}
            </Badge>
            {!question.required ? (
              <Badge variant="outline">Optional</Badge>
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
            Update details, edit questions, and change their order. Operators
            fill these out on{" "}
            <Link
              to={inspection.href}
              className="underline-offset-4 hover:underline"
            >
              the inspection form
            </Link>
            .
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
                  Show on home page
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
                Choose yes/no, a text box, or radio options. Mark which answers
                should flag “needs attention”.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="grid gap-4">
                <input type="hidden" name="intent" value="add-question" />
                <QuestionFields
                  questionType={questionType}
                  setQuestionType={setQuestionType}
                  radioOptions={radioOptions}
                  setRadioOptions={setRadioOptions}
                />
                <div>
                  <Button type="submit">Add question</Button>
                </div>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Questions ({inspection.questions.length})</CardTitle>
              <CardDescription>
                Edit wording and options, or move questions up and down. Removing
                a question hides it from new submissions; past runs keep their
                answers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inspection.questions.length === 0 ? (
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
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
