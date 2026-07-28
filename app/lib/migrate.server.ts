import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { getPrisma } from "~/lib/db.server";

export type AppliedMigration = {
  name: string;
  status: "applied" | "skipped" | "failed";
  detail?: string;
};

async function listMigrationDirs(): Promise<string[]> {
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== "migration_lock.toml")
    .map((entry) => entry.name)
    .sort();
}

/** Apply pending Prisma SQL through the app DATABASE_URL (idempotent). */
export async function applyPendingMigrations(): Promise<AppliedMigration[]> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    );
  `);

  const appliedRows = await prisma.$queryRawUnsafe<
    Array<{ migration_name: string }>
  >(`SELECT migration_name FROM "_prisma_migrations"`);
  const applied = new Set(appliedRows.map((row) => row.migration_name));

  const results: AppliedMigration[] = [];
  const dirs = await listMigrationDirs();

  for (const name of dirs) {
    if (applied.has(name)) {
      results.push({ name, status: "skipped", detail: "Already applied" });
      continue;
    }

    const sqlPath = path.join(
      process.cwd(),
      "prisma",
      "migrations",
      name,
      "migration.sql",
    );
    const sql = await readFile(sqlPath, "utf8");

    try {
      const statements = sql
        .split(/;\s*\n/)
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0 && !statement.startsWith("--"));

      for (const statement of statements) {
        await prisma.$executeRawUnsafe(
          statement.endsWith(";") ? statement : `${statement};`,
        );
      }

      const checksum = createHash("sha256").update(sql).digest("hex");
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
         VALUES ($1, $2, now(), $3, NULL, NULL, now(), $4)`,
        randomUUID(),
        checksum,
        name,
        statements.length,
      );

      results.push({ name, status: "applied" });
    } catch (error) {
      results.push({
        name,
        status: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }

  return results;
}

export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = "code" in error ? String(error.code) : "";
  if (code === "P2021") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /does not exist/i.test(message) && /inspections/i.test(message);
}
