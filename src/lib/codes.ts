/**
 * Reference and referral codes.
 *
 * The alphabet drops the letter/digit pairs that get misheard at the
 * counter: no O/0 and no I/1. S and 5 are both kept, which is a real
 * trade-off — 32 characters means `byte % 32` is perfectly uniform,
 * and dropping a pair would put a modulo bias into every code unless
 * randomChars were rewritten to reject out-of-range bytes.
 *
 * What a code is WORTH is decided on the server (see
 * src/pages/api/codes.ts). This module only mints and shape-checks.
 */

import { todayISO } from "./dates.ts";

export const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const REFERRAL_RE = /^QC-REF-[A-Z0-9]{4}$/;
export const ESTIMATE_RE = /^QC-EST-[A-Z0-9]{5}$/;
export const BOOKING_RE = /^QC-\d{4}-[A-Z0-9]{4}$/;

function randomChars(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

/** QC-REF-7T4M */
export function mintReferralCode(): string {
  return `QC-REF-${randomChars(4)}`;
}

/** QC-EST-4K7QW */
export function mintEstimateCode(): string {
  return `QC-EST-${randomChars(5)}`;
}

/**
 * QC-DDMM-XXXX, so the shop can see the day at a glance.
 *
 * The day is the Europe/London one, not the server's. getDate() would
 * read UTC on a hosted runtime, which between midnight and 1am BST
 * stamps a booking with yesterday — the exact thing this reference
 * exists to make obvious.
 */
export function mintBookingRef(now: Date = new Date()): string {
  const [, mm, dd] = todayISO(now).split("-");
  return `QC-${dd}${mm}-${randomChars(4)}`;
}

export const isReferralCode = (v: string) => REFERRAL_RE.test(v.trim().toUpperCase());
export const isEstimateCode = (v: string) => ESTIMATE_RE.test(v.trim().toUpperCase());
export const isBookingRef = (v: string) => BOOKING_RE.test(v.trim().toUpperCase());
