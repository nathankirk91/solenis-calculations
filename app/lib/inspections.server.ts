import { Prisma } from "../../generated/prisma/client";
import { getPrisma } from "~/lib/db.server";
import { startOfMelbourneWeek } from "~/lib/datetime";
import {
  FALLBACK_INSPECTIONS,
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
} from "~/lib/inspections";

export type InspectionRunStatus = "PASSED" | "NEEDS_ATTENTION";

export type ManagedInspection = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  href: string;
  equipmentLabel: string | null;
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
  answers: InspectionAnswerRecord[];
  responseRows: InspectionResponseRow[];
  actions: InspectionActionItem[];
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
  sortOrder: number;
}): InspectionQuestionDef {
  const options = questionOptionsForType(
    row.type,
    parseStringArray(row.options),
  );
  const attentionValues = parseStringArray(row.attentionValues);

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
    firstOfWeekOnly: Boolean(row.firstOfWeekOnly),
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
      inspections: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        category: row.category,
        href: row.href,
        isAvailable: row.isAvailable,
      })),
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
  } catch {
    return resolveFallbackDefinition(idOrSlug);
  }
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
    equipmentLabel:
      definition.equipmentLabel ??
      fallback?.equipmentLabel ??
      templateFallback?.equipmentLabel,
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
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code === "P2021") {
      return [];
    }
    // New template columns may be missing until embedded schema ensure runs.
    const message = error instanceof Error ? error.message : String(error);
    if (/template_inspection_id|fixed_equipment_ref|does not exist/i.test(message)) {
      const { ensureInspectionSchema } = await import("~/lib/migrate.server");
      await ensureInspectionSchema();
      return listManagedInspectionsOnce();
    }
    throw error;
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
    return getManagedInspection(id);
  }

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
        const type: InspectionQuestionType =
          row.type === "YES_NO" ||
          row.type === "TEXT" ||
          row.type === "RADIO" ||
          row.type === "NUMBER" ||
          row.type === "DATE"
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
          firstOfWeekOnly: Boolean(row.firstOfWeekOnly),
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
      "A change comment is required when questions are added, edited, removed, or reordered.",
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
      "A change comment is required when questions are added, edited, removed, or reordered.",
    );
  }
  return comment;
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
            question.type === "RADIO" ? question.options : Prisma.DbNull,
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
            question.type === "RADIO" ? question.options : Prisma.DbNull,
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

  const row = await prisma.inspection.create({
    data: {
      slug,
      title,
      description: args.description?.trim() || "",
      category: args.category?.trim() || "General",
      href: `/inspections/${slug}`,
      equipmentLabel: args.equipmentLabel?.trim() || null,
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
    select: { slug: true },
  });
  if (!existing) {
    throw new Error("Inspection not found.");
  }

  await prisma.inspection.update({
    where: { id: args.id },
    data: {
      title,
      description: args.description.trim(),
      category: args.category.trim() || "General",
      equipmentLabel: args.equipmentLabel.trim() || null,
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
  changeComment: string;
  changedById: string;
}): Promise<InspectionQuestionDef> {
  await assertQuestionSourceInspection(args.inspectionId);
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const changeComment = requireChangeComment(args.changeComment);
  const label = args.label.trim();
  if (!label) {
    throw new Error("Question label is required.");
  }

  const options = questionOptionsForType(args.type, args.options ?? []);
  if (args.type === "RADIO" && options.length < 2) {
    throw new Error("Radio questions need at least two options.");
  }

  const attentionValues =
    args.attentionValues?.filter((value) => options.includes(value) || args.type === "YES_NO") ??
    defaultAttentionValues(args.type, options);

  const normalizedAttention =
    args.type === "TEXT" || args.type === "NUMBER" || args.type === "DATE"
      ? []
      : attentionValues.filter((value) =>
          args.type === "YES_NO"
            ? YES_NO_INCLUDES(value)
            : options.includes(value),
        );

  const maxSort = await prisma.inspectionQuestion.aggregate({
    where: { inspectionId: args.inspectionId, isActive: true },
    _max: { sortOrder: true },
  });

  const row = await prisma.inspectionQuestion.create({
    data: {
      inspectionId: args.inspectionId,
      label,
      helpText: args.helpText?.trim() || null,
      sectionTitle: args.sectionTitle?.trim() || null,
      type: args.type,
      options: args.type === "RADIO" ? options : Prisma.DbNull,
      attentionValues:
        args.type === "TEXT" || args.type === "NUMBER" || args.type === "DATE"
          ? Prisma.DbNull
          : normalizedAttention,
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
      isActive: true,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  await bumpInspectionVersion({
    inspectionId: args.inspectionId,
    changeComment,
    changedById: args.changedById,
  });

  return mapQuestion(row);
}

function YES_NO_INCLUDES(value: string) {
  return value === "Yes" || value === "No";
}

export async function removeInspectionQuestion(args: {
  questionId: string;
  changeComment: string;
  changedById: string;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const changeComment = requireChangeComment(args.changeComment);

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

  await bumpInspectionVersion({
    inspectionId: existing.inspectionId,
    changeComment,
    changedById: args.changedById,
  });
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
  changeComment: string;
  changedById: string;
}): Promise<InspectionQuestionDef> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const changeComment = requireChangeComment(args.changeComment);
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
  if (args.type === "RADIO" && options.length < 2) {
    throw new Error("Radio questions need at least two options.");
  }

  const attentionValues =
    args.attentionValues?.filter(Boolean) ??
    defaultAttentionValues(args.type, options);

  const normalizedAttention =
    args.type === "TEXT" || args.type === "NUMBER" || args.type === "DATE"
      ? []
      : attentionValues.filter((value) =>
          args.type === "YES_NO"
            ? YES_NO_INCLUDES(value)
            : options.includes(value),
        );

  const row = await prisma.inspectionQuestion.update({
    where: { id: args.questionId },
    data: {
      label,
      helpText: args.helpText?.trim() || null,
      sectionTitle: args.sectionTitle?.trim() || null,
      type: args.type,
      options: args.type === "RADIO" ? options : Prisma.DbNull,
      attentionValues:
        args.type === "TEXT" || args.type === "NUMBER" || args.type === "DATE"
          ? Prisma.DbNull
          : normalizedAttention,
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
    },
  });

  await bumpInspectionVersion({
    inspectionId: existing.inspectionId,
    changeComment,
    changedById: args.changedById,
  });

  return mapQuestion(row);
}

export async function moveInspectionQuestion(args: {
  questionId: string;
  direction: "up" | "down";
  changeComment: string;
  changedById: string;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const changeComment = requireChangeComment(args.changeComment);

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

  await bumpInspectionVersion({
    inspectionId: current.inspectionId,
    changeComment,
    changedById: args.changedById,
  });
}

export async function createInspectionRun(args: {
  inspectionId: string;
  operatorId: string;
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
      operatorId: args.operatorId,
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
        type:
          row.type === "YES_NO" ||
          row.type === "TEXT" ||
          row.type === "RADIO" ||
          row.type === "NUMBER" ||
          row.type === "DATE"
            ? row.type
            : "TEXT",
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
  limit = 50,
): Promise<InspectionHistoryItem[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  const rows = await prisma.inspectionRun.findMany({
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
      operator: { select: { name: true } },
    },
  });

  return rows.map((row) => {
    const summary = parseSummary(row.summary);
    return {
      id: row.id,
      status: row.status,
      createdAt: row.createdAt,
      inspectionTitle: row.inspection.title,
      inspectionHref: row.inspection.href,
      inspectionId: row.inspection.id,
      operatorName: row.operator?.name ?? null,
      equipmentRef: row.equipmentRef,
      notes: row.notes,
      signature: null,
      summary,
      // Full answers are loaded on the submission detail page only.
      answers: [],
      responseRows: [],
      actions: [],
    };
  });
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
    return false;
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
      operator: { select: { name: true } },
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
        createdByOperator: { select: { name: true } },
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
    operatorName: row.operator?.name ?? null,
    equipmentRef: row.equipmentRef,
    notes: row.notes,
    signature: row.signature ?? null,
    summary: parseSummary(row.summary),
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
  createdByOperator: { name: string | null } | null;
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
    createdByOperatorName: row.createdByOperator?.name ?? null,
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
      createdByOperator: { select: { name: true } },
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
  createdByOperatorId?: string | null;
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
      createdByOperatorId: args.createdByOperatorId ?? null,
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
            question.type === "RADIO" ? question.options : Prisma.DbNull,
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
            question.type === "RADIO" ? question.options : Prisma.DbNull,
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
