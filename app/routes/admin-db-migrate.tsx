import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { data, Form, Link } from "react-router";

import type { Route } from "./+types/admin-db-migrate";

import { AppHeader } from "~/components/app-header";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireAdmin } from "~/lib/auth.server";
import { getPrisma } from "~/lib/db.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "DB migrate | Springvale Solenis" },
    {
      name: "description",
      content: "Apply pending Prisma migrations through the app database connection.",
    },
  ];
}

type AppliedMigration = {
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

async function applyPendingMigrations(): Promise<AppliedMigration[]> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("DATABASE_URL is not configured.");
  }

  // Ensure migrations history table exists (Prisma normally creates this).
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
      // Split on statement boundaries carefully enough for our migration files.
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

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAdmin(request, "/admin/db-migrate");
  const pendingCount = await countPendingRuns();
  return { user, pendingCount };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request, "/admin/db-migrate");
  const formData = await request.formData();
  if (String(formData.get("intent") ?? "") !== "migrate") {
    return data({ error: "Unknown action." }, { status: 400 });
  }

  try {
    const results = await applyPendingMigrations();
    return { ok: true as const, results };
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error ? error.message : "Could not apply migrations.",
      },
      { status: 500 },
    );
  }
}

export default function AdminDbMigratePage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, pendingCount } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Admin</Badge>
            <Link
              to="/"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Home
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Apply database migrations
          </h1>
          <p className="mt-2 text-muted-foreground">
            Use this if a Vercel build-time migrate hangs on the Supabase
            pooler. Applies any pending Prisma migrations through the app DB
            connection.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending migrations</CardTitle>
            <CardDescription>
              Safe to run more than once — already-applied migrations are
              skipped.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {actionData && "error" in actionData && actionData.error ? (
              <p className="text-sm text-destructive">{actionData.error}</p>
            ) : null}
            {actionData && "results" in actionData && actionData.results ? (
              <ul className="grid gap-2 text-sm">
                {actionData.results.map((result) => (
                  <li
                    key={result.name}
                    className="rounded-lg border border-border/70 px-3 py-2"
                  >
                    <span className="font-medium">{result.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      {result.status}
                      {result.detail ? ` — ${result.detail}` : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <Form method="post">
              <input type="hidden" name="intent" value="migrate" />
              <Button type="submit">Apply pending migrations</Button>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
