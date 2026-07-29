-- Clear mistaken "Afternoon" attention flag (regex matched substring "no")
UPDATE "inspection_questions"
SET "attention_values" = '[]'::jsonb
WHERE "id" = 'forklift-daily-check__shift';
