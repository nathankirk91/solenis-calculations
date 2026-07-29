-- AlterTable
ALTER TABLE "inspection_questions" ADD COLUMN IF NOT EXISTS "show_last_value" BOOLEAN NOT NULL DEFAULT false;

-- Enable for the seeded forklift service date question
UPDATE "inspection_questions"
SET "show_last_value" = true
WHERE "id" = 'forklift-daily-check__service-date';
