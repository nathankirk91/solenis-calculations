-- AlterTable
ALTER TABLE "inspection_questions" ADD COLUMN IF NOT EXISTS "applicable_shifts" JSONB;
ALTER TABLE "inspection_questions" ADD COLUMN IF NOT EXISTS "first_of_week_only" BOOLEAN NOT NULL DEFAULT false;

-- Weekly forklift items: Day shift + first inspection of the week
UPDATE "inspection_questions"
SET
  "applicable_shifts" = '["Day"]'::jsonb,
  "first_of_week_only" = true,
  "required" = true
WHERE "id" IN (
  'forklift-daily-check__scrubber-drained',
  'forklift-daily-check__scrubber-washed',
  'forklift-daily-check__flameproofers',
  'forklift-daily-check__anode',
  'forklift-daily-check__air-receiver'
);
