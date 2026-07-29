-- AlterTable
ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "template_inspection_id" TEXT;
ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "fixed_equipment_ref" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "inspections_template_inspection_id_idx" ON "inspections"("template_inspection_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "inspections"
    ADD CONSTRAINT "inspections_template_inspection_id_fkey"
    FOREIGN KEY ("template_inspection_id") REFERENCES "inspections"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
