-- AlterEnum
ALTER TYPE "inspection_question_type" ADD VALUE IF NOT EXISTS 'TIME';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "permit_run_status" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "permit_runs" (
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
);

CREATE INDEX IF NOT EXISTS "permit_runs_inspection_id_idx" ON "permit_runs"("inspection_id");
CREATE INDEX IF NOT EXISTS "permit_runs_status_created_at_idx" ON "permit_runs"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "permit_runs_created_at_idx" ON "permit_runs"("created_at" DESC);

DO $$ BEGIN
  ALTER TABLE "permit_runs"
    ADD CONSTRAINT "permit_runs_inspection_id_fkey"
    FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "permit_runs"
    ADD CONSTRAINT "permit_runs_submitted_by_id_fkey"
    FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "permit_runs"
    ADD CONSTRAINT "permit_runs_closed_by_id_fkey"
    FOREIGN KEY ("closed_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
