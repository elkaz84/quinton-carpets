/**
 * POST /api/codes — what is this code worth?
 *
 * The code table lives here, on the server. The browser posts a
 * code and gets back a verdict; it never holds the rules and never
 * decides a discount for itself.
 *
 * Discounts apply to LABOUR ONLY — fitting and fitting extras.
 * Materials are already at the shop's best price and never discount.
 */

import type { APIRoute } from "astro";
import { json, clientIp, rateLimit } from "../../lib/server/env.ts";

export const prerender = false;

interface Verdict {
  valid: boolean;
  kind: "referral" | "reward" | "promo" | "none";
  percentOff?: number;
  amountOff?: number;
  message: string;
  code?: string;
}

const REFERRAL_RE = /^QC-REF-[A-Z0-9]{4}$/;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const ip = clientIp(request);

  // Guessing four characters is not worth anyone's time, but there
  // is no reason to let a script sit there trying.
  if (!(await rateLimit(env.DB, `codes:${ip}`, 30))) {
    return json({
      valid: false,
      kind: "none",
      message: "Too many tries. Bring the code into the shop and we'll apply it.",
    } satisfies Verdict, 429);
  }

  let code = "";
  let ownerRef = "";
  try {
    const body = (await request.json()) as { code?: string; ownerRef?: string };
    code = (body.code ?? "").trim().toUpperCase();
    ownerRef = (body.ownerRef ?? "").trim().toUpperCase();
  } catch {
    return json({ valid: false, kind: "none", message: "We didn't catch that code." } satisfies Verdict, 400);
  }

  if (!code) {
    return json({ valid: false, kind: "none", message: "Type a code in first." } satisfies Verdict);
  }

  /* ---- a referral code ---- */
  if (REFERRAL_RE.test(code)) {
    const row = await env.DB.prepare(
      `SELECT code, owner_ref, reward_earned FROM referral_codes WHERE code = ?1`,
    )
      .bind(code)
      .first<{ code: string; owner_ref: string; reward_earned: number }>();

    if (!row) {
      return json({
        valid: false,
        kind: "none",
        message: "We don't recognise that code. Referral codes look like QC-REF-7T4M.",
      } satisfies Verdict);
    }

    // Using your own code is refused, and the refusal says what to
    // do with it instead.
    if (ownerRef && ownerRef === row.owner_ref) {
      return json({
        valid: false,
        kind: "none",
        message: "That's your own code — pass it to a friend and the 20% comes back to you.",
      } satisfies Verdict);
    }

    // A code whose owner has earned their reward is worth 20% to the
    // owner. Used by anyone else it is the friend's 10%.
    if (row.reward_earned === 1) {
      return json({
        valid: true,
        kind: "reward",
        percentOff: 20,
        code,
        message: "Your referral reward — 20% off fitting",
      } satisfies Verdict);
    }

    return json({
      valid: true,
      kind: "referral",
      percentOff: 10,
      code,
      message: "Friend's referral code — 10% off fitting",
    } satisfies Verdict);
  }

  /* ---- a seasonal promotion ---- */
  const promo = await env.DB.prepare(
    `SELECT code, percent_off, amount_off, message, expires_at
       FROM promo_codes WHERE code = ?1 AND active = 1`,
  )
    .bind(code)
    .first<{
      code: string;
      percent_off: number | null;
      amount_off: number | null;
      message: string;
      expires_at: string | null;
    }>();

  if (promo && (!promo.expires_at || promo.expires_at >= new Date().toISOString().slice(0, 10))) {
    return json({
      valid: true,
      kind: "promo",
      ...(promo.percent_off ? { percentOff: promo.percent_off } : {}),
      ...(promo.amount_off ? { amountOff: promo.amount_off } : {}),
      code,
      message: promo.message,
    } satisfies Verdict);
  }

  return json({
    valid: false,
    kind: "none",
    message: "We don't recognise that code. Referral codes look like QC-REF-7T4M.",
  } satisfies Verdict);
};
