#!/usr/bin/env node
/**
 * Run `prisma migrate deploy` during Vercel builds with a hard timeout.
 * Prefers DIRECT_URL; falls back to DATABASE_URL with advisory lock disabled.
 * On timeout or migrate failure, exits 0 so the app build still completes —
 * apply pending SQL via /admin/db-migrate when the pooler hangs.
 */
import { spawn } from "node:child_process";

const TIMEOUT_MS = Number(process.env.PRISMA_MIGRATE_TIMEOUT_MS || 45_000);
const direct = process.env.DIRECT_URL;
const database = process.env.DATABASE_URL;
const url = direct || database;

if (!url) {
  console.warn(
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

if (!direct) {
  let pooled = false;
  try {
    const host = new URL(url).host;
    pooled = host.includes("pooler") || host.includes(":6543");
  } catch {
    pooled = false;
  }
  if (pooled) {
    console.warn(
      "Skipping build-time migrate: DATABASE_URL is a transaction pooler (:6543) and DIRECT_URL is unset.",
    );
    console.warn(
      "Set DIRECT_URL to the Supabase session/direct connection, or apply migrations at /admin/db-migrate after deploy.",
    );
    process.exit(0);
  }
  console.warn(
    "DIRECT_URL is not set. Migrating through DATABASE_URL with advisory-lock bypass + timeout.",
  );
}

let timedOut = false;
const child = spawn("npx", ["prisma", "migrate", "deploy"], {
  env: {
    ...process.env,
    PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
  },
  stdio: "inherit",
});

const timer = setTimeout(() => {
  timedOut = true;
  console.error(
    `prisma migrate deploy timed out after ${TIMEOUT_MS}ms — killing process and continuing build.`,
  );
  console.error(
    "Apply pending migrations after deploy at /admin/db-migrate (admin), or set DIRECT_URL (session mode, not :6543).",
  );
  child.kill("SIGKILL");
}, TIMEOUT_MS);

child.on("exit", (code, signal) => {
  clearTimeout(timer);
  if (timedOut || signal === "SIGKILL") {
    process.exit(0);
  }
  if (code === 0) {
    process.exit(0);
  }
  console.error(
    `prisma migrate deploy exited with code ${code ?? "unknown"} — continuing build. Use /admin/db-migrate if tables are missing.`,
  );
  process.exit(0);
});
