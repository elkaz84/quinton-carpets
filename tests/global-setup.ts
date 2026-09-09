import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * Clears the rate-limit ledger before an end-to-end run.
 *
 * The booking endpoint caps an IP at eight bookings an hour, and
 * every test run comes from the same address — so without this, the
 * second run of the morning gets turned away by a limit that is
 * working exactly as intended. This resets the counter; it never
 * changes the limit.
 */
export default async function globalSetup() {
  let url = process.env.DATABASE_URL;

  if (!url) {
    try {
      const text = readFileSync(new URL("../.env", import.meta.url), "utf8");
      url = /^\s*DATABASE_URL\s*=\s*(.+)$/m
        .exec(text)?.[1]
        ?.replace(/^["']|["']$/g, "")
        .trim();
    } catch {
      // Handled below.
    }
  }

  if (!url) {
    console.warn(
      "No DATABASE_URL, so the rate-limit ledger was not cleared. " +
        "Copy .env.example to .env before running the booking tests.",
    );
    return;
  }

  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 20, onnotice: () => {} });
  try {
    await sql`DELETE FROM rate_limit`;
  } catch {
    // The tables may not exist yet on a first run. The tests that need
    // them will say so far more clearly than this would.
    console.warn(
      'Could not clear rate_limit. If booking tests fail with "a few too many ' +
        'bookings", run: npm run db:setup',
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
