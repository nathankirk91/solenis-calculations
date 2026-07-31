-- Roles and multi-role user assignments
CREATE TABLE IF NOT EXISTS "roles" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "roles_slug_key" ON "roles"("slug");
CREATE INDEX IF NOT EXISTS "roles_is_active_sort_order_idx" ON "roles"("is_active", "sort_order");

CREATE TABLE IF NOT EXISTS "user_role_assignments" (
  "user_id" TEXT NOT NULL,
  "role_id" TEXT NOT NULL,
  "assigned_by_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("user_id", "role_id")
);

CREATE INDEX IF NOT EXISTS "user_role_assignments_role_id_idx" ON "user_role_assignments"("role_id");

DO $$ BEGIN
  ALTER TABLE "user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_assigned_by_id_fkey"
    FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Permit sign-off slot → role mapping
CREATE TABLE IF NOT EXISTS "permit_sign_off_slots" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permit_sign_off_slots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "permit_sign_off_slots_code_key" ON "permit_sign_off_slots"("code");
CREATE INDEX IF NOT EXISTS "permit_sign_off_slots_sort_order_idx" ON "permit_sign_off_slots"("sort_order");

CREATE TABLE IF NOT EXISTS "permit_sign_off_slot_roles" (
  "slot_id" TEXT NOT NULL,
  "role_id" TEXT NOT NULL,
  CONSTRAINT "permit_sign_off_slot_roles_pkey" PRIMARY KEY ("slot_id", "role_id")
);

CREATE INDEX IF NOT EXISTS "permit_sign_off_slot_roles_role_id_idx" ON "permit_sign_off_slot_roles"("role_id");

DO $$ BEGIN
  ALTER TABLE "permit_sign_off_slot_roles"
    ADD CONSTRAINT "permit_sign_off_slot_roles_slot_id_fkey"
    FOREIGN KEY ("slot_id") REFERENCES "permit_sign_off_slots"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "permit_sign_off_slot_roles"
    ADD CONSTRAINT "permit_sign_off_slot_roles_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
