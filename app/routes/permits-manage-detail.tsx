import { data, Form, Link, redirect } from "react-router";
import { useState } from "react";

import type { Route } from "./+types/permits-manage-detail";

import {
  ChecklistQuestionEditor,
  ChecklistQuestionFields,
} from "~/components/checklist-question-editor";
import { pageTitle } from "~/lib/brand";
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
import { Textarea } from "~/components/ui/textarea";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireOperatorManager } from "~/lib/auth.server";
import {
  PERMIT_CATEGORY,
  isPermitInspection,
  parseChecklistQuestionFormData,
  questionTypeLabel,
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
    { title: pageTitle("Edit permit") },
    {
      name: "description",
      content: "Edit permit form details and checklist questions.",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireOperatorManager(request);
  const inspection = await getManagedInspection(params.inspectionId);
  if (!inspection) {
    throw new Response("Permit form not found", { status: 404 });
  }
  if (!isPermitInspection(inspection)) {
    throw redirect(`/inspections/manage/${inspection.id}`);
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
    const existing = await getManagedInspection(inspectionId);
    if (!existing) {
      return data({ error: "Permit form not found." }, { status: 404 });
    }
    if (!isPermitInspection(existing)) {
      return data(
        { error: "Edit this form under Inspections → Manage." },
        { status: 400 },
      );
    }

    if (intent === "update") {
      await updateManagedInspection({
        id: inspectionId,
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        category: PERMIT_CATEGORY,
        equipmentLabel: String(formData.get("equipmentLabel") ?? ""),
        isAvailable: String(formData.get("isAvailable") ?? "") === "on",
        requiredSignerCount: Number(formData.get("requiredSignerCount") ?? 2),
      });
      return { ok: true as const, message: "Details saved." };
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
      const parsed = parseChecklistQuestionFormData(formData, "permit");
      if ("error" in parsed) {
        return data({ error: parsed.error }, { status: 400 });
      }

      if (intent === "add-question") {
        await addInspectionQuestion({
          inspectionId,
          ...parsed,
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
        ...parsed,
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
            : "Could not update this permit form.",
      },
      { status: 400 },
    );
  }

  return data({ error: "Unknown action." }, { status: 400 });
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
                  <li
                    key={`${version.id}-${question.id || index}`}
                    className="text-sm"
                  >
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

export default function PermitsManageDetailPage({
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
            <Link
              to="/permits/manage"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← All permits
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {inspection.title}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Update permit details and checklist questions. Permits are separate
            from plant inspections — there are no shift or first-of-week rules
            here. When you are done, publish one form revision with a single
            comment. Operators fill these out on{" "}
            <Link
              to={inspection.href}
              className="underline-offset-4 hover:underline"
            >
              the permit form
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
                  <Textarea
                    id="description"
                    name="description"
                    rows={2}
                    defaultValue={inspection.description}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      name="category"
                      value={PERMIT_CATEGORY}
                      readOnly
                    />
                    <p className="text-xs text-muted-foreground">
                      Permit forms always use the Permits category.
                    </p>
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
                <div className="grid gap-2">
                  <Label htmlFor="requiredSignerCount">
                    Signatures required to open
                  </Label>
                  <select
                    id="requiredSignerCount"
                    name="requiredSignerCount"
                    defaultValue={String(inspection.requiredSignerCount ?? 2)}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-xs"
                  >
                    <option value="2">
                      2 different people (e.g. Safe Work)
                    </option>
                    <option value="3">
                      All 3 authorisation slots (e.g. Hot Work)
                    </option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Who may sign each slot is set under Permits → Settings. The
                    same person still cannot sign more than one role.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isAvailable"
                    defaultChecked={inspection.isAvailable}
                    className="size-4 accent-[var(--brand-navy)]"
                  />
                  Show on Permits page
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
                Choose yes/no, number, date, a text box, or radio options. Mark
                which answers should flag “needs attention”. Optionally mark
                start time, end time, or area for duration and dashboard rules.
                Shift and first-of-week limits apply only to inspections, not
                permits. Question edits go live right away; publish one revision
                when the whole batch is ready.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="grid gap-4">
                <input type="hidden" name="intent" value="add-question" />
                <ChecklistQuestionFields
                  kind="permit"
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
                Edit wording and options, or move questions up and down.
                Removing a question hides it from new submissions; past runs
                keep their answers. Publish a form revision when you finish a
                set of changes.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {inspection.questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No questions yet. Add one above.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {inspection.questions.map((question, index) => (
                    <ChecklistQuestionEditor
                      key={question.id}
                      kind="permit"
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

          <Card>
            <CardHeader>
              <CardTitle>Publish revision</CardTitle>
              <CardDescription>
                Batch any number of question edits into one form revision. Five
                question changes still become Rev {inspection.version} → Rev{" "}
                {inspection.version + 1}, with one overall comment.
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
                    <Textarea
                      id="changeComment-publish"
                      name="changeComment"
                      rows={3}
                      required
                      placeholder="Summarise what changed in this permit checklist revision and why"
                    />
                    <p className="text-xs text-muted-foreground">
                      This creates version {inspection.version + 1} and stores a
                      snapshot of the full checklist.
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
                  Checklist matches published version {inspection.version}. Edit
                  questions above, then come back here to publish one revision
                  for the whole batch.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Version history</CardTitle>
              <CardDescription>
                Each published revision stores one manager comment and a
                snapshot of the full checklist.
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
