/**
 * Applies schema.sql to the Supabase database in DATABASE_URL.
 *
 * Safe to run more than once: every statement is CREATE ... IF NOT
 * EXISTS or an ON CONFLICT DO NOTHING insert, so running it against a
 * live database adds what is missing and touches nothing else.
 *
 *   npm run db:setup
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// Read .env ourselves — this is a plain node script, so there is no
// bundler here to do it.
function loadEnv() {
  try {
    const text = readFileSync(join(root, ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const [, key, rawValue] = m;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "").trim();
    }
  } catch {
    // No .env is fine when the variable is already in the environment.
  }
}

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set.\n\n" +
      "Copy .env.example to .env and paste your Supabase connection string:\n" +
      "  Supabase dashboard → Connect → Connection string → Transaction pooler\n",
  );
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 20, onnotice: () => {} });

try {
  const schema = readFileSync(join(root, "schema.sql"), "utf8");
  // One call: postgres.js sends it as a simple query, so the whole
  // file runs as a single implicit transaction.
  await sql.unsafe(schema);

  const [{ count: tables }] = await sql`
    SELECT count(*)::int AS count FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('bookings','referral_codes','promo_codes','rate_limit')`;
  const [{ count: promos }] = await sql`SELECT count(*)::int AS count FROM promo_codes`;

  console.log(`Schema applied. ${tables}/4 tables present, ${promos} promotion codes.`);
} catch (err) {
  console.error("Could not apply the schema:\n", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
