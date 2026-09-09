/**
 * The database: Postgres, on Supabase.
 *
 * This wrapper deliberately keeps the shape the site already used —
 * prepare().bind().first()/all()/run(), and a batch() that is a real
 * transaction. That is not nostalgia for the old host: it means the
 * thirteen SQL statements in this codebase read exactly as they did
 * when they were reviewed, and the only thing that changed is where
 * they run.
 *
 * Placeholders are written ?1, ?2 in the call sites and rewritten to
 * Postgres's $1, $2 here, so no query had to be edited by hand.
 */

import postgres from "postgres";

/** process.env at runtime; import.meta.env is the .env file in dev. */
export function envVar(name: string): string | undefined {
  const fromProcess = typeof process !== "undefined" ? process.env?.[name] : undefined;
  if (fromProcess) return fromProcess;
  return (import.meta.env as Record<string, string | undefined>)[name];
}

let client: postgres.Sql | null = null;

/**
 * One lazily-made client per warm instance. Supabase's pooler is what
 * actually manages concurrency, so a serverless invocation needs a
 * single connection, not a pool of its own.
 */
function sql(): postgres.Sql {
  if (client) return client;

  const url = envVar("DATABASE_URL");
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and paste the Supabase connection string.",
    );
  }

  client = postgres(url, {
    // Supabase's pooler runs in transaction mode, which cannot keep a
    // prepared statement alive between queries. Without this, every
    // second request fails with "prepared statement already exists".
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  return client;
}

/** True when the site has somewhere to read bookings from. */
export const hasDatabase = () => Boolean(envVar("DATABASE_URL"));

/** ?1 ?2 → $1 $2. Postgres numbers its placeholders the same way. */
const toPg = (text: string) => text.replace(/\?(\d+)/g, "$$$1");

export class Statement {
  readonly text: string;
  params: unknown[] = [];

  constructor(text: string) {
    this.text = toPg(text);
  }

  bind(...values: unknown[]): Statement {
    this.params = values;
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    const rows = await sql().unsafe(this.text, this.params as never[]);
    return { results: rows as unknown as T[] };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const rows = await sql().unsafe(this.text, this.params as never[]);
    return ((rows as unknown as T[])[0] ?? null) as T | null;
  }

  async run(): Promise<void> {
    await sql().unsafe(this.text, this.params as never[]);
  }
}

export const db = {
  prepare: (text: string) => new Statement(text),

  /**
   * All of them or none of them. The booking insert and its referral
   * code are written together — a booking without its code would be a
   * customer promised a discount the shop cannot find.
   */
  async batch(statements: Statement[]): Promise<void> {
    await sql().begin(async (tx) => {
      for (const s of statements) {
        await tx.unsafe(s.text, s.params as never[]);
      }
    });
  },
};
