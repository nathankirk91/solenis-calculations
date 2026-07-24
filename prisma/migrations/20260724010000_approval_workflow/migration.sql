-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('OPERATOR', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "calculation_run_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable users: add role (existing users become ADMIN so current seed keeps access)
ALTER TABLE "users" ADD COLUMN "role" "user_role" NOT NULL DEFAULT 'OPERATOR';
UPDATE "users" SET "role" = 'ADMIN';
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'OPERATOR';

-- CreateTable
CREATE TABLE "operators" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operators_is_active_sort_order_idx" ON "operators"("is_active", "sort_order");

-- AlterTable calculation_runs
ALTER TABLE "calculation_runs" ADD COLUMN "operator_id" TEXT;
ALTER TABLE "calculation_runs" ADD COLUMN "submitted_by_id" TEXT;
ALTER TABLE "calculation_runs" ADD COLUMN "status" "calculation_run_status" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "calculation_runs" ADD COLUMN "reviewed_by_id" TEXT;
ALTER TABLE "calculation_runs" ADD COLUMN "reviewed_at" TIMESTAMPTZ(6);
ALTER TABLE "calculation_runs" ADD COLUMN "review_note" TEXT;

-- Existing historical runs should not clog the pending queue
UPDATE "calculation_runs" SET "status" = 'APPROVED';

-- AddForeignKey
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "calculation_runs_status_created_at_idx" ON "calculation_runs"("status", "created_at" DESC);
