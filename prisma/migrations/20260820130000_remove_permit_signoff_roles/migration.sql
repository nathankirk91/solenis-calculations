-- Remove built-in permit sign-off roles; slots are configured via Permit settings.

DELETE FROM "permit_sign_off_slot_roles"
WHERE "role_id" IN (
  SELECT "id" FROM "roles"
  WHERE "slug" IN ('operations-rep', 'maintenance-rep', 'safe-work-coordinator')
);

DELETE FROM "user_role_assignments"
WHERE "role_id" IN (
  SELECT "id" FROM "roles"
  WHERE "slug" IN ('operations-rep', 'maintenance-rep', 'safe-work-coordinator')
);

DELETE FROM "roles"
WHERE "slug" IN ('operations-rep', 'maintenance-rep', 'safe-work-coordinator');
