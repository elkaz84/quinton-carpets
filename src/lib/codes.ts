/**
 * Reference and referral codes.
 *
 * The alphabet has no ambiguous characters, because these get read
 * out over the phone at the counter: no O/0, no I/1, no S/5.
 *
 * What a code is WORTH is decided on the server (see
 * functions/api/codes.ts). This module only mints and shape-checks.
 */

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

/** QC-DDMM-XXXX, so the shop can see the day at a glance. */
export function mintBookingRef(now: Date = new Date()): string {
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `QC-${dd}${mm}-${randomChars(4)}`;
}

export const isReferralCode = (v: string) => REFERRAL_RE.test(v.trim().toUpperCase());
export const isEstimateCode = (v: string) => ESTIMATE_RE.test(v.trim().toUpperCase());
export const isBookingRef = (v: string) => BOOKING_RE.test(v.trim().toUpperCase());
