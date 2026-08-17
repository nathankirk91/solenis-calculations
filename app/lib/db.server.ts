import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../../generated/prisma/client";
import { normalizeDatabaseUrl, postgresSslConfig } from "~/lib/db-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
};

export { normalizeDatabaseUrl, postgresSslConfig } from "~/lib/db-url";

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const normalized = normalizeDatabaseUrl(connectionString);

  // Reuse one pool per warm function instance.
  // max > 1 so a single request can run Promise.all loaders without queueing
  // behind ensureInspectionSchema / other long holds (pg connectionTimeoutMillis
  // is also the wait-for-idle-client timeout).
  const pool =
    globalForPrisma.pgPool ??
    new pg.Pool({
      connectionString: normalized,
      ssl: postgresSslConfig(normalized),
      max: 3,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 20_000,
      allowExitOnIdle: true,
    });
  globalForPrisma.pgPool = pool;

  pool.on("error", (error) => {
    console.error("[db] Unexpected PostgreSQL pool error", error);
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

/**
 * Shared Prisma client for React Router loaders/actions.
 * Returns null when DATABASE_URL is not configured so the app can fall back
 * to the local calculation catalog.
 */
export function getPrisma(): PrismaClient | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export type { PrismaClient };
