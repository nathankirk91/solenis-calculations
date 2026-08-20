import { Prisma } from "../../generated/prisma/client";
import { getPrisma } from "~/lib/db.server";
import { melbourneDayBounds, startOfMelbourneWeek } from "~/lib/datetime";
import {
  parseInspectionHistorySort,
  sortInspectionHistoryItems,
  type InspectionHistorySort,
} from "~/lib/inspection-history";
import {
  FALLBACK_INSPECTIONS,
  FORKLIFT_UNITS,
  INSPECTION_DEFINITIONS,
  buildAnswersFromResponses,
  buildLastAnswerMap,
  defaultAttentionValues,
  filterQuestionsForEquipment,
  findShiftQuestion,
  getFallbackInspectionByIdOrSlug,
  groupQuestionsBySection,
  parseStringArray,
  questionOptionsForType,
  questionTypeStoresOptions,
  slugifyInspectionTitle,
  summarizeInspectionAnswers,
  type InspectionAnswerRecord,
  type InspectionCard,
  type InspectionDefinition,
  type InspectionQuestionDef,
  type InspectionQuestionType,
  type InspectionResponseRow,
  type InspectionSummary,
  type LastInspectionAnswers,
  type PermitFieldRole,
  parsePermitFieldRole,
  inferPermitFieldRoleFromId,
} from "~/lib/inspections";

function clampRequiredSignerCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return 2;
  }
  return Math.min(3, Math.max(1, Math.round(n)));
}

function isKnownQuestionType(value: unknown): value is InspectionQuestionType {
  return (
    value === "YES_NO" ||
    value === "TEXT" ||
    value === "RADIO" ||
    value === "NUMBER" ||
    value === "DATE" ||
    value === "TIME" ||
    value === "CHECKBOX"
  );
}

function optionsJsonForType(
  type: InspectionQuestionType,
  options: string[],
): string[] | typeof Prisma.DbNull {
  return questionTypeStoresOptions(type) ? options : Prisma.DbNull;
}

function attentionJsonForType(
  type: InspectionQuestionType,
  attentionValues: string[],
): string[] | typeof Prisma.DbNull {
  return type === "TEXT" ||
    type === "NUMBER" ||
    type === "DATE" ||
    type === "TIME"
    ? Prisma.DbNull
    : attentionValues;
}

export type { InspectionHistorySort };

export type InspectionRunStatus = "PASSED" | "NEEDS_ATTENTION";

export type ManagedInspection = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  href: string;
  equipmentLabel: string | null;
  requiredSignerCount: number | null;
  templateInspectionId: string | null;
  fixedEquipmentRef: string | null;
  isAvailable: boolean;
  sortOrder: number;
  questionCount: number;
  version: number;
  /** True when this inspection owns the shared question list for unit forms. */
  isQuestionSource: boolean;
};

export type InspectionVersionSnapshot = {
  title: string;
  description: string;
  category: string;
  equipmentLabel: string | null;
  questions: InspectionQuestionDef[];
};

export type InspectionVersionHistoryItem = {
  id: string;
  version: number;
  changeComment: string;
  createdAt: Date;
  changedByName: string | null;
  changedByEmail: string | null;
  questionCount: number;
  snapshot: InspectionVersionSnapshot;
};

export type ManagedInspectionDetail = InspectionDefinition & {
  version: number;
  versions: InspectionVersionHistoryItem[];
  /**
   * True when the live checklist differs from the latest published
   * version snapshot (question edits not yet published as a revision).
   */
  hasUnpublishedChanges: boolean;
  /** When inheriting, the template that owns editable questions. */
  questionSourceId: string | null;
  questionSourceTitle: string | null;
  inheritsQuestions: boolean;
  unitFormCount: number;
  /** Units that can be ticked on master-template questions. */
  unitOptions: Array<{ value: string; label: string }>;
};

export type InspectionHistoryItem = {
  id: string;
  status: InspectionRunStatus;
  createdAt: Date;
  inspectionTitle: string;
  inspectionHref: string;
  inspectionId: string;
  operatorName: string | null;
  equipmentRef: string | null;
  notes: string | null;
  signature: string | null;
  summary: InspectionSummary;
  /** Actions raised on this run (open + closed). */
  actionCount: number;
  answers: InspectionAnswerRecord[];
  responseRows: InspectionResponseRow[];
  actions: InspectionActionItem[];
};

export type ForkliftDayUnitStatus = {
  value: string;
  label: string;
  checked: boolean;
  runCount: number;
  latest: {
    id: string;
    status: InspectionRunStatus;
    createdAt: Date;
    operatorName: string | null;
    attentionCount: number;
    actionCount: number;
  } | null;
};

export type ForkliftDayDashboard = {
  date: string;
  units: ForkliftDayUnitStatus[];
  checkedCount: number;
  totalUnits: number;
  needsAttentionCount: number;
  actionsRaisedCount: number;
};

export type InspectionActionStatus = "OPEN" | "CLOSED";

export type InspectionActionItem = {
  id: string;
  description: string;
  status: InspectionActionStatus;
  equipmentRef: string | null;
  inspectionId: string;
  createdOnRunId: string;
  createdAt: Date;
  createdByOperatorName: string | null;
  closedAt: Date | null;
  closedByName: string | null;
  completionComment: string | null;
};

/** Missing columns/tables until ensureInspectionSchema (or migrate deploy) runs. */
function isMissingInspectionSchemaError(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (code === "P2022") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /applicable_shifts|first_of_week_only|applicable_equipment_refs|show_last_value|template_inspection_id|fixed_equipment_ref|does not exist|ColumnNotFound/i.test(
    message,
  );
}

async function ensureInspectionSchemaReady(): Promise<void> {
  const { ensureInspectionSchema } = await import("~/lib/migrate.server");
  await ensureInspectionSchema();
}

function mapQuestion(row: {
  id: string;
  label: string;
  helpText: string | null;
  sectionTitle: string | null;
  type: InspectionQuestionType;
  options: unknown;
  attentionValues: unknown;
  required: boolean;
  showLastValue?: boolean | null;
  applicableEquipmentRefs?: unknown;
  applicableShifts?: unknown;
  firstOfWeekOnly?: boolean | null;
  permitFieldRole?: string | null;
  sortOrder: number;
}): InspectionQuestionDef {
  const options = questionOptionsForType(
    row.type,
    parseStringArray(row.options),
  );
  const attentionValues = parseStringArray(row.attentionValues);
  const permitFieldRole =
    parsePermitFieldRole(row.permitFieldRole) ??
    inferPermitFieldRoleFromId(row.id);

  return {
    id: row.id,
    label: row.label,
    helpText: row.helpText,
    sectionTitle: row.sectionTitle,
    type: row.type,
    options,
    attentionValues:
      attentionValues.length > 0
        ? attentionValues
        : row.type === "YES_NO"
          ? defaultAttentionValues(row.type, options)
          : [],
    required: row.required,
    showLastValue: Boolean(row.showLastValue),
    applicableEquipmentRefs: parseStringArray(row.applicableEquipmentRefs),
    applicableShifts: parseStringArray(row.applicableShifts),
    firstOfWeekOnly: row.firstOfWeekOnly === true,
    permitFieldRole,
    sortOrder: row.sortOrder,
  };
}

