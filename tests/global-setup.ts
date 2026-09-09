import { execSync } from "node:child_process";

/**
 * Clears the local rate-limit ledger before an end-to-end run.
 *
 * The booking endpoint caps an IP at eight bookings an hour, and
 * every test run comes from the same address — so without this, the
 * second run of the morning gets turned away by a limit that is
 * working exactly as intended. This resets the counter; it never
 * changes the limit, and never touches the remote database.
 */
export default function globalSetup() {
  try {
    execSync(
      'npx wrangler d1 execute quinton-carpets --local --command "DELETE FROM rate_limit"',
      { stdio: "ignore" },
    );
  } catch {
    // The database may not be seeded yet on a first run. The tests
    // that need it will say so far more clearly than this would.
    console.warn(
      "Could not clear the local rate_limit table. If booking tests fail with " +
        '"a few too many bookings", run: npm run db:local',
    );
  }
}
