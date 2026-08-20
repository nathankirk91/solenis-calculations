-- Rename access level enum values and system role slugs.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'OPERATOR'
  ) THEN
    ALTER TYPE "user_role" RENAME VALUE 'OPERATOR' TO 'STANDARD';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'MANAGER'
  ) THEN
    ALTER TYPE "user_role" RENAME VALUE 'MANAGER' TO 'APPROVER';
  END IF;
END $$;

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'STANDARD'::"user_role";

UPDATE "roles"
SET slug = 'standard', name = 'Standard access',
    description = 'Plant-floor login for calculations, inspections, and permits.'
WHERE slug = 'operator';

UPDATE "roles"
SET slug = 'approver', name = 'Approver',
    description = 'Approvals and form management.'
WHERE slug = 'manager';
