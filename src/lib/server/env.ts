/**
 * Bindings, secrets and the small helpers every API route needs.
 *
 * The site is served by a single Cloudflare Worker — Astro's
 * adapter emits one, and these routes run inside it. There is no
 * separate Pages Functions directory, because a project with a
 * _worker.js ignores one.
 *
 * See wrangler.toml and .env.example.
 */
import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  /** Resend API key. Without it the shop still gets the booking in D1. */
  RESEND_API_KEY?: string;
  /** Where booking notifications go. Defaults to the shop's address. */
  SHOP_EMAIL?: string;
  /** Verified sender on the shop's own domain. */
  MAIL_FROM?: string;
  /** Basic-auth credentials for /admin/. */
  ADMIN_USER?: string;
  ADMIN_PASSWORD?: string;
}

export type { D1Database, D1PreparedStatement };

export const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

export const clientIp = (request: Request) =>
  request.headers.get("cf-connecting-ip") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "unknown";

/**
 * Per-IP, per-hour cap. A household booking two rooms is normal;
 * twenty bookings an hour from one address is not.
 */
export async function rateLimit(
  db: D1Database,
  ip: string,
  limit = 8,
  now: Date = new Date(),
): Promise<boolean> {
  const bucket = `${ip}|${now.toISOString().slice(0, 13)}`;
  await db
    .prepare(
      `INSERT INTO rate_limit (bucket, hits, seen_at) VALUES (?1, 1, ?2)
       ON CONFLICT(bucket) DO UPDATE SET hits = hits + 1, seen_at = ?2`,
    )
    .bind(bucket, now.toISOString())
    .run();

  const row = await db
    .prepare(`SELECT hits FROM rate_limit WHERE bucket = ?1`)
    .bind(bucket)
    .first<{ hits: number }>();

  return (row?.hits ?? 0) <= limit;
}
