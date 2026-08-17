/**
 * Ensure serverless-friendly query params on DATABASE_URL.
 * - sslmode=require for Supabase
 * - connect_timeout for slow cold connects / paused projects
 * - pgbouncer=true on transaction pooler hosts (disables prepared statements)
 */
export function normalizeDatabaseUrl(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }

  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }
  if (!url.searchParams.has("connect_timeout")) {
    // libpq seconds — give cold starts / waking projects more headroom
    url.searchParams.set("connect_timeout", "15");
  }

  const usesPooler =
    url.port === "6543" ||
    url.hostname.includes("pooler") ||
    url.searchParams.get("pgbouncer") === "true";
  if (usesPooler && !url.searchParams.has("pgbouncer")) {
    url.searchParams.set("pgbouncer", "true");
  }

  return url.toString();
}
