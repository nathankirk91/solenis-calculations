-- Per-user push notification type preferences (missing rows mean enabled)
CREATE TABLE IF NOT EXISTS "user_notification_preferences" (
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("user_id","type")
);

CREATE INDEX IF NOT EXISTS "user_notification_preferences_type_enabled_idx"
  ON "user_notification_preferences"("type", "enabled");

DO $$ BEGIN
  ALTER TABLE "user_notification_preferences"
    ADD CONSTRAINT "user_notification_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
