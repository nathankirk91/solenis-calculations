#!/usr/bin/env node
/**
 * Run `prisma db seed` during production builds when DATABASE_URL is set.
 * Idempotent — upserts calculations, inspections, operators, and roles.
 * Existing user passwords are not overwritten (see prisma/seed.ts).
 */
import { spawn } from "node:child_process";

const database = process.env.DATABASE_URL;

if (!database) {
  console.warn("Skipping prisma db seed: DATABASE_URL is not set.");
  process.exit(0);
}

if (process.env.RUN_DB_SEED === "false") {
  console.log("Skipping prisma db seed: RUN_DB_SEED=false.");
  process.exit(0);
}

try {
  const host = new URL(database).host;
  console.log(`Running prisma db seed via DATABASE_URL (${host})`);
} catch {
  console.log("Running prisma db seed via DATABASE_URL");
}

const child = spawn("npx", ["prisma", "db", "seed"], {
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`prisma db seed killed by signal ${signal}`);
    process.exit(1);
  }
  if (code !== 0) {
    console.error(`prisma db seed exited with code ${code ?? "unknown"}`);
    process.exit(code ?? 1);
  }
  process.exit(0);
});
