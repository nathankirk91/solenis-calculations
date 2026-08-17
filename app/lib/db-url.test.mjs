import assert from "node:assert/strict";

const { normalizeDatabaseUrl } = await import("./db-url.ts");

{
  const normalized = normalizeDatabaseUrl(
    "postgresql://postgres.abc:secret@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres",
  );
  const url = new URL(normalized);
  assert.equal(url.searchParams.get("sslmode"), "require");
  assert.equal(url.searchParams.get("connect_timeout"), "15");
  assert.equal(url.searchParams.get("pgbouncer"), "true");
}

{
  const normalized = normalizeDatabaseUrl(
    "postgresql://user:pass@db.example.com:5432/postgres?sslmode=prefer&connect_timeout=5",
  );
  const url = new URL(normalized);
  assert.equal(url.searchParams.get("sslmode"), "prefer");
  assert.equal(url.searchParams.get("connect_timeout"), "5");
  assert.equal(url.searchParams.has("pgbouncer"), false);
}

{
  assert.equal(normalizeDatabaseUrl("not-a-url"), "not-a-url");
}

console.log("db-url unit tests passed");