function mapDefinition(row: {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  href: string;
  equipmentLabel: string | null;
  requiredSignerCount?: number | null;
  templateInspectionId?: string | null;
  fixedEquipmentRef?: string | null;
  isAvailable: boolean;
  sortOrder: number;
  questions: Array<{
    id: string;
    label: string;
    helpText: string | null;
    sectionTitle: string | null;
    type: InspectionQuestionType;
    options: unknown;
    attentionValues: unknown;
    required: boolean;
    showLastValue?: boolean | null;
    applicableEquipmentRefs?: unknown;
    applicableShifts?: unknown;
    firstOfWeekOnly?: boolean | null;
    permitFieldRole?: string | null;
    sortOrder: number;
  }>;
}): InspectionDefinition {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortName: row.title,
    description: row.description,
    category: row.category,
    href: row.href,
    equipmentLabel: row.equipmentLabel,
    requiredSignerCount: row.requiredSignerCount ?? null,
    templateInspectionId: row.templateInspectionId ?? null,
    fixedEquipmentRef: row.fixedEquipmentRef ?? null,
    isAvailable: row.isAvailable,
    sortOrder: row.sortOrder,
    questions: row.questions.map(mapQuestion),
  };
}

export async function listInspectionCards(): Promise<{
  inspections: InspectionCard[];
  source: "prisma" | "fallback";
}> {
  const prisma = getPrisma();
  if (!prisma) {
    return { inspections: FALLBACK_INSPECTIONS, source: "fallback" };
  }

  try {
    const rows = await prisma.inspection.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        category: true,
        href: true,
        isAvailable: true,
      },
    });

    if (!rows.length) {
      return { inspections: FALLBACK_INSPECTIONS, source: "fallback" };
    }

    return {
      inspections: rows.map((row) => {
        const fallback = getFallbackInspectionByIdOrSlug(row.id);
        return {
          id: row.id,
          slug: row.slug,
          title: row.title,
          description: row.description,
          category: fallback?.category ?? row.category,
          href: fallback?.href ?? row.href,
          isAvailable: row.isAvailable,
        };
      }),
      source: "prisma",
    };
  } catch {
    return { inspections: FALLBACK_INSPECTIONS, source: "fallback" };
  }
}

export async function getInspectionDefinition(
  idOrSlug: string,
): Promise<InspectionDefinition | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return resolveFallbackDefinition(idOrSlug);
  }

  try {
    const { ensureForkliftShiftWeekFlags } = await import("~/lib/migrate.server");
    await ensureForkliftShiftWeekFlags();
    return await getInspectionDefinitionOnce(idOrSlug);
  } catch (error) {
    if (isMissingInspectionSchemaError(error)) {
      await ensureInspectionSchemaReady();
      try {
        const { ensureForkliftShiftWeekFlags } = await import(
          "~/lib/migrate.server"
        );
        await ensureForkliftShiftWeekFlags();
        return await getInspectionDefinitionOnce(idOrSlug);
      } catch {
        return resolveFallbackDefinition(idOrSlug);
      }
    }
    return resolveFallbackDefinition(idOrSlug);
  }
}

async function getInspectionDefinitionOnce(
  idOrSlug: string,
): Promise<InspectionDefinition | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return resolveFallbackDefinition(idOrSlug);
  }

  const row = await prisma.inspection.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      questions: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!row) {
    return resolveFallbackDefinition(idOrSlug);
  }

  let questions = row.questions;
  let shortNameFallback: string | undefined;

  if (row.templateInspectionId) {
    const template = await prisma.inspection.findUnique({
      where: { id: row.templateInspectionId },
      include: {
        questions: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (template) {
      questions = template.questions;
    }
    shortNameFallback = getFallbackInspectionByIdOrSlug(row.id)?.shortName;
  }

  const definition = mapDefinition({ ...row, questions });
  if (shortNameFallback) {
    definition.shortName = shortNameFallback;
  }

  const merged = mergeStaticDefinitionMeta(definition);
  if (merged.fixedEquipmentRef) {
    merged.questions = filterQuestionsForEquipment(
      merged.questions,
      merged.fixedEquipmentRef,
    );
  }
  return merged;
}

function resolveFallbackDefinition(
  idOrSlug: string,
): InspectionDefinition | null {
  const fallback = getFallbackInspectionByIdOrSlug(idOrSlug);
  if (!fallback) {
    return null;
  }
  if (fallback.templateInspectionId) {
    const template = getFallbackInspectionByIdOrSlug(
      fallback.templateInspectionId,
    );
    const questions = filterQuestionsForEquipment(
      template?.questions ?? [],
      fallback.fixedEquipmentRef,
    );
    return {
      ...fallback,
      questions,
      instructionNotes:
        fallback.instructionNotes ?? template?.instructionNotes,
    };
  }
  return fallback;
}

/** Static checklist metadata (unit list, Form 78 notes) lives in code, not the DB. */
function mergeStaticDefinitionMeta(
  definition: InspectionDefinition,
): InspectionDefinition {
  const fallback = getFallbackInspectionByIdOrSlug(definition.id);
  const templateFallback = definition.templateInspectionId
    ? getFallbackInspectionByIdOrSlug(definition.templateInspectionId)
    : null;

  return {
    ...definition,
    shortName: fallback?.shortName ?? definition.shortName,
    href: fallback?.href ?? definition.href,
    category: fallback?.category ?? definition.category,
    equipmentLabel:
      definition.equipmentLabel ??
      fallback?.equipmentLabel ??
      templateFallback?.equipmentLabel,
    requiredSignerCount:
      definition.requiredSignerCount ??
      fallback?.requiredSignerCount ??
      null,
    equipmentChoices:
      fallback?.equipmentChoices ?? definition.equipmentChoices,
    fixedEquipmentRef:
      definition.fixedEquipmentRef ?? fallback?.fixedEquipmentRef ?? null,
    templateInspectionId:
      definition.templateInspectionId ??
      fallback?.templateInspectionId ??
      null,
    instructionNotes:
      definition.instructionNotes ??
      fallback?.instructionNotes ??
      templateFallback?.instructionNotes,
  };
}

export async function listManagedInspections(): Promise<ManagedInspection[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  try {
    return await listManagedInspectionsOnce();
  } catch (error) {
    if (!isMissingInspectionSchemaError(error)) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : "";
      if (code === "P2021") {
        return [];
      }
      throw error;
    }
    await ensureInspectionSchemaReady();
    return listManagedInspectionsOnce();
  }
}

async function listManagedInspectionsOnce(): Promise<ManagedInspection[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  const rows = await prisma.inspection.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      _count: {
        select: {
          questions: { where: { isActive: true } },
          unitForms: true,
        },
      },
      template: {
        include: {
          _count: {
            select: { questions: { where: { isActive: true } } },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const inheritsQuestions = Boolean(row.templateInspectionId);
    const questionCount = inheritsQuestions
      ? (row.template?._count.questions ?? 0)
      : row._count.questions;

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      category: row.category,
      href: row.href,
      equipmentLabel: row.equipmentLabel,
      requiredSignerCount: row.requiredSignerCount ?? null,
      templateInspectionId: row.templateInspectionId,
      fixedEquipmentRef: row.fixedEquipmentRef,
      isAvailable: row.isAvailable,
      sortOrder: row.sortOrder,
      questionCount,
      version: row.version ?? 1,
      isQuestionSource: !inheritsQuestions && row._count.unitForms > 0,
    };
  });
}

export async function getManagedInspection(
  id: string,
): Promise<ManagedInspectionDetail | null> {
  try {
    return await getManagedInspectionOnce(id);
  } catch (error) {
    if (!isMissingInspectionSchemaError(error)) {
      throw error;
    }
    await ensureInspectionSchemaReady();
    return getManagedInspectionOnce(id);
  }
}

async function getManagedInspectionOnce(
  id: string,
): Promise<ManagedInspectionDetail | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  const row = await prisma.inspection.findUnique({
    where: { id },
    include: {
      questions: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      template: {
        include: {
          questions: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
          versions: {
            orderBy: { version: "desc" },
            include: {
              changedBy: {
                select: { name: true, email: true },
              },
            },
          },
          unitForms: {
            orderBy: { sortOrder: "asc" },
            select: {
              fixedEquipmentRef: true,
              title: true,
            },
          },
        },
      },
      versions: {
        orderBy: { version: "desc" },
        include: {
          changedBy: {
            select: { name: true, email: true },
          },
        },
      },
      unitForms: {
        orderBy: { sortOrder: "asc" },
        select: {
          fixedEquipmentRef: true,
          title: true,
        },
      },
      _count: {
        select: { unitForms: true },
      },
    },
  });

  if (!row) {
    return null;
  }

  const inheritsQuestions = Boolean(row.templateInspectionId && row.template);
  const questionRows = inheritsQuestions
    ? row.template!.questions
    : row.questions;
  const versionRows = inheritsQuestions ? row.template!.versions : row.versions;
  const versionNumber = inheritsQuestions
    ? (row.template!.version ?? 1)
    : (row.version ?? 1);

  // Only backfill version 1 when this question-source inspection has no history yet.
  if (!inheritsQuestions && versionRows.length === 0) {
    await ensureBaselineInspectionVersion(row.id);
    return getManagedInspectionOnce(id);
  }

  const liveQuestions = questionRows.map(mapQuestion);
  const latestPublished = versionRows[0]
    ? parseVersionSnapshot(versionRows[0].snapshot)
    : null;
  const hasUnpublishedChanges =
    !inheritsQuestions &&
    (latestPublished
      ? checklistQuestionsDiffer(liveQuestions, latestPublished.questions)
      : liveQuestions.length > 0);

  const definition = mergeStaticDefinitionMeta(
    mapDefinition({
      ...row,
      questions: questionRows,
    }),
  );

  if (inheritsQuestions && definition.fixedEquipmentRef) {
    definition.questions = filterQuestionsForEquipment(
      definition.questions,
      definition.fixedEquipmentRef,
    );
  }

  const unitSource = inheritsQuestions ? row.template?.unitForms : row.unitForms;
  const unitOptions = (unitSource ?? [])
    .map((unit) => {
      const value = unit.fixedEquipmentRef?.trim();
      if (!value) {
        return null;
      }
      return {
        value,
        label: unit.title.includes(value) ? unit.title : `${value} — ${unit.title}`,
      };
    })
    .filter((unit): unit is { value: string; label: string } => Boolean(unit));

  return {
    ...definition,
    version: versionNumber,
    versions: versionRows.map((version) => mapVersionHistoryItem(version)),
    hasUnpublishedChanges,
    questionSourceId: inheritsQuestions ? row.templateInspectionId : row.id,
    questionSourceTitle: inheritsQuestions
      ? (row.template?.title ?? null)
      : row.title,
    inheritsQuestions,
    unitFormCount: row._count.unitForms,
    unitOptions,
  };
}

