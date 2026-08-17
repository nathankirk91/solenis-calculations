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

/**
 * Cheap, memoized repair for forklift shift/week question flags.
 * ensureInspectionSchema only runs on cold schema misses — this still runs
 * after columns exist so bad flags (e.g. engine oil marked Day-only) get cleared.
 */
let forkliftShiftWeekFlagsReady: Promise<void> | null = null;

export async function ensureForkliftShiftWeekFlags(): Promise<void> {
  if (!forkliftShiftWeekFlagsReady) {
    forkliftShiftWeekFlagsReady = ensureForkliftShiftWeekFlagsOnce().catch(
      (error) => {
        forkliftShiftWeekFlagsReady = null;
        throw error;
      },
    );
  }
  await forkliftShiftWeekFlagsReady;
}

async function ensureForkliftShiftWeekFlagsOnce(): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) {
    return;
  }

  await ensureInspectionSchema();

  await prisma.$executeRawUnsafe(
    `UPDATE "inspection_questions"
     SET "applicable_shifts" = '["Day"]'::jsonb,
         "first_of_week_only" = true,
         "required" = true
     WHERE "id" IN (
       'forklift-daily-check__scrubber-drained',
       'forklift-daily-check__scrubber-washed',
       'forklift-daily-check__flameproofers',
       'forklift-daily-check__anode',
       'forklift-daily-check__air-receiver'
     )`,
  );

  await prisma.$executeRawUnsafe(
    `UPDATE "inspection_questions"
     SET "applicable_shifts" = NULL,
         "first_of_week_only" = false
     WHERE "id" LIKE 'forklift-daily-check__%'
       AND "id" NOT IN (
         'forklift-daily-check__scrubber-drained',
         'forklift-daily-check__scrubber-washed',
         'forklift-daily-check__flameproofers',
         'forklift-daily-check__anode',
         'forklift-daily-check__air-receiver'
       )
       AND (
         "applicable_shifts" IS NOT NULL
         OR "first_of_week_only" = true
       )`,
  );
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
    `ALTER TYPE "inspection_question_type" ADD VALUE IF NOT EXISTS 'TIME'`,
    `ALTER TYPE "inspection_question_type" ADD VALUE IF NOT EXISTS 'CHECKBOX'`,
    `DO $$ BEGIN
      CREATE TYPE "permit_run_status" AS ENUM ('PENDING_AUTHORIZATION', 'OPEN', 'CLOSED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TYPE "permit_run_status" ADD VALUE IF NOT EXISTS 'PENDING_AUTHORIZATION';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
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
    `ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "required_signer_count" INTEGER`,
    `ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "template_inspection_id" TEXT`,
    `ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "fixed_equipment_ref" TEXT`,
    `ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1`,
    `UPDATE "inspections"
       SET "required_signer_count" = 2
       WHERE lower("category") = 'permits'
         AND ("required_signer_count" IS NULL)`,
    `ALTER TABLE "inspections" ALTER COLUMN "description" SET DEFAULT ''`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "inspections_slug_key" ON "inspections"("slug")`,
    `CREATE INDEX IF NOT EXISTS "inspections_template_inspection_id_idx" ON "inspections"("template_inspection_id")`,
    `DO $$ BEGIN
      ALTER TABLE "inspections"
        ADD CONSTRAINT "inspections_template_inspection_id_fkey"
        FOREIGN KEY ("template_inspection_id") REFERENCES "inspections"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
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
      "show_last_value" BOOLEAN NOT NULL DEFAULT false,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "inspection_questions_pkey" PRIMARY KEY ("id")
    )`,
    `ALTER TABLE "inspection_questions" ADD COLUMN IF NOT EXISTS "show_last_value" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "inspection_questions" ADD COLUMN IF NOT EXISTS "applicable_equipment_refs" JSONB`,
    `ALTER TABLE "inspection_questions" ADD COLUMN IF NOT EXISTS "applicable_shifts" JSONB`,
    `ALTER TABLE "inspection_questions" ADD COLUMN IF NOT EXISTS "first_of_week_only" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "inspection_questions" ADD COLUMN IF NOT EXISTS "permit_field_role" TEXT`,
    `UPDATE "inspection_questions"
       SET "permit_field_role" = 'start_time'
       WHERE "id" LIKE '%__start-time'
         AND ("permit_field_role" IS NULL OR "permit_field_role" = '')`,
    `UPDATE "inspection_questions"
       SET "permit_field_role" = 'end_time'
       WHERE "id" LIKE '%__end-time'
         AND ("permit_field_role" IS NULL OR "permit_field_role" = '')`,
    `UPDATE "inspection_questions"
       SET "permit_field_role" = 'area'
       WHERE "id" LIKE '%__area'
         AND ("permit_field_role" IS NULL OR "permit_field_role" = '')`,
    `UPDATE "inspection_questions" SET "show_last_value" = true WHERE "id" = 'forklift-daily-check__service-date'`,
    `UPDATE "inspection_questions" SET "attention_values" = '[]'::jsonb WHERE "id" = 'forklift-daily-check__shift'`,
    `UPDATE "inspection_questions"
       SET "applicable_shifts" = '["Day"]'::jsonb,
           "first_of_week_only" = true,
           "required" = true
       WHERE "id" IN (
         'forklift-daily-check__scrubber-drained',
         'forklift-daily-check__scrubber-washed',
         'forklift-daily-check__flameproofers',
         'forklift-daily-check__anode',
         'forklift-daily-check__air-receiver'
       )`,
    // Clear accidental shift/week flags on every other forklift question
    // (e.g. engine oil must stay visible on every shift).
    `UPDATE "inspection_questions"
       SET "applicable_shifts" = NULL,
           "first_of_week_only" = false
       WHERE "id" LIKE 'forklift-daily-check__%'
         AND "id" NOT IN (
           'forklift-daily-check__scrubber-drained',
           'forklift-daily-check__scrubber-washed',
           'forklift-daily-check__flameproofers',
           'forklift-daily-check__anode',
           'forklift-daily-check__air-receiver'
         )
         AND (
           "applicable_shifts" IS NOT NULL
           OR "first_of_week_only" = true
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
    `DO $$ BEGIN
      CREATE TYPE "inspection_action_status" AS ENUM ('OPEN', 'CLOSED');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `CREATE TABLE IF NOT EXISTS "inspection_actions" (
      "id" TEXT NOT NULL,
      "created_on_run_id" TEXT NOT NULL,
      "inspection_id" TEXT NOT NULL,
      "equipment_ref" TEXT,
      "description" TEXT NOT NULL,
      "status" "inspection_action_status" NOT NULL DEFAULT 'OPEN',
      "created_by_operator_id" TEXT,
      "created_by_user_id" TEXT,
      "closed_at" TIMESTAMPTZ(6),
      "closed_by_id" TEXT,
      "completion_comment" TEXT,
      "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "inspection_actions_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "inspection_actions_status_equipment_ref_created_at_idx"
      ON "inspection_actions"("status", "equipment_ref", "created_at" DESC)`,
    `CREATE INDEX IF NOT EXISTS "inspection_actions_status_inspection_id_created_at_idx"
      ON "inspection_actions"("status", "inspection_id", "created_at" DESC)`,
    `CREATE INDEX IF NOT EXISTS "inspection_actions_created_on_run_id_idx"
      ON "inspection_actions"("created_on_run_id")`,
    `DO $$ BEGIN
      ALTER TABLE "inspection_actions"
        ADD CONSTRAINT "inspection_actions_created_on_run_id_fkey"
        FOREIGN KEY ("created_on_run_id") REFERENCES "inspection_runs"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "inspection_actions"
        ADD CONSTRAINT "inspection_actions_inspection_id_fkey"
        FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "inspection_actions"
        ADD CONSTRAINT "inspection_actions_created_by_operator_id_fkey"
        FOREIGN KEY ("created_by_operator_id") REFERENCES "operators"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "inspection_actions"
        ADD CONSTRAINT "inspection_actions_created_by_user_id_fkey"
        FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "inspection_actions"
        ADD CONSTRAINT "inspection_actions_closed_by_id_fkey"
        FOREIGN KEY ("closed_by_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `CREATE TABLE IF NOT EXISTS "permit_runs" (
      "id" TEXT NOT NULL,
      "inspection_id" TEXT NOT NULL,
      "submitted_by_id" TEXT,
      "status" "permit_run_status" NOT NULL DEFAULT 'OPEN',
      "equipment_ref" TEXT,
      "inspection_version" INTEGER,
      "responses" JSONB NOT NULL,
      "summary" JSONB NOT NULL,
      "authorized_personnel" JSONB NOT NULL,
      "authorization" JSONB NOT NULL,
      "closeout" JSONB,
      "closed_at" TIMESTAMPTZ(6),
      "closed_by_id" TEXT,
      "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "permit_runs_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "permit_runs_inspection_id_idx" ON "permit_runs"("inspection_id")`,
    `CREATE INDEX IF NOT EXISTS "permit_runs_status_created_at_idx" ON "permit_runs"("status", "created_at" DESC)`,
    `CREATE INDEX IF NOT EXISTS "permit_runs_created_at_idx" ON "permit_runs"("created_at" DESC)`,
    `ALTER TABLE "permit_runs" ADD COLUMN IF NOT EXISTS "permit_number" TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "permit_runs_permit_number_key" ON "permit_runs"("permit_number")`,
    `CREATE TABLE IF NOT EXISTS "permit_number_sequences" (
      "year_month" TEXT NOT NULL,
      "last_value" INTEGER NOT NULL DEFAULT 0,
      "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "permit_number_sequences_pkey" PRIMARY KEY ("year_month")
    )`,
    `DO $$ BEGIN
      ALTER TABLE "permit_runs"
        ADD CONSTRAINT "permit_runs_inspection_id_fkey"
        FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "permit_runs"
        ADD CONSTRAINT "permit_runs_submitted_by_id_fkey"
        FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "permit_runs"
        ADD CONSTRAINT "permit_runs_closed_by_id_fkey"
        FOREIGN KEY ("closed_by_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `CREATE TABLE IF NOT EXISTS "roles" (
      "id" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT NOT NULL DEFAULT '',
      "is_system" BOOLEAN NOT NULL DEFAULT false,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "roles_slug_key" ON "roles"("slug")`,
    `CREATE INDEX IF NOT EXISTS "roles_is_active_sort_order_idx"
      ON "roles"("is_active", "sort_order")`,
    `CREATE TABLE IF NOT EXISTS "user_role_assignments" (
      "user_id" TEXT NOT NULL,
      "role_id" TEXT NOT NULL,
      "assigned_by_id" TEXT,
      "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("user_id", "role_id")
    )`,
    `CREATE INDEX IF NOT EXISTS "user_role_assignments_role_id_idx"
      ON "user_role_assignments"("role_id")`,
    `DO $$ BEGIN
      ALTER TABLE "user_role_assignments"
        ADD CONSTRAINT "user_role_assignments_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "user_role_assignments"
        ADD CONSTRAINT "user_role_assignments_role_id_fkey"
        FOREIGN KEY ("role_id") REFERENCES "roles"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "user_role_assignments"
        ADD CONSTRAINT "user_role_assignments_assigned_by_id_fkey"
        FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `CREATE TABLE IF NOT EXISTS "permit_sign_off_slots" (
      "id" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "permit_sign_off_slots_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "permit_sign_off_slots_code_key"
      ON "permit_sign_off_slots"("code")`,
    `CREATE INDEX IF NOT EXISTS "permit_sign_off_slots_sort_order_idx"
      ON "permit_sign_off_slots"("sort_order")`,
    `CREATE TABLE IF NOT EXISTS "permit_sign_off_slot_roles" (
      "slot_id" TEXT NOT NULL,
      "role_id" TEXT NOT NULL,
      CONSTRAINT "permit_sign_off_slot_roles_pkey" PRIMARY KEY ("slot_id", "role_id")
    )`,
    `CREATE INDEX IF NOT EXISTS "permit_sign_off_slot_roles_role_id_idx"
      ON "permit_sign_off_slot_roles"("role_id")`,
    `DO $$ BEGIN
      ALTER TABLE "permit_sign_off_slot_roles"
        ADD CONSTRAINT "permit_sign_off_slot_roles_slot_id_fkey"
        FOREIGN KEY ("slot_id") REFERENCES "permit_sign_off_slots"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "permit_sign_off_slot_roles"
        ADD CONSTRAINT "permit_sign_off_slot_roles_role_id_fkey"
        FOREIGN KEY ("role_id") REFERENCES "roles"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  const { ensureRolesAndSignOffDefaults } = await import("~/lib/roles.server");
  await ensureRolesAndSignOffDefaults();
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
      name.includes("_inspection_versions") ||
      name.includes("_inspection_templates") ||
      name.includes("_inspection_question_show_last_value") ||
      name.includes("_inspection_question_unit_applicability") ||
      name.includes("_inspection_question_shift_week") ||
      name.includes("_clear_shift_attention_values") ||
      name.includes("_inspection_actions") ||
      name.includes("_inspection_run_signature")
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
