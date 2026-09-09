/**
 * POST /api/bookings — the only endpoint that writes a booking.
 *
 * No payment is taken here or anywhere else on the site. This
 * stores a request for a free measure, tells the shop about it, and
 * that is all.
 */

import type { APIRoute } from "astro";
import { json, clientIp, rateLimit, getEnv, after } from "../../lib/server/env.ts";
import { db } from "../../lib/server/db.ts";
import { validateBooking } from "../../lib/server/validate.ts";
import { shopEmail, customerEmail } from "../../lib/server/email.ts";
import { mintBookingRef, mintReferralCode } from "../../lib/codes.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const now = new Date();
  const env = getEnv();
  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");

  // Accept both a JSON fetch and a plain form post, so the page
  // still works if the island never loads.
  let raw: Record<string, unknown>;
  try {
    const type = request.headers.get("content-type") ?? "";
    raw = type.includes("application/json")
      ? ((await request.json()) as Record<string, unknown>)
      : (Object.fromEntries(await request.formData()) as Record<string, unknown>);
  } catch {
    return json({ error: "We couldn't read that form. Please try again." }, 400);
  }

  const ip = clientIp(request);
  if (!(await rateLimit(ip, 8, now))) {
    return json(
      { error: "That's a few too many bookings from here. Please ring the shop on 0121 423 3322." },
      429,
    );
  }

  const check = validateBooking(raw, now);
  if (!check.ok) {
    return json({ error: check.error, field: check.field }, 400);
  }
  const b = check.value;

  // A reference collision is vanishingly unlikely, but the column is
  // a primary key, so try again rather than fail the customer.
  let ref = "";
  let referralCode = "";
  let saved = false;
  for (let attempt = 0; attempt < 5 && !saved; attempt++) {
    ref = mintBookingRef(now);
    referralCode = mintReferralCode();
    try {
      await db.batch([
        db.prepare(
          `INSERT INTO bookings
             (ref, name, phone, email, address, postcode, estimate_code,
              referred_by, date, slot, notes, created_at, status)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'new')`,
        ).bind(
          ref,
          b.name,
          b.phone,
          b.email,
          b.address,
          b.postcode,
          b.estimate ?? null,
          b.referral ?? null,
          b.date,
          b.slot,
          b.notes ?? null,
          now.toISOString(),
        ),
        db.prepare(
          `INSERT INTO referral_codes (code, owner_ref, redemptions, created_at)
           VALUES (?1, ?2, 0, ?3)`,
        ).bind(referralCode, ref, now.toISOString()),
      ]);
      saved = true;
    } catch (err) {
      if (attempt === 4) {
        console.error("booking insert failed", err);
        return json(
          { error: "We couldn't save that booking. Please ring the shop on 0121 423 3322." },
          500,
        );
      }
    }
  }

  // A friend's code being used is recorded here. Whether the reward
  // is actually earned is decided by the shop when the job is paid,
  // never by the site.
  if (b.referral) {
    after(
      db.prepare(`UPDATE referral_codes SET redemptions = redemptions + 1 WHERE code = ?1`)
        .bind(b.referral)
        .run()
        .catch((e: unknown) => console.error("referral count failed", e)),
    );
  }

  // The booking is saved. Email is best-effort from here — a mail
  // provider having a bad morning must never lose someone's slot.
  const payload = { ...b, ref, referralCode };
  after(
    Promise.allSettled([shopEmail(env, payload), customerEmail(env, payload)]).then((rs) =>
      rs.forEach((r) => {
        if (r.status === "rejected") console.error("email failed", r.reason);
        else if (!r.value.sent) console.warn("email not sent:", r.value.reason);
      }),
    ),
  );

  // A no-JavaScript post gets sent to its own booking page.
  if (!wantsJson) {
    return new Response(null, { status: 303, headers: { location: `/booking/${ref}/` } });
  }
  return json({ ref, referralCode });
};

/** Anything else here is a mistake, and says so plainly. */
export const ALL: APIRoute = () =>
  json({ error: "Send a booking with POST." }, 405, { allow: "POST" });
