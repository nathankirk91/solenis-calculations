-- AlterTable
ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "inspection_runs" ADD COLUMN IF NOT EXISTS "inspection_version" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "inspection_versions" (
    "id" TEXT NOT NULL,
    "inspection_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "change_comment" TEXT NOT NULL,
    "changed_by_id" TEXT,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "inspection_versions_inspection_id_version_key" ON "inspection_versions"("inspection_id", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inspection_versions_inspection_id_created_at_idx" ON "inspection_versions"("inspection_id", "created_at" DESC);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "inspection_versions"
    ADD CONSTRAINT "inspection_versions_inspection_id_fkey"
    FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inspection_versions"
    ADD CONSTRAINT "inspection_versions_changed_by_id_fkey"
    FOREIGN KEY ("changed_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