function parseVersionSnapshot(value: unknown): InspectionVersionSnapshot {
  const snapshot = (value ?? {}) as Partial<InspectionVersionSnapshot>;
  const questions = Array.isArray(snapshot.questions)
    ? snapshot.questions.map((question) => {
        const row = question as Partial<InspectionQuestionDef>;
        const type: InspectionQuestionType = isKnownQuestionType(row.type)
          ? row.type
          : "TEXT";
        const options = Array.isArray(row.options)
          ? row.options.map(String)
          : [];
        return {
          id: String(row.id ?? ""),
          label: String(row.label ?? ""),
          helpText: row.helpText ? String(row.helpText) : null,
          sectionTitle: row.sectionTitle ? String(row.sectionTitle) : null,
          type,
          options,
          attentionValues: Array.isArray(row.attentionValues)
            ? row.attentionValues.map(String)
            : [],
          required: Boolean(row.required ?? true),
          showLastValue: Boolean(row.showLastValue),
          applicableEquipmentRefs: Array.isArray(row.applicableEquipmentRefs)
            ? row.applicableEquipmentRefs.map(String)
            : [],
          applicableShifts: Array.isArray(row.applicableShifts)
            ? row.applicableShifts.map(String)
            : [],
          firstOfWeekOnly: row.firstOfWeekOnly === true,
          permitFieldRole:
            parsePermitFieldRole(row.permitFieldRole) ??
            inferPermitFieldRoleFromId(String(row.id ?? "")),
          sortOrder: Number(row.sortOrder ?? 0),
        } satisfies InspectionQuestionDef;
      })
    : [];

  return {
    title: String(snapshot.title ?? ""),
    description: String(snapshot.description ?? ""),
    category: String(snapshot.category ?? ""),
    equipmentLabel: snapshot.equipmentLabel
      ? String(snapshot.equipmentLabel)
      : null,
    questions,
  };
}

function mapVersionHistoryItem(row: {
  id: string;
  version: number;
  changeComment: string;
  createdAt: Date;
  snapshot: unknown;
  changedBy: { name: string | null; email: string } | null;
}): InspectionVersionHistoryItem {
  const snapshot = parseVersionSnapshot(row.snapshot);
  return {
    id: row.id,
    version: row.version,
    changeComment: row.changeComment,
    createdAt: row.createdAt,
    changedByName: row.changedBy?.name ?? null,
    changedByEmail: row.changedBy?.email ?? null,
    questionCount: snapshot.questions.length,
    snapshot,
  };
}

/** Stable shape for comparing live questions to a published snapshot. */
function normalizeQuestionsForCompare(questions: InspectionQuestionDef[]) {
  return questions.map((question) => {
    const options = questionOptionsForType(question.type, question.options);
    const attentionValues =
      question.attentionValues.length > 0
        ? question.attentionValues
        : question.type === "YES_NO"
          ? defaultAttentionValues(question.type, options)
          : [];
    return {
      id: question.id,
      label: question.label,
      helpText: question.helpText ?? null,
      sectionTitle: question.sectionTitle ?? null,
      type: question.type,
      options,
      attentionValues,
      required: question.required,
      showLastValue: question.showLastValue,
      applicableEquipmentRefs: [...question.applicableEquipmentRefs].sort(),
      applicableShifts: [...question.applicableShifts].sort(),
      firstOfWeekOnly: question.firstOfWeekOnly,
      permitFieldRole: question.permitFieldRole ?? null,
      sortOrder: question.sortOrder,
    };
  });
}

function checklistQuestionsDiffer(
  left: InspectionQuestionDef[],
  right: InspectionQuestionDef[],
): boolean {
  return (
    JSON.stringify(normalizeQuestionsForCompare(left)) !==
    JSON.stringify(normalizeQuestionsForCompare(right))
  );
}

async function buildInspectionSnapshot(
  inspectionId: string,
): Promise<InspectionVersionSnapshot> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const row = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: {
      questions: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!row) {
    throw new Error("Inspection not found.");
  }

  return {
    title: row.title,
    description: row.description,
    category: row.category,
    equipmentLabel: row.equipmentLabel,
    questions: row.questions.map(mapQuestion),
  };
}

/** Create version 1 history when an inspection has none yet. */
export async function ensureBaselineInspectionVersion(
  inspectionId: string,
  changeComment = "Initial version",
): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    return;
  }

  const existing = await prisma.inspectionVersion.count({
    where: { inspectionId },
  });
  if (existing > 0) {
    return;
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    select: { version: true },
  });
  if (!inspection) {
    return;
  }

  const snapshot = await buildInspectionSnapshot(inspectionId);
  const version = inspection.version > 0 ? inspection.version : 1;

  await prisma.$transaction([
    prisma.inspection.update({
      where: { id: inspectionId },
      data: { version },
    }),
    prisma.inspectionVersion.create({
      data: {
        inspectionId,
        version,
        changeComment,
        changedById: null,
        snapshot,
      },
    }),
  ]);
}

