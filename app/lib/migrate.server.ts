import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { getPrisma } from "~/lib/db.server";

export type AppliedMigration = {
  name: string;
  status: "applied" | "skipped" | "failed";
  detail?: string;
};

async function listMigrationDirs(): Promise<string[]> {
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== "migration_lock.toml")
    .map((entry) => entry.name)
    .sort();
}

/**
 * Ensure inspection tables/enums exist without reading prisma/migrations from disk.
 * Vercel serverless builds do not ship the migrations folder, so runtime
 * `readdir(prisma/migrations)` fails — this is the production-safe path.
 *
 * Memoized per warm function instance so navigations do not re-run ~24 DDL
 * statements against Supabase on every manage page load.
 */
let inspectionSchemaReady: Promise<void> | null = null;

export async function ensureInspectionSchema(): Promise<void> {
  if (!inspectionSchemaReady) {
    inspectionSchemaReady = ensureInspectionSchemaOnce().catch((error) => {
      inspectionSchemaReady = null;
      throw error;
    });
  }
  await inspectionSchemaReady;
}

async function ensureInspectionSchemaOnce(): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const statements = [
    `DO $$ BEGIN
      CREATE TYPE "inspection_run_status" AS ENUM ('PASSED', 'NEEDS_ATTENTION');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      CREATE TYPE "inspection_question_type" AS ENUM ('YES_NO', 'TEXT', 'RADIO', 'NUMBER', 'DATE');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `ALTER TYPE "inspection_question_type" ADD VALUE IF NOT EXISTS 'NUMBER'`,
    `ALTER TYPE "inspection_question_type" ADD VALUE IF NOT EXISTS 'DATE'`,
    `CREATE TABLE IF NOT EXISTS "inspections" (
      "id" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "category" TEXT NOT NULL DEFAULT 'general',
      "href" TEXT NOT NULL,
      "equipment_label" TEXT,
      "is_available" BOOLEAN NOT NULL DEFAULT true,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "version" INTEGER NOT NULL DEFAULT 1,
      "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
    )`,
    `ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "equipment_label" TEXT`,
    `ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE "inspections" ALTER COLUMN "description" SET DEFAULT ''`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "inspections_slug_key" ON "inspections"("slug")`,
    `CREATE TABLE IF NOT EXISTS "inspection_questions" (
      "id" TEXT NOT NULL,
      "inspection_id" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "help_text" TEXT,
      "section_title" TEXT,
      "type" "inspection_question_type" NOT NULL,
      "options" JSONB,
      "attention_values" JSONB,
      "required" BOOLEAN NOT NULL DEFAULT true,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "inspection_questions_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "inspection_questions_inspection_id_is_active_sort_order_idx"
      ON "inspection_questions"("inspection_id", "is_active", "sort_order")`,
    `DO $$ BEGIN
      ALTER TABLE "inspection_questions"
        ADD CONSTRAINT "inspection_questions_inspection_id_fkey"
        FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `CREATE TABLE IF NOT EXISTS "inspection_runs" (
      "id" TEXT NOT NULL,
      "inspection_id" TEXT NOT NULL,
      "operator_id" TEXT,
      "submitted_by_id" TEXT,
      "status" "inspection_run_status" NOT NULL,
      "equipment_ref" TEXT,
      "inspection_version" INTEGER,
      "responses" JSONB NOT NULL,
      "summary" JSONB NOT NULL,
      "notes" TEXT,
      "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "inspection_runs_pkey" PRIMARY KEY ("id")
    )`,
    `ALTER TABLE "inspection_runs" ADD COLUMN IF NOT EXISTS "inspection_version" INTEGER`,
    `ALTER TABLE "inspection_runs" ADD COLUMN IF NOT EXISTS "signature" TEXT`,
    `CREATE INDEX IF NOT EXISTS "inspection_runs_inspection_id_idx" ON "inspection_runs"("inspection_id")`,
    `CREATE INDEX IF NOT EXISTS "inspection_runs_status_created_at_idx" ON "inspection_runs"("status", "created_at" DESC)`,
    `CREATE INDEX IF NOT EXISTS "inspection_runs_created_at_idx" ON "inspection_runs"("created_at" DESC)`,
    `DO $$ BEGIN
      ALTER TABLE "inspection_runs"
        ADD CONSTRAINT "inspection_runs_inspection_id_fkey"
        FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "inspection_runs"
        ADD CONSTRAINT "inspection_runs_operator_id_fkey"
        FOREIGN KEY ("operator_id") REFERENCES "operators"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "inspection_runs"
        ADD CONSTRAINT "inspection_runs_submitted_by_id_fkey"
        FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `CREATE TABLE IF NOT EXISTS "inspection_versions" (
      "id" TEXT NOT NULL,
      "inspection_id" TEXT NOT NULL,
      "version" INTEGER NOT NULL,
      "change_comment" TEXT NOT NULL,
      "changed_by_id" TEXT,
      "snapshot" JSONB NOT NULL,
      "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "inspection_versions_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "inspection_versions_inspection_id_version_key"
      ON "inspection_versions"("inspection_id", "version")`,
    `CREATE INDEX IF NOT EXISTS "inspection_versions_inspection_id_created_at_idx"
      ON "inspection_versions"("inspection_id", "created_at" DESC)`,
    `DO $$ BEGIN
      ALTER TABLE "inspection_versions"
        ADD CONSTRAINT "inspection_versions_inspection_id_fkey"
        FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "inspection_versions"
        ADD CONSTRAINT "inspection_versions_changed_by_id_fkey"
        FOREIGN KEY ("changed_by_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

/** Apply pending Prisma SQL through the app DATABASE_URL (idempotent). */
export async function applyPendingMigrations(): Promise<AppliedMigration[]> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("DATABASE_URL is not configured.");
  }

  // Always ensure inspection schema first — works even when migration files
  // are missing from the serverless bundle.
  await ensureInspectionSchema();

  let dirs: string[];
  try {
    dirs = await listMigrationDirs();
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Could not read migrations dir";
    return [
      {
        name: "embedded-inspection-schema",
        status: "applied",
        detail: `Used embedded schema (${detail})`,
      },
    ];
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    );
  `);

  const appliedRows = await prisma.$queryRawUnsafe<
    Array<{ migration_name: string }>
  >(`SELECT migration_name FROM "_prisma_migrations"`);
  const applied = new Set(appliedRows.map((row) => row.migration_name));

  const results: AppliedMigration[] = [
    {
      name: "embedded-inspection-schema",
      status: "applied",
      detail: "Ensured inspection tables/enums",
    },
  ];

  for (const name of dirs) {
    if (applied.has(name)) {
      results.push({ name, status: "skipped", detail: "Already applied" });
      continue;
    }

    // Inspection migrations are covered by ensureInspectionSchema — just
    // record them so Prisma history stays consistent when files are present.
    if (
      name.includes("_inspections") ||
      name.includes("_inspection_questions") ||
      name.includes("_inspection_versions")
    ) {
      const sqlPath = path.join(
        process.cwd(),
        "prisma",
        "migrations",
        name,
        "migration.sql",
      );
      const sql = await readFile(sqlPath, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
         VALUES ($1, $2, now(), $3, NULL, NULL, now(), $4)`,
        randomUUID(),
        checksum,
        name,
        1,
      );
      results.push({
        name,
        status: "applied",
        detail: "Recorded after embedded schema",
      });
      continue;
    }

    const sqlPath = path.join(
      process.cwd(),
      "prisma",
      "migrations",
      name,
      "migration.sql",
    );
    const sql = await readFile(sqlPath, "utf8");

    try {
      const statements = sql
        .split(/;\s*\n/)
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0 && !statement.startsWith("--"));

      for (const statement of statements) {
        await prisma.$executeRawUnsafe(
          statement.endsWith(";") ? statement : `${statement};`,
        );
      }

      const checksum = createHash("sha256").update(sql).digest("hex");
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
         VALUES ($1, $2, now(), $3, NULL, NULL, now(), $4)`,
        randomUUID(),
        checksum,
        name,
        statements.length,
      );

      results.push({ name, status: "applied" });
    } catch (error) {
      results.push({
        name,
        status: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }

  return results;
}

export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = "code" in error ? String(error.code) : "";
  if (code === "P2021") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /does not exist/i.test(message) && /inspections/i.test(message);
}
