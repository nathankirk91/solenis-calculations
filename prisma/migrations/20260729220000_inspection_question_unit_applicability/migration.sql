-- AlterTable
ALTER TABLE "inspection_questions" ADD COLUMN IF NOT EXISTS "applicable_equipment_refs" JSONB;
