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

    return mapDefinition(row);
  } catch {
    return getFallbackInspectionByIdOrSlug(idOrSlug) ?? null;
  }
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
): Promise<(InspectionDefinition & { questions: InspectionQuestionDef[] }) | null> {
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
    },
  });

  if (!row) {
    return null;
  }

  return mapDefinition(row);
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
    },
  });

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
}): Promise<InspectionQuestionDef> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

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
    args.type === "TEXT"
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
        args.type === "TEXT"
          ? Prisma.DbNull
          : normalizedAttention.length
            ? normalizedAttention
            : defaultAttentionValues(args.type, options),
      required: args.required ?? true,
      isActive: true,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  return mapQuestion(row);
}

function YES_NO_INCLUDES(value: string) {
  return value === "Yes" || value === "No";
}

export async function removeInspectionQuestion(questionId: string): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  const updated = await prisma.inspectionQuestion.updateMany({
    where: { id: questionId, isActive: true },
    data: { isActive: false },
  });
  if (updated.count === 0) {
    throw new Error("Question not found.");
  }
}

export async function createInspectionRun(args: {
  inspectionId: string;
  operatorId: string;
  submittedById: string;
  equipmentRef: string | null;
  notes: string | null;
  answers: InspectionAnswerRecord[];
  summary: InspectionSummary;
}): Promise<{ id: string } | null> {
  const prisma = getPrisma();
  if (!prisma) {
    return null;
  }

  return prisma.inspectionRun.create({
    data: {
      inspectionId: args.inspectionId,
      operatorId: args.operatorId,
      submittedById: args.submittedById,
      status: args.summary.status,
      equipmentRef: args.equipmentRef,
      notes: args.notes,
      responses: args.answers,
      summary: args.summary,
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
          row.type === "YES_NO" || row.type === "TEXT" || row.type === "RADIO"
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
    include: {
      inspection: { select: { id: true, title: true, href: true } },
      operator: { select: { name: true } },
    },
  });

  return rows.map((row) => {
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
      summary: parseSummary(row.summary),
      answers,
      responseRows: answers,
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
