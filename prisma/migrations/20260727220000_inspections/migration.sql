-- CreateEnum
CREATE TYPE "inspection_run_status" AS ENUM ('PASSED', 'NEEDS_ATTENTION');

-- CreateTable
CREATE TABLE "inspections" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "href" TEXT NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_runs" (
    "id" TEXT NOT NULL,
    "inspection_id" TEXT NOT NULL,
    "operator_id" TEXT,
    "submitted_by_id" TEXT,
    "status" "inspection_run_status" NOT NULL,
    "equipment_ref" TEXT,
    "responses" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inspections_slug_key" ON "inspections"("slug");

-- CreateIndex
CREATE INDEX "inspection_runs_inspection_id_idx" ON "inspection_runs"("inspection_id");

-- CreateIndex
CREATE INDEX "inspection_runs_status_created_at_idx" ON "inspection_runs"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "inspection_runs_created_at_idx" ON "inspection_runs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "inspection_runs" ADD CONSTRAINT "inspection_runs_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_runs" ADD CONSTRAINT "inspection_runs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_runs" ADD CONSTRAINT "inspection_runs_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
