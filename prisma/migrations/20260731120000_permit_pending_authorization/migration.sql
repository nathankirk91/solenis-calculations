-- Add pending authorization status for permit runs awaiting sign-off.
DO $$ BEGIN
  ALTER TYPE "permit_run_status" ADD VALUE IF NOT EXISTS 'PENDING_AUTHORIZATION';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
