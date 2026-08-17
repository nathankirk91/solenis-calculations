-- Per permit-form authorisation threshold (Safe Work = 2, Hot Work may be 3).
ALTER TABLE "inspections" ADD COLUMN IF NOT EXISTS "required_signer_count" INTEGER;

UPDATE "inspections"
SET "required_signer_count" = 2
WHERE lower("category") = 'permits'
  AND ("required_signer_count" IS NULL);