async function bumpInspectionVersion(args: {
  inspectionId: string;
  changeComment: string;
  changedById: string;
}): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const changeComment = args.changeComment.trim();
  if (!changeComment) {
    throw new Error(
      "A change comment is required when publishing a checklist revision.",
    );
  }

  await ensureBaselineInspectionVersion(args.inspectionId);

  return prisma.$transaction(async (tx) => {
    const inspection = await tx.inspection.findUnique({
      where: { id: args.inspectionId },
      select: {
        id: true,
        version: true,
        title: true,
        description: true,
        category: true,
        equipmentLabel: true,
      },
    });
    if (!inspection) {
      throw new Error("Inspection not found.");
    }

    const questions = await tx.inspectionQuestion.findMany({
      where: { inspectionId: args.inspectionId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    const nextVersion = (inspection.version ?? 1) + 1;
    const snapshot: InspectionVersionSnapshot = {
      title: inspection.title,
      description: inspection.description,
      category: inspection.category,
      equipmentLabel: inspection.equipmentLabel,
      questions: questions.map(mapQuestion),
    };

    await tx.inspection.update({
      where: { id: args.inspectionId },
      data: { version: nextVersion },
    });

    await tx.inspectionVersion.create({
      data: {
        inspectionId: args.inspectionId,
        version: nextVersion,
        changeComment,
        changedById: args.changedById,
        snapshot,
      },
    });

    return nextVersion;
  });
}

function requireChangeComment(changeComment: string | undefined): string {
  const comment = changeComment?.trim() ?? "";
  if (!comment) {
    throw new Error(
      "A change comment is required when publishing a checklist revision.",
    );
  }
  return comment;
}

/**
 * Publish the current live checklist as the next form revision.
 * Question edits apply immediately but do not bump the version until this runs.
 */
export async function publishInspectionVersion(args: {
  inspectionId: string;
  changeComment: string;
  changedById: string;
}): Promise<number> {
  await assertQuestionSourceInspection(args.inspectionId);
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const changeComment = requireChangeComment(args.changeComment);
  await ensureBaselineInspectionVersion(args.inspectionId);

  const latest = await prisma.inspectionVersion.findFirst({
    where: { inspectionId: args.inspectionId },
    orderBy: { version: "desc" },
    select: { snapshot: true },
  });
  const liveSnapshot = await buildInspectionSnapshot(args.inspectionId);
  if (
    latest &&
    !checklistQuestionsDiffer(
      liveSnapshot.questions,
      parseVersionSnapshot(latest.snapshot).questions,
    )
  ) {
    throw new Error("No unpublished checklist changes to publish.");
  }

  return bumpInspectionVersion({
    inspectionId: args.inspectionId,
    changeComment,
    changedById: args.changedById,
  });
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const prisma = getPrisma();
  if (!prisma) {
    return base;
  }

  let candidate = base;
  let suffix = 2;
  while (true) {
    const existing = await prisma.inspection.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

/** Upsert built-in forklift / start-up / shut-down definitions after migrations. */
export async function seedDefaultInspections(): Promise<number> {
  const { ensureInspectionSchema } = await import("~/lib/migrate.server");
  await ensureInspectionSchema();

  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  // Seed templates before unit forms that reference them.
  const ordered = [...INSPECTION_DEFINITIONS].sort((a, b) => {
    const aChild = a.templateInspectionId ? 1 : 0;
    const bChild = b.templateInspectionId ? 1 : 0;
    return aChild - bChild || a.sortOrder - b.sortOrder;
  });

  for (const inspection of ordered) {
    await prisma.inspection.upsert({
      where: { id: inspection.id },
      update: {
        title: inspection.title,
        description: inspection.description,
        category: inspection.category,
        href: inspection.href,
        equipmentLabel: inspection.equipmentLabel ?? null,
        requiredSignerCount: inspection.requiredSignerCount ?? null,
        templateInspectionId: inspection.templateInspectionId ?? null,
        fixedEquipmentRef: inspection.fixedEquipmentRef ?? null,
        isAvailable: inspection.isAvailable,
        sortOrder: inspection.sortOrder,
      },
      create: {
        id: inspection.id,
        slug: inspection.slug,
        title: inspection.title,
        description: inspection.description,
        category: inspection.category,
        href: inspection.href,
        equipmentLabel: inspection.equipmentLabel ?? null,
        requiredSignerCount: inspection.requiredSignerCount ?? null,
        templateInspectionId: inspection.templateInspectionId ?? null,
        fixedEquipmentRef: inspection.fixedEquipmentRef ?? null,
        isAvailable: inspection.isAvailable,
        sortOrder: inspection.sortOrder,
        version: 1,
      },
    });

    // Unit forms inherit questions — only seed questions on the source inspection.
    if (inspection.templateInspectionId) {
      continue;
    }

    for (const question of inspection.questions) {
      await prisma.inspectionQuestion.upsert({
        where: { id: question.id },
        update: {
          inspectionId: inspection.id,
          label: question.label,
          helpText: question.helpText ?? null,
          sectionTitle: question.sectionTitle ?? null,
          type: question.type,
          options:
            optionsJsonForType(question.type, question.options),
          attentionValues: question.attentionValues,
          required: question.required,
          showLastValue: question.showLastValue,
          applicableEquipmentRefs:
            question.applicableEquipmentRefs.length > 0
              ? question.applicableEquipmentRefs
              : Prisma.DbNull,
          applicableShifts:
            question.applicableShifts.length > 0
              ? question.applicableShifts
              : Prisma.DbNull,
          firstOfWeekOnly: question.firstOfWeekOnly,
          permitFieldRole: question.permitFieldRole ?? null,
          isActive: true,
          sortOrder: question.sortOrder,
        },
        create: {
          id: question.id,
          inspectionId: inspection.id,
          label: question.label,
          helpText: question.helpText ?? null,
          sectionTitle: question.sectionTitle ?? null,
          type: question.type,
          options:
            optionsJsonForType(question.type, question.options),
          attentionValues: question.attentionValues,
          required: question.required,
          showLastValue: question.showLastValue,
          applicableEquipmentRefs:
            question.applicableEquipmentRefs.length > 0
              ? question.applicableEquipmentRefs
              : Prisma.DbNull,
          applicableShifts:
            question.applicableShifts.length > 0
              ? question.applicableShifts
              : Prisma.DbNull,
          firstOfWeekOnly: question.firstOfWeekOnly,
          permitFieldRole: question.permitFieldRole ?? null,
          isActive: true,
          sortOrder: question.sortOrder,
        },
      });
    }

    const questionIds = inspection.questions.map((question) => question.id);
    if (questionIds.length > 0) {
      await prisma.inspectionQuestion.updateMany({
        where: {
          inspectionId: inspection.id,
          isActive: true,
          id: { notIn: questionIds },
        },
        data: { isActive: false },
      });
    }

    await ensureBaselineInspectionVersion(
      inspection.id,
      "Loaded default inspection",
    );
  }

  return INSPECTION_DEFINITIONS.length;
}

export async function createManagedInspection(args: {
  title: string;
  description?: string;
  category?: string;
  equipmentLabel?: string;
  requiredSignerCount?: number | null;
}): Promise<ManagedInspection> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const title = args.title.trim();
  if (!title) {
    throw new Error("Title is required.");
  }

  const baseSlug = slugifyInspectionTitle(title);
  const slug = await uniqueSlug(baseSlug);
  const maxSort = await prisma.inspection.aggregate({
    _max: { sortOrder: true },
  });

  const category = args.category?.trim() || "General";
  const isPermit = category.toLowerCase() === "permits";
  const requiredSignerCount = isPermit
    ? clampRequiredSignerCount(args.requiredSignerCount ?? 2)
    : null;

  const row = await prisma.inspection.create({
    data: {
      slug,
      title,
      description: args.description?.trim() || "",
      category,
      href: isPermit ? `/permits/${slug}` : `/inspections/${slug}`,
      equipmentLabel: args.equipmentLabel?.trim() || null,
      requiredSignerCount,
      isAvailable: true,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      version: 1,
    },
  });

  await ensureBaselineInspectionVersion(row.id, "Created inspection");

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    href: row.href,
    equipmentLabel: row.equipmentLabel,
    requiredSignerCount: row.requiredSignerCount ?? null,
    templateInspectionId: null,
    fixedEquipmentRef: null,
    isAvailable: row.isAvailable,
    sortOrder: row.sortOrder,
    questionCount: 0,
    version: row.version ?? 1,
    isQuestionSource: false,
  };
}

export async function updateManagedInspection(args: {
  id: string;
  title: string;
  description: string;
  category: string;
  equipmentLabel: string;
  isAvailable: boolean;
  requiredSignerCount?: number | null;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const title = args.title.trim();
  if (!title) {
    throw new Error("Title is required.");
  }

  const existing = await prisma.inspection.findUnique({
    where: { id: args.id },
    select: { slug: true, category: true },
  });
  if (!existing) {
    throw new Error("Inspection not found.");
  }

  const category = args.category.trim() || "General";
  const isPermit = category.toLowerCase() === "permits";
  const requiredSignerCount = isPermit
    ? clampRequiredSignerCount(args.requiredSignerCount ?? 2)
    : null;

  await prisma.inspection.update({
    where: { id: args.id },
    data: {
      title,
      description: args.description.trim(),
      category,
      href: isPermit
        ? `/permits/${existing.slug}`
        : `/inspections/${existing.slug}`,
      equipmentLabel: args.equipmentLabel.trim() || null,
      requiredSignerCount,
      isAvailable: args.isAvailable,
    },
  });
}

export async function setInspectionAvailability(
  id: string,
  isAvailable: boolean,
): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const updated = await prisma.inspection.updateMany({
    where: { id },
    data: { isAvailable },
  });
  if (updated.count === 0) {
    throw new Error("Inspection not found.");
  }
}

async function assertQuestionSourceInspection(
  inspectionId: string,
): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }
  const row = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    select: { templateInspectionId: true, title: true },
  });
  if (!row) {
    throw new Error("Inspection not found.");
  }
  if (row.templateInspectionId) {
    throw new Error(
      "This form inherits questions from a master template. Edit the template to change questions for all unit forms.",
    );
  }
}

