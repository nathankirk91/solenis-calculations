import { Prisma } from "../../generated/prisma/client";
import { getPrisma } from "~/lib/db.server";
import {
  FALLBACK_INSPECTIONS,
  INSPECTION_DEFINITIONS,
  buildAnswersFromResponses,
  defaultAttentionValues,
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
  isAvailable: boolean;
  sortOrder: number;
  questionCount: number;
  version: number;
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
        : defaultAttentionValues(row.type, options),
    required: row.required,
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
    return getFallbackInspectionByIdOrSlug(idOrSlug) ?? null;
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
      return getFallbackInspectionByIdOrSlug(idOrSlug) ?? null;
    }

    return mergeStaticDefinitionMeta(mapDefinition(row));
  } catch {
    return getFallbackInspectionByIdOrSlug(idOrSlug) ?? null;
  }
}

/** Static checklist metadata (unit list, Form 78 notes) lives in code, not the DB. */
function mergeStaticDefinitionMeta(
  definition: InspectionDefinition,
): InspectionDefinition {
  const fallback = getFallbackInspectionByIdOrSlug(definition.id);
  if (!fallback) {
    return definition;
  }

  return {
    ...definition,
    equipmentLabel: definition.equipmentLabel ?? fallback.equipmentLabel,
    equipmentChoices: fallback.equipmentChoices ?? definition.equipmentChoices,
    instructionNotes: fallback.instructionNotes ?? definition.instructionNotes,
  };
}

export async function listManagedInspections(): Promise<ManagedInspection[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  try {
    const rows = await prisma.inspection.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      include: {
        _count: {
          select: { questions: { where: { isActive: true } } },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      category: row.category,
      href: row.href,
      equipmentLabel: row.equipmentLabel,
      isAvailable: row.isAvailable,
      sortOrder: row.sortOrder,
      questionCount: row._count.questions,
      version: row.version ?? 1,
    }));
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code === "P2021") {
      return [];
    }
    throw error;
  }
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
      versions: {
        orderBy: { version: "desc" },
        include: {
          changedBy: {
            select: { name: true, email: true },
          },
        },
      },
    },
  });

  if (!row) {
    return null;
  }

  // Only backfill version 1 when this inspection has no history yet.
  if (row.versions.length === 0) {
    await ensureBaselineInspectionVersion(row.id);
    const refreshed = await prisma.inspection.findUnique({
      where: { id },
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
      },
    });
    if (!refreshed) {
      return null;
    }
    return {
      ...mapDefinition(refreshed),
      version: refreshed.version ?? 1,
      versions: refreshed.versions.map((version) =>
        mapVersionHistoryItem(version),
      ),
    };
  }

  return {
    ...mapDefinition(row),
    version: row.version ?? 1,
    versions: row.versions.map((version) => mapVersionHistoryItem(version)),
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
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  for (const inspection of INSPECTION_DEFINITIONS) {
    await prisma.inspection.upsert({
      where: { id: inspection.id },
      update: {
        title: inspection.title,
        description: inspection.description,
        category: inspection.category,
        href: inspection.href,
        equipmentLabel: inspection.equipmentLabel ?? null,
        isAvailable: true,
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
        isAvailable: true,
        sortOrder: inspection.sortOrder,
        version: 1,
      },
    });

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
          isActive: true,
          sortOrder: question.sortOrder,
        },
      });
    }

    const questionIds = inspection.questions.map((question) => question.id);
    await prisma.inspectionQuestion.updateMany({
      where: {
        inspectionId: inspection.id,
        isActive: true,
        id: { notIn: questionIds },
      },
      data: { isActive: false },
    });

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
    isAvailable: row.isAvailable,
    sortOrder: row.sortOrder,
    questionCount: 0,
    version: row.version ?? 1,
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

export async function addInspectionQuestion(args: {
  inspectionId: string;
  label: string;
  helpText?: string;
  sectionTitle?: string;
  type: InspectionQuestionType;
  options?: string[];
  attentionValues?: string[];
  required?: boolean;
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
          : normalizedAttention.length
            ? normalizedAttention
            : defaultAttentionValues(args.type, options),
      required: args.required ?? true,
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
          : normalizedAttention.length
            ? normalizedAttention
            : defaultAttentionValues(args.type, options),
      required: args.required ?? true,
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
    select: { version: true },
  });

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
      inspectionVersion: inspection?.version ?? null,
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
    };
  });
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

  const answers = parseAnswers(row.responses);
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
  };
}

export async function ensureSeededInspectionQuestions(): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    return;
  }

  for (const definition of INSPECTION_DEFINITIONS) {
    await prisma.inspection.upsert({
      where: { id: definition.id },
      update: {
        title: definition.title,
        description: definition.description,
        category: definition.category,
        href: definition.href,
        equipmentLabel: definition.equipmentLabel ?? null,
        isAvailable: true,
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
        isAvailable: true,
        sortOrder: definition.sortOrder,
      },
    });

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
