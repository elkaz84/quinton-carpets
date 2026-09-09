/**
 * GET   /api/bookings/:ref — a customer reading their own booking.
 * PATCH /api/bookings/:ref — staff only, behind the same basic auth
 *                            as /admin/.
 *
 * The only things PATCH can change are the status and whether a
 * referral reward has been earned. Redemption is confirmed by the
 * shop; the site never decides it.
 */

import type { APIRoute } from "astro";
import { json, getEnv } from "../../../lib/server/env.ts";
import type { Env } from "../../../lib/server/env.ts";
import { db } from "../../../lib/server/db.ts";

export const prerender = false;

const REF_RE = /^QC-\d{4}-[A-Z0-9]{4}$/;
const STATUSES = ["new", "called", "measured", "fitted"] as const;
type Status = (typeof STATUSES)[number];

/** Compares in constant time, so a wrong password leaks nothing by timing. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function staff(request: Request, env: Env): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD || !header.startsWith("Basic ")) return false;
  try {
    const [u, p] = atob(header.slice(6)).split(":");
    return same(u ?? "", env.ADMIN_USER) && same(p ?? "", env.ADMIN_PASSWORD);
  } catch {
    return false;
  }
}

export const GET: APIRoute = async ({ params }) => {
  const ref = String(params.ref ?? "").toUpperCase();
  if (!REF_RE.test(ref)) return json({ error: "That isn't a booking reference." }, 400);

  const row = await db.prepare(
    `SELECT b.ref, b.name, b.date, b.slot, b.status, r.code AS referral_code, r.redemptions
       FROM bookings b LEFT JOIN referral_codes r ON r.owner_ref = b.ref
      WHERE b.ref = ?1`,
  )
    .bind(ref)
    .first();

  if (!row) return json({ error: "We can't find that reference." }, 404);
  return json(row, 200, { "cache-control": "no-store" });
};

export const PATCH: APIRoute = async ({ request, params }) => {
  const env = getEnv();

  if (!staff(request, env)) {
    return json({ error: "Staff only." }, 401, {
      "www-authenticate": 'Basic realm="Quinton Carpets diary", charset="UTF-8"',
    });
  }

  const ref = String(params.ref ?? "").toUpperCase();
  if (!REF_RE.test(ref)) return json({ error: "That isn't a booking reference." }, 400);

  let body: { status?: string; rewardEarned?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Couldn't read that." }, 400);
  }

  const statements = [];

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as Status)) {
      return json({ error: `Status must be one of: ${STATUSES.join(", ")}.` }, 400);
    }
    statements.push(
      db.prepare(`UPDATE bookings SET status = ?1 WHERE ref = ?2`).bind(body.status, ref),
    );
  }

  // Marking a referred job as paid is what turns the referrer's code
  // into their 20%. A person in the shop does this, not the site.
  if (body.rewardEarned !== undefined) {
    statements.push(
      db.prepare(
        `UPDATE referral_codes SET reward_earned = ?1
          WHERE code = (SELECT referred_by FROM bookings WHERE ref = ?2)`,
      ).bind(body.rewardEarned ? 1 : 0, ref),
    );
  }

  if (!statements.length) return json({ error: "Nothing to change." }, 400);

  await db.batch(statements);
  return json({ ref, ok: true }, 200, { "cache-control": "no-store" });
};
