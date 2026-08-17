-- Permit field roles so manager-built forms can mark start/end/area without magic IDs.
ALTER TABLE "inspection_questions" ADD COLUMN IF NOT EXISTS "permit_field_role" TEXT;

-- Backfill known Safe Work Permit built-in question IDs.
UPDATE "inspection_questions"
SET "permit_field_role" = 'start_time'
WHERE "id" LIKE '%__start-time' AND ("permit_field_role" IS NULL OR "permit_field_role" = '');

UPDATE "inspection_questions"
SET "permit_field_role" = 'end_time'
WHERE "id" LIKE '%__end-time' AND ("permit_field_role" IS NULL OR "permit_field_role" = '');

UPDATE "inspection_questions"
SET "permit_field_role" = 'area'
WHERE "id" LIKE '%__area' AND ("permit_field_role" IS NULL OR "permit_field_role" = '');