async function clearConflictingPermitFieldRoles(args: {
  inspectionId: string;
  role: PermitFieldRole;
  exceptQuestionId?: string;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }
  await prisma.inspectionQuestion.updateMany({
    where: {
      inspectionId: args.inspectionId,
      isActive: true,
      permitFieldRole: args.role,
      ...(args.exceptQuestionId
        ? { id: { not: args.exceptQuestionId } }
        : {}),
    },
    data: { permitFieldRole: null },
  });
}

export async function addInspectionQuestion(args: {
  inspectionId: string;
  label: string;
  helpText?: string;
  sectionTitle?: string;
  type: InspectionQuestionType;
  options?: string[];
  attentionValues?: string[];
  required?: boolean;
  showLastValue?: boolean;
  applicableEquipmentRefs?: string[];
  applicableShifts?: string[];
  firstOfWeekOnly?: boolean;
  permitFieldRole?: PermitFieldRole | null;
}): Promise<InspectionQuestionDef> {
  await assertQuestionSourceInspection(args.inspectionId);
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const label = args.label.trim();
  if (!label) {
    throw new Error("Question label is required.");
  }

  const options = questionOptionsForType(args.type, args.options ?? []);
  if (questionTypeStoresOptions(args.type) && options.length < 2) {
    throw new Error(
      args.type === "CHECKBOX"
        ? "Checkbox questions need at least two options."
        : "Radio questions need at least two options.",
    );
  }

  const attentionValues =
    args.attentionValues?.filter((value) => options.includes(value) || args.type === "YES_NO") ??
    defaultAttentionValues(args.type, options);

  const normalizedAttention =
    args.type === "TEXT" || args.type === "NUMBER" || args.type === "DATE" || args.type === "TIME"
      ? []
      : attentionValues.filter((value) =>
          args.type === "YES_NO"
            ? YES_NO_INCLUDES(value)
            : options.includes(value),
        );

  const permitFieldRole = parsePermitFieldRole(args.permitFieldRole);
  if (permitFieldRole === "start_time" || permitFieldRole === "end_time") {
    if (args.type !== "TIME") {
      throw new Error("Start and end time fields must use the Time answer type.");
    }
  }
  if (permitFieldRole === "area" && args.type !== "TEXT") {
    throw new Error("Area fields must use the Text answer type.");
  }

  const maxSort = await prisma.inspectionQuestion.aggregate({
    where: { inspectionId: args.inspectionId, isActive: true },
    _max: { sortOrder: true },
  });

  if (permitFieldRole) {
    await clearConflictingPermitFieldRoles({
      inspectionId: args.inspectionId,
      role: permitFieldRole,
    });
  }

  const row = await prisma.inspectionQuestion.create({
    data: {
      inspectionId: args.inspectionId,
      label,
      helpText: args.helpText?.trim() || null,
      sectionTitle: args.sectionTitle?.trim() || null,
      type: args.type,
      options: optionsJsonForType(args.type, options),
      attentionValues: attentionJsonForType(args.type, normalizedAttention),
      required: args.required ?? true,
      showLastValue: args.showLastValue ?? false,
      applicableEquipmentRefs:
        (args.applicableEquipmentRefs ?? []).length > 0
          ? args.applicableEquipmentRefs
          : Prisma.DbNull,
      applicableShifts:
        (args.applicableShifts ?? []).length > 0
          ? args.applicableShifts
          : Prisma.DbNull,
      firstOfWeekOnly: args.firstOfWeekOnly ?? false,
      permitFieldRole,
      isActive: true,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  return mapQuestion(row);
}

function YES_NO_INCLUDES(value: string) {
  return value === "Yes" || value === "No";
}

export async function removeInspectionQuestion(args: {
  questionId: string;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const existing = await prisma.inspectionQuestion.findFirst({
    where: { id: args.questionId, isActive: true },
    select: { inspectionId: true },
  });
  if (!existing) {
    throw new Error("Question not found.");
  }
  await assertQuestionSourceInspection(existing.inspectionId);

  const updated = await prisma.inspectionQuestion.updateMany({
    where: { id: args.questionId, isActive: true },
    data: { isActive: false },
  });
  if (updated.count === 0) {
    throw new Error("Question not found.");
  }
}

export async function updateInspectionQuestion(args: {
  questionId: string;
  label: string;
  helpText?: string;
  sectionTitle?: string;
  type: InspectionQuestionType;
  options?: string[];
  attentionValues?: string[];
  required?: boolean;
  showLastValue?: boolean;
  applicableEquipmentRefs?: string[];
  applicableShifts?: string[];
  firstOfWeekOnly?: boolean;
  permitFieldRole?: PermitFieldRole | null;
}): Promise<InspectionQuestionDef> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const label = args.label.trim();
  if (!label) {
    throw new Error("Question label is required.");
  }

  const existing = await prisma.inspectionQuestion.findFirst({
    where: { id: args.questionId, isActive: true },
    select: { id: true, inspectionId: true },
  });
  if (!existing) {
    throw new Error("Question not found.");
  }
  await assertQuestionSourceInspection(existing.inspectionId);

  const options = questionOptionsForType(args.type, args.options ?? []);
  if (questionTypeStoresOptions(args.type) && options.length < 2) {
    throw new Error(
      args.type === "CHECKBOX"
        ? "Checkbox questions need at least two options."
        : "Radio questions need at least two options.",
    );
  }

  const attentionValues =
    args.attentionValues?.filter(Boolean) ??
    defaultAttentionValues(args.type, options);

  const normalizedAttention =
    args.type === "TEXT" || args.type === "NUMBER" || args.type === "DATE" || args.type === "TIME"
      ? []
      : attentionValues.filter((value) =>
          args.type === "YES_NO"
            ? YES_NO_INCLUDES(value)
            : options.includes(value),
        );

  const permitFieldRole = parsePermitFieldRole(args.permitFieldRole);
  if (permitFieldRole === "start_time" || permitFieldRole === "end_time") {
    if (args.type !== "TIME") {
      throw new Error("Start and end time fields must use the Time answer type.");
    }
  }
  if (permitFieldRole === "area" && args.type !== "TEXT") {
    throw new Error("Area fields must use the Text answer type.");
  }

  if (permitFieldRole) {
    await clearConflictingPermitFieldRoles({
      inspectionId: existing.inspectionId,
      role: permitFieldRole,
      exceptQuestionId: existing.id,
    });
  }

  const row = await prisma.inspectionQuestion.update({
    where: { id: args.questionId },
    data: {
      label,
      helpText: args.helpText?.trim() || null,
      sectionTitle: args.sectionTitle?.trim() || null,
      type: args.type,
      options: optionsJsonForType(args.type, options),
      attentionValues: attentionJsonForType(args.type, normalizedAttention),
      required: args.required ?? true,
      showLastValue: args.showLastValue ?? false,
      applicableEquipmentRefs:
        (args.applicableEquipmentRefs ?? []).length > 0
          ? args.applicableEquipmentRefs
          : Prisma.DbNull,
      applicableShifts:
        (args.applicableShifts ?? []).length > 0
          ? args.applicableShifts
          : Prisma.DbNull,
      firstOfWeekOnly: args.firstOfWeekOnly ?? false,
      permitFieldRole,
    },
  });

  return mapQuestion(row);
}

export async function moveInspectionQuestion(args: {
  questionId: string;
  direction: "up" | "down";
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const current = await prisma.inspectionQuestion.findFirst({
    where: { id: args.questionId, isActive: true },
    select: { id: true, inspectionId: true, sortOrder: true },
  });
  if (!current) {
    throw new Error("Question not found.");
  }
  await assertQuestionSourceInspection(current.inspectionId);

  const neighbor = await prisma.inspectionQuestion.findFirst({
    where: {
      inspectionId: current.inspectionId,
      isActive: true,
      sortOrder:
        args.direction === "up"
          ? { lt: current.sortOrder }
          : { gt: current.sortOrder },
    },
    orderBy: {
      sortOrder: args.direction === "up" ? "desc" : "asc",
    },
    select: { id: true, sortOrder: true },
  });

  if (!neighbor) {
    return;
  }

  await prisma.$transaction([
    prisma.inspectionQuestion.update({
      where: { id: current.id },
      data: { sortOrder: neighbor.sortOrder },
    }),
    prisma.inspectionQuestion.update({
      where: { id: neighbor.id },
      data: { sortOrder: current.sortOrder },
    }),
  ]);
}

export async function createInspectionRun(args: {
  inspectionId: string;
  operatorUserId: string;
  submittedById: string;
  equipmentRef: string | null;
  notes: string | null;
  signature?: string | null;
  answers: InspectionAnswerRecord[];
  summary: InspectionSummary;
}): Promise<{ id: string } | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  const inspection = await prisma.inspection.findUnique({
    where: { id: args.inspectionId },
    select: {
      version: true,
      templateInspectionId: true,
      template: { select: { version: true } },
    },
  });

  const inspectionVersion =
    inspection?.template?.version ?? inspection?.version ?? null;

  return prisma.inspectionRun.create({
    data: {
      inspectionId: args.inspectionId,
      operatorUserId: args.operatorUserId,
      submittedById: args.submittedById,
      status: args.summary.status,
      equipmentRef: args.equipmentRef,
      notes: args.notes,
      signature: args.signature ?? null,
      responses: args.answers,
      summary: args.summary,
      inspectionVersion,
    },
    select: { id: true },
  });
}

function parseSummary(value: unknown): InspectionSummary {
  const summary = (value ?? {}) as Partial<InspectionSummary>;
  return {
    answeredCount: Number(
      summary.answeredCount ?? summary.totalChecked ?? summary.okCount ?? 0,
    ),
    attentionCount: Number(summary.attentionCount ?? 0),
    okCount: summary.okCount,
    naCount: summary.naCount,
    totalChecked: summary.totalChecked,
    status: summary.status === "NEEDS_ATTENTION" ? "NEEDS_ATTENTION" : "PASSED",
    attentionItems: Array.isArray(summary.attentionItems)
      ? summary.attentionItems.map((item) => ({
          itemId: String(item.itemId ?? ""),
          label: String(item.label ?? ""),
          sectionTitle: String(item.sectionTitle ?? ""),
          answer: item.answer ? String(item.answer) : undefined,
        }))
      : [],
  };
}

function parseAnswers(value: unknown): InspectionAnswerRecord[] {
  if (Array.isArray(value)) {
    return value.map((item) => {
      const row = item as Partial<InspectionAnswerRecord>;
      return {
        questionId: String(row.questionId ?? ""),
        label: String(row.label ?? ""),
        sectionTitle: row.sectionTitle ? String(row.sectionTitle) : null,
        type: isKnownQuestionType(row.type) ? row.type : "TEXT",
        answer: String(row.answer ?? ""),
        flagged: Boolean(row.flagged),
      };
    });
  }

  // Legacy map of questionId -> ok|attention|na
  if (value && typeof value === "object") {
    return Object.entries(value).map(([questionId, result]) => {
      const answer =
        result === "ok"
          ? "OK"
          : result === "attention"
            ? "Needs attention"
            : result === "na"
              ? "N/A"
              : String(result ?? "");
      return {
        questionId,
        label: questionId,
        sectionTitle: null,
        type: "RADIO" as const,
        answer,
        flagged: result === "attention" || answer === "Needs attention" || answer === "No",
      };
    });
  }

  return [];
}

export async function listInspectionHistory(
  options: {
    limit?: number;
    /** Melbourne civil date YYYY-MM-DD. */
    date?: string | null;
    sort?: InspectionHistorySort | string | null;
  } = {},
): Promise<InspectionHistoryItem[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  const limit = options.limit ?? 50;
  const sort = parseInspectionHistorySort(options.sort ?? null);
  const bounds = options.date ? melbourneDayBounds(options.date) : null;

  const rows = await prisma.inspectionRun.findMany({
    where: {
      inspection: {
        NOT: {
          category: {
            equals: "Permits",
            mode: "insensitive",
          },
        },
      },
      ...(bounds
        ? {
            createdAt: {
              gte: bounds.start,
              lt: bounds.end,
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      createdAt: true,
      equipmentRef: true,
      notes: true,
      summary: true,
      inspection: { select: { id: true, title: true, href: true } },
      operatorUser: { select: { name: true, email: true } },
      _count: { select: { actions: true } },
    },
  });

  const items = rows.map((row) => {
    const summary = parseSummary(row.summary);
    return {
      id: row.id,
      status: row.status,
      createdAt: row.createdAt,
      inspectionTitle: row.inspection.title,
      inspectionHref: row.inspection.href,
      inspectionId: row.inspection.id,
      operatorName:
        row.operatorUser?.name?.trim() || row.operatorUser?.email || null,
      equipmentRef: row.equipmentRef,
      notes: row.notes,
      signature: null,
      summary,
      actionCount: row._count.actions,
      // Full answers are loaded on the submission detail page only.
      answers: [] as InspectionAnswerRecord[],
      responseRows: [] as InspectionResponseRow[],
      actions: [] as InspectionActionItem[],
    };
  });

  return sortInspectionHistoryItems(items, sort);
}

/**
 * Per-unit forklift check status for a Melbourne civil day.
 * Used by the home dashboard and records quick view.
 */
export async function listForkliftChecksForDay(
  dateYmd: string,
): Promise<ForkliftDayDashboard> {
  const empty: ForkliftDayDashboard = {
    date: dateYmd,
    units: FORKLIFT_UNITS.map((unit) => ({
      value: unit.value,
      label: unit.label,
      checked: false,
      runCount: 0,
      latest: null,
    })),
    checkedCount: 0,
    totalUnits: FORKLIFT_UNITS.length,
    needsAttentionCount: 0,
    actionsRaisedCount: 0,
  };

  const prisma = getPrisma();
  const bounds = melbourneDayBounds(dateYmd);
  if (!prisma || !bounds) {
    return empty;
  }

  const unitValues = FORKLIFT_UNITS.map((unit) => unit.value);

  const rows = await prisma.inspectionRun.findMany({
    where: {
      equipmentRef: { in: [...unitValues] },
      createdAt: {
        gte: bounds.start,
        lt: bounds.end,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      equipmentRef: true,
      summary: true,
      operatorUser: { select: { name: true, email: true } },
      _count: { select: { actions: true } },
    },
  });

  const byUnit = new Map<
    string,
    Array<{
      id: string;
      status: InspectionRunStatus;
      createdAt: Date;
      operatorName: string | null;
      attentionCount: number;
      actionCount: number;
    }>
  >();

  for (const row of rows) {
    const ref = row.equipmentRef?.trim();
    if (!ref) {
      continue;
    }
    const summary = parseSummary(row.summary);
    const list = byUnit.get(ref) ?? [];
    list.push({
      id: row.id,
      status: row.status,
      createdAt: row.createdAt,
      operatorName:
        row.operatorUser?.name?.trim() || row.operatorUser?.email || null,
      attentionCount: summary.attentionCount,
      actionCount: row._count.actions,
    });
    byUnit.set(ref, list);
  }

  let checkedCount = 0;
  let needsAttentionCount = 0;
  let actionsRaisedCount = 0;

  const units: ForkliftDayUnitStatus[] = FORKLIFT_UNITS.map((unit) => {
    const runs = byUnit.get(unit.value) ?? [];
    const latest = runs[0] ?? null;
    if (runs.length > 0) {
      checkedCount += 1;
    }
    for (const run of runs) {
      if (run.status === "NEEDS_ATTENTION") {
        needsAttentionCount += 1;
      }
      actionsRaisedCount += run.actionCount;
    }
    return {
      value: unit.value,
      label: unit.label,
      checked: runs.length > 0,
      runCount: runs.length,
      latest,
    };
  });

  return {
    date: dateYmd,
    units,
    checkedCount,
    totalUnits: FORKLIFT_UNITS.length,
    needsAttentionCount,
    actionsRaisedCount,
  };
}

/**
 * Latest submitted answers for an inspection, optionally scoped to a unit.
 * Used so operators can view/adopt values like service date from the prior report.
 * For unit forms that inherit a template, also falls back to legacy runs on the
 * template inspection with a matching equipmentRef.
 */
export async function getLastAnswersForInspection(args: {
  inspectionId: string;
  equipmentRef?: string | null;
}): Promise<LastInspectionAnswers> {
  const prisma = getPrisma();
  if (!prisma) {
    return { answers: {}, runId: null, createdAt: null };
  }

  const equipmentRef = args.equipmentRef?.trim() || null;

  const inspection = await prisma.inspection.findUnique({
    where: { id: args.inspectionId },
    select: {
      id: true,
      templateInspectionId: true,
      fixedEquipmentRef: true,
    },
  });

  const effectiveEquipmentRef =
    equipmentRef || inspection?.fixedEquipmentRef?.trim() || null;

  const row = await prisma.inspectionRun.findFirst({
    where: {
      inspectionId: args.inspectionId,
      ...(effectiveEquipmentRef ? { equipmentRef: effectiveEquipmentRef } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      responses: true,
    },
  });

  if (row) {
    return {
      answers: buildLastAnswerMap(parseAnswers(row.responses)),
      runId: row.id,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // Fall back to legacy combined-form runs on the master template.
  if (inspection?.templateInspectionId && effectiveEquipmentRef) {
    const legacy = await prisma.inspectionRun.findFirst({
      where: {
        inspectionId: inspection.templateInspectionId,
        equipmentRef: effectiveEquipmentRef,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        responses: true,
      },
    });
    if (legacy) {
      return {
        answers: buildLastAnswerMap(parseAnswers(legacy.responses)),
        runId: legacy.id,
        createdAt: legacy.createdAt.toISOString(),
      };
    }
  }

  return { answers: {}, runId: null, createdAt: null };
}

/**
 * True when no prior run exists this calendar week (Mon–Sun, Melbourne) for
 * the inspection/unit. When `shift` is set, only runs that answered that shift
 * count — so Day-only weekly items still appear if only Afternoon ran earlier.
 */
export async function isFirstInspectionOfWeek(args: {
  inspectionId: string;
  equipmentRef?: string | null;
  shift?: string | null;
  at?: Date;
}): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma) {
    return true;
  }

  const weekStart = startOfMelbourneWeek(args.at ?? new Date());
  const equipmentRef = args.equipmentRef?.trim() || null;
  const shift = args.shift?.trim() || null;

  const inspection = await prisma.inspection.findUnique({
    where: { id: args.inspectionId },
    select: {
      id: true,
      templateInspectionId: true,
      fixedEquipmentRef: true,
    },
  });

  const effectiveEquipmentRef =
    equipmentRef || inspection?.fixedEquipmentRef?.trim() || null;

  const inspectionIds = [args.inspectionId];
  if (inspection?.templateInspectionId) {
    inspectionIds.push(inspection.templateInspectionId);
  }

  const rows = await prisma.inspectionRun.findMany({
    where: {
      inspectionId: { in: inspectionIds },
      createdAt: { gte: weekStart },
      ...(effectiveEquipmentRef
        ? { equipmentRef: effectiveEquipmentRef }
        : {}),
    },
    select: {
      responses: true,
      inspectionId: true,
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  if (rows.length === 0) {
    return true;
  }

  if (!shift) {
    // Without a shift filter we cannot decide Day-vs-Afternoon weekly items;
    // treat as first-of-week so callers that omit shift do not hide questions.
    return true;
  }

  // Resolve shift question from the unit form (or its template).
  const definition = await getInspectionDefinition(args.inspectionId);
  const shiftQuestion = definition
    ? findShiftQuestion(definition.questions)
    : null;
  if (!shiftQuestion) {
    return false;
  }

  for (const row of rows) {
    // Legacy template runs: only count when equipment matches (already filtered).
    const answers = parseAnswers(row.responses);
    const shiftAnswer = answers.find(
      (answer) => answer.questionId === shiftQuestion.id,
    )?.answer;
    if (String(shiftAnswer ?? "").trim() === shift) {
      return false;
    }
  }

  return true;
}

export async function getInspectionRunById(
  id: string,
): Promise<InspectionHistoryItem | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  const row = await prisma.inspectionRun.findUnique({
    where: { id },
    include: {
      inspection: { select: { id: true, title: true, href: true } },
      operatorUser: { select: { name: true, email: true } },
    },
  });

  if (!row) {
    return null;
  }

  const [answers, actionRows] = await Promise.all([
    Promise.resolve(parseAnswers(row.responses)),
    prisma.inspectionAction.findMany({
      where: { createdOnRunId: id },
      include: {
        createdOnRun: {
          select: {
            operatorUser: { select: { name: true, email: true } },
          },
        },
        closedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    inspectionTitle: row.inspection.title,
    inspectionHref: row.inspection.href,
    inspectionId: row.inspection.id,
    operatorName:
      row.operatorUser?.name?.trim() || row.operatorUser?.email || null,
    equipmentRef: row.equipmentRef,
    notes: row.notes,
    signature: row.signature ?? null,
    summary: parseSummary(row.summary),
    actionCount: actionRows.length,
    answers,
    responseRows: answers,
    actions: actionRows.map(mapInspectionAction),
  };
}

function mapInspectionAction(row: {
  id: string;
  description: string;
  status: InspectionActionStatus;
  equipmentRef: string | null;
  inspectionId: string;
  createdOnRunId: string;
  createdAt: Date;
  createdOnRun: {
    operatorUser: { name: string | null; email: string } | null;
  };
  closedAt: Date | null;
  closedBy: { name: string | null } | null;
  completionComment: string | null;
}): InspectionActionItem {
  return {
    id: row.id,
    description: row.description,
    status: row.status,
    equipmentRef: row.equipmentRef,
    inspectionId: row.inspectionId,
    createdOnRunId: row.createdOnRunId,
    createdAt: row.createdAt,
    createdByOperatorName:
      row.createdOnRun.operatorUser?.name?.trim() ||
      row.createdOnRun.operatorUser?.email ||
      null,
    closedAt: row.closedAt,
    closedByName: row.closedBy?.name ?? null,
    completionComment: row.completionComment,
  };
}

export async function listOpenInspectionActions(args: {
  inspectionId: string;
  equipmentRef?: string | null;
}): Promise<InspectionActionItem[]> {
  const { ensureInspectionSchema } = await import("~/lib/migrate.server");
  await ensureInspectionSchema();

  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  const equipmentRef = args.equipmentRef?.trim() || null;
  const inspection = await prisma.inspection.findUnique({
    where: { id: args.inspectionId },
    select: { fixedEquipmentRef: true },
  });
  const effectiveEquipmentRef =
    equipmentRef || inspection?.fixedEquipmentRef?.trim() || null;

  const rows = await prisma.inspectionAction.findMany({
    where: effectiveEquipmentRef
      ? {
          status: "OPEN",
          equipmentRef: effectiveEquipmentRef,
        }
      : {
          status: "OPEN",
          inspectionId: args.inspectionId,
          OR: [{ equipmentRef: null }, { equipmentRef: "" }],
        },
    include: {
      createdOnRun: {
        select: {
          operatorUser: { select: { name: true, email: true } },
        },
      },
      closedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map(mapInspectionAction);
}

export async function createInspectionActions(args: {
  createdOnRunId: string;
  inspectionId: string;
  equipmentRef?: string | null;
  descriptions: string[];
  createdByUserId?: string | null;
}): Promise<number> {
  const { ensureInspectionSchema } = await import("~/lib/migrate.server");
  await ensureInspectionSchema();

  const prisma = getPrisma();
  if (!prisma) {
    return 0;
  }

  const descriptions = args.descriptions
    .map((value) => value.trim())
    .filter(Boolean);
  if (descriptions.length === 0) {
    return 0;
  }

  await prisma.inspectionAction.createMany({
    data: descriptions.map((description) => ({
      createdOnRunId: args.createdOnRunId,
      inspectionId: args.inspectionId,
      equipmentRef: args.equipmentRef?.trim() || null,
      description,
      status: "OPEN",
      createdByUserId: args.createdByUserId ?? null,
    })),
  });

  return descriptions.length;
}

export async function closeInspectionAction(args: {
  actionId: string;
  closedByUserId: string;
  completionComment: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { ensureInspectionSchema } = await import("~/lib/migrate.server");
  await ensureInspectionSchema();

  const prisma = getPrisma();
  if (!prisma) {
    return { ok: false, error: "Database is not configured." };
  }

  const completionComment = args.completionComment.trim();
  if (!completionComment) {
    return {
      ok: false,
      error: "A completion comment is required to close an action.",
    };
  }

  const existing = await prisma.inspectionAction.findUnique({
    where: { id: args.actionId },
    select: { id: true, status: true },
  });
  if (!existing) {
    return { ok: false, error: "Action not found." };
  }
  if (existing.status === "CLOSED") {
    return { ok: false, error: "This action is already closed." };
  }

  await prisma.inspectionAction.update({
    where: { id: args.actionId },
    data: {
      status: "CLOSED",
      completionComment,
      closedAt: new Date(),
      closedById: args.closedByUserId,
    },
  });

  return { ok: true };
}

export async function ensureSeededInspectionQuestions(): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    return;
  }

  const ordered = [...INSPECTION_DEFINITIONS].sort((a, b) => {
    const aChild = a.templateInspectionId ? 1 : 0;
    const bChild = b.templateInspectionId ? 1 : 0;
    return aChild - bChild || a.sortOrder - b.sortOrder;
  });

  for (const definition of ordered) {
    await prisma.inspection.upsert({
      where: { id: definition.id },
      update: {
        title: definition.title,
        description: definition.description,
        category: definition.category,
        href: definition.href,
        equipmentLabel: definition.equipmentLabel ?? null,
        requiredSignerCount: definition.requiredSignerCount ?? null,
        templateInspectionId: definition.templateInspectionId ?? null,
        fixedEquipmentRef: definition.fixedEquipmentRef ?? null,
        isAvailable: definition.isAvailable,
        sortOrder: definition.sortOrder,
      },
      create: {
        id: definition.id,
        slug: definition.slug,
        title: definition.title,
        description: definition.description,
        category: definition.category,
        href: definition.href,
        equipmentLabel: definition.equipmentLabel ?? null,
        requiredSignerCount: definition.requiredSignerCount ?? null,
        templateInspectionId: definition.templateInspectionId ?? null,
        fixedEquipmentRef: definition.fixedEquipmentRef ?? null,
        isAvailable: definition.isAvailable,
        sortOrder: definition.sortOrder,
      },
    });

    if (definition.templateInspectionId) {
      continue;
    }

    for (const question of definition.questions) {
      await prisma.inspectionQuestion.upsert({
        where: { id: question.id },
        update: {
          label: question.label,
          helpText: question.helpText ?? null,
          sectionTitle: question.sectionTitle ?? null,
          type: question.type,
          options:
            optionsJsonForType(question.type, question.options),
          attentionValues: question.attentionValues,
          required: question.required,
          showLastValue: question.showLastValue,
          applicableEquipmentRefs:
            question.applicableEquipmentRefs.length > 0
              ? question.applicableEquipmentRefs
              : Prisma.DbNull,
          applicableShifts:
            question.applicableShifts.length > 0
              ? question.applicableShifts
              : Prisma.DbNull,
          firstOfWeekOnly: question.firstOfWeekOnly,
          permitFieldRole: question.permitFieldRole ?? null,
          isActive: true,
          sortOrder: question.sortOrder,
          inspectionId: definition.id,
        },
        create: {
          id: question.id,
          inspectionId: definition.id,
          label: question.label,
          helpText: question.helpText ?? null,
          sectionTitle: question.sectionTitle ?? null,
          type: question.type,
          options:
            optionsJsonForType(question.type, question.options),
          attentionValues: question.attentionValues,
          required: question.required,
          showLastValue: question.showLastValue,
          applicableEquipmentRefs:
            question.applicableEquipmentRefs.length > 0
              ? question.applicableEquipmentRefs
              : Prisma.DbNull,
          applicableShifts:
            question.applicableShifts.length > 0
              ? question.applicableShifts
              : Prisma.DbNull,
          firstOfWeekOnly: question.firstOfWeekOnly,
          permitFieldRole: question.permitFieldRole ?? null,
          isActive: true,
          sortOrder: question.sortOrder,
        },
      });
    }
  }
}

export {
  buildAnswersFromResponses,
  groupQuestionsBySection,
  summarizeInspectionAnswers,
};
