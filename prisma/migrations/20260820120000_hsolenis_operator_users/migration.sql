-- Replace standalone operators with hSolenis Operator role users.

ALTER TABLE "calculation_runs" ADD COLUMN "operator_user_id" TEXT;

ALTER TABLE "inspection_runs" ADD COLUMN "operator_user_id" TEXT;

ALTER TABLE "calculation_runs" DROP CONSTRAINT IF EXISTS "calculation_runs_operator_id_fkey";
ALTER TABLE "calculation_runs" DROP COLUMN IF EXISTS "operator_id";

ALTER TABLE "inspection_runs" DROP CONSTRAINT IF EXISTS "inspection_runs_operator_id_fkey";
ALTER TABLE "inspection_runs" DROP COLUMN IF EXISTS "operator_id";

ALTER TABLE "inspection_actions" DROP CONSTRAINT IF EXISTS "inspection_actions_created_by_operator_id_fkey";
ALTER TABLE "inspection_actions" DROP COLUMN IF EXISTS "created_by_operator_id";

ALTER TABLE "calculation_runs"
  ADD CONSTRAINT "calculation_runs_operator_user_id_fkey"
  FOREIGN KEY ("operator_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inspection_runs"
  ADD CONSTRAINT "inspection_runs_operator_user_id_fkey"
  FOREIGN KEY ("operator_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

DROP TABLE IF EXISTS "operators";
