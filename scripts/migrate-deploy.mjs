#!/usr/bin/env node
/**
 * Run `prisma migrate deploy` during Vercel builds.
 * Prefers DIRECT_URL; falls back to DATABASE_URL with advisory lock disabled
 * so pooled Supabase connections can still apply migrations.
 */
import { spawnSync } from "node:child_process";

const direct = process.env.DIRECT_URL;
const database = process.env.DATABASE_URL;
const url = direct || database;

if (!url) {
  console.error(
    "Skipping prisma migrate deploy: neither DIRECT_URL nor DATABASE_URL is set.",
  );
  process.exit(0);
}

try {
  const host = new URL(url).host;
  console.log(
    `Running prisma migrate deploy via ${direct ? "DIRECT_URL" : "DATABASE_URL"} (${host})`,
  );
} catch {
  console.log(
    `Running prisma migrate deploy via ${direct ? "DIRECT_URL" : "DATABASE_URL"}`,
  );
}

const env = {
  ...process.env,
  // Needed when migrating through Supabase transaction pooler (6543).
  PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
};

const result = spawnSync(
  "npx",
  ["prisma", "migrate", "deploy"],
  { env, stdio: "inherit", shell: false },
);

process.exit(result.status ?? 1);
