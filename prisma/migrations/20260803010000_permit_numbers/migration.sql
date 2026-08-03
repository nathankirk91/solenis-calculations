-- Shared YYMMXXX permit numbers across Safe Work / Hot Work / Line Break.
CREATE TABLE IF NOT EXISTS "permit_number_sequences" (
  "year_month" TEXT NOT NULL,
  "last_value" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permit_number_sequences_pkey" PRIMARY KEY ("year_month")
);

ALTER TABLE "permit_runs" ADD COLUMN IF NOT EXISTS "permit_number" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "permit_runs_permit_number_key"
  ON "permit_runs"("permit_number");
