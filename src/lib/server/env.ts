/**
 * Secrets and the small helpers every API route needs.
 *
 * The site runs on Vercel's Node runtime, so configuration is plain
 * environment variables: process.env in production, the .env file in
 * development. The database itself lives in db.ts.
 *
 * See .env.example.
 */

import { db, envVar } from "./db.ts";
import { waitUntil as vercelWaitUntil } from "@vercel/functions";

export interface Env {
  /** Resend API key. Without it the booking still saves; only the mail is skipped. */
  RESEND_API_KEY?: string;
  /** Where booking notifications go. Defaults to the shop's address. */
  SHOP_EMAIL?: string;
  /** Verified sender on the shop's own domain. */
  MAIL_FROM?: string;
  /** Basic-auth credentials for /admin/. */
  ADMIN_USER?: string;
  ADMIN_PASSWORD?: string;
}

export const getEnv = (): Env => ({
  RESEND_API_KEY: envVar("RESEND_API_KEY"),
  SHOP_EMAIL: envVar("SHOP_EMAIL"),
  MAIL_FROM: envVar("MAIL_FROM"),
  ADMIN_USER: envVar("ADMIN_USER"),
  ADMIN_PASSWORD: envVar("ADMIN_PASSWORD"),
});

export const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

export const clientIp = (request: Request) =>
  request.headers.get("x-real-ip") ??
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "unknown";

/**
 * Work that must not hold up the response — the confirmation emails,
 * the referral tally. On Vercel the platform keeps the function alive
 * for it; anywhere else (astro dev, the test run) there is nothing to
 * defer to, so the promise simply runs and its rejection is caught.
 */
export function after(promise: Promise<unknown>): void {
  const swallowed = promise.catch((e: unknown) => console.error("deferred work failed", e));
  try {
    vercelWaitUntil(swallowed);
  } catch {
    void swallowed;
  }
}

/**
 * Per-IP, per-hour cap. A household booking two rooms is normal;
 * twenty bookings an hour from one address is not.
 */
export async function rateLimit(
  ip: string,
  limit = 8,
  now: Date = new Date(),
): Promise<boolean> {
  const bucket = `${ip}|${now.toISOString().slice(0, 13)}`;
  await db
    .prepare(
      `INSERT INTO rate_limit (bucket, hits, seen_at) VALUES (?1, 1, ?2)
       ON CONFLICT(bucket) DO UPDATE SET hits = rate_limit.hits + 1, seen_at = ?2`,
    )
    .bind(bucket, now.toISOString())
    .run();

  const row = await db
    .prepare(`SELECT hits FROM rate_limit WHERE bucket = ?1`)
    .bind(bucket)
    .first<{ hits: number }>();

  return Number(row?.hits ?? 0) <= limit;
}

const hourBucket = (key: string, now: Date) => `${key}|${now.toISOString().slice(0, 13)}`;

/**
 * The address block a client sits in — IPv4 /24, IPv6 /64.
 *
 * Counting the single address is not enough on its own. Mobile
 * networks and CGNAT hand a caller a different address every few
 * requests: testing this site from a phone produced twenty-eight
 * lookups across five addresses, none of which reached its own limit.
 * The block is what stays still, so it is counted too, on a looser
 * limit because real customers do share one.
 */
export function ipBlock(ip: string): string {
  if (ip.includes(":")) return ip.split(":").slice(0, 4).join(":") + "::/64";
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0/24` : ip;
}

/**
 * Is this key already over its limit? Reads without counting.
 *
 * Paired with countAttempt() so that only FAILED attempts count. A
 * customer reloading their own booking should never be throttled;
 * somebody working through the keyspace should be.
 */
export async function overLimit(
  key: string,
  limit: number,
  now: Date = new Date(),
): Promise<boolean> {
  const row = await db
    .prepare(`SELECT hits FROM rate_limit WHERE bucket = ?1`)
    .bind(hourBucket(key, now))
    .first<{ hits: number }>();
  return Number(row?.hits ?? 0) >= limit;
}

/** Count one failed attempt and return the running total for the hour. */
export async function countAttempt(key: string, now: Date = new Date()): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO rate_limit (bucket, hits, seen_at) VALUES (?1, 1, ?2)
       ON CONFLICT(bucket) DO UPDATE SET hits = rate_limit.hits + 1, seen_at = ?2
       RETURNING hits`,
    )
    .bind(hourBucket(key, now), now.toISOString())
    .first<{ hits: number }>();
  return Number(row?.hits ?? 0);
}
