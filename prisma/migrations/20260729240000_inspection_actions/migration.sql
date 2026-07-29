-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "inspection_action_status" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "inspection_actions" (
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
);

CREATE INDEX IF NOT EXISTS "inspection_actions_status_equipment_ref_created_at_idx"
  ON "inspection_actions"("status", "equipment_ref", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "inspection_actions_status_inspection_id_created_at_idx"
  ON "inspection_actions"("status", "inspection_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "inspection_actions_created_on_run_id_idx"
  ON "inspection_actions"("created_on_run_id");

DO $$ BEGIN
  ALTER TABLE "inspection_actions"
    ADD CONSTRAINT "inspection_actions_created_on_run_id_fkey"
    FOREIGN KEY ("created_on_run_id") REFERENCES "inspection_runs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inspection_actions"
    ADD CONSTRAINT "inspection_actions_inspection_id_fkey"
    FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inspection_actions"
    ADD CONSTRAINT "inspection_actions_created_by_operator_id_fkey"
    FOREIGN KEY ("created_by_operator_id") REFERENCES "operators"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inspection_actions"
    ADD CONSTRAINT "inspection_actions_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inspection_actions"
    ADD CONSTRAINT "inspection_actions_closed_by_id_fkey"
    FOREIGN KEY ("closed_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
