#!/usr/bin/env node
/**
 * Run `prisma db seed` during production builds when RUN_DB_SEED=true.
 * Opt-in only — normal deploys skip seeding. Set RUN_DB_SEED=true in Netlify
 * for a one-off deploy when you need to (re)seed the database.
 */
import { spawn } from "node:child_process";

if (process.env.RUN_DB_SEED !== "true") {
  console.log(
    "Skipping prisma db seed (set RUN_DB_SEED=true on a deploy to run seed).",
  );
  process.exit(0);
}

const database = process.env.DATABASE_URL;

if (!database) {
  console.warn("Skipping prisma db seed: DATABASE_URL is not set.");
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
