/**
 * Ensure serverless-friendly query params on DATABASE_URL.
 * - sslmode=no-verify for Supabase/pooler (avoids "self-signed certificate in
 *   certificate chain" with node-pg on Vercel)
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

  const isLocal =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1";

  if (!isLocal) {
    const mode = url.searchParams.get("sslmode");
    // require/verify-* make node-pg reject Supabase's chain in some runtimes.
    if (!mode || mode === "require" || mode === "verify-ca" || mode === "verify-full") {
      url.searchParams.set("sslmode", "no-verify");
    }
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

/** SSL options for node-pg against hosted Postgres (Supabase pooler). */
export function postgresSslConfig(connectionString: string): false | { rejectUnauthorized: false } {
  try {
    const url = new URL(connectionString);
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return false;
    }
  } catch {
    // Fall through — assume remote.
  }
  return { rejectUnauthorized: false };
}
