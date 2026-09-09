import { describe, it, expect } from "vitest";
import {
  mintBookingRef,
  mintReferralCode,
  mintEstimateCode,
  isBookingRef,
  isReferralCode,
  isEstimateCode,
  ALPHABET,
} from "../src/lib/codes.ts";

describe("minting", () => {
  it("mints references in the shapes the site checks for", () => {
    expect(isBookingRef(mintBookingRef())).toBe(true);
    expect(isReferralCode(mintReferralCode())).toBe(true);
    expect(isEstimateCode(mintEstimateCode())).toBe(true);
  });

  it("drops the letter/digit pairs that get misheard over the phone", () => {
    for (const c of "O0I1") expect(ALPHABET).not.toContain(c);
  });

  // 256 % 32 === 0, so `byte % ALPHABET.length` is uniform. Dropping a
  // further pair would make it 30 and bias every code toward the first
  // sixteen characters, so the length is load-bearing.
  it("is 32 characters, which keeps the modulo unbiased", () => {
    expect(ALPHABET.length).toBe(32);
    expect(256 % ALPHABET.length).toBe(0);
  });
});

describe("the day stamped on a booking reference", () => {
  // 00:30 on 10 September in London is 23:30 on the 9th in UTC. The
  // server runs UTC, so a reference built from getDate() would say the
  // 9th to a customer who booked on the 10th.
  it("is the London day, not the server's, just after midnight in summer", () => {
    const justAfterMidnightBST = new Date("2026-09-09T23:30:00Z");
    expect(mintBookingRef(justAfterMidnightBST)).toMatch(/^QC-1009-/);
  });

  // And the other side of the same boundary: 23:30 London on the 10th
  // is still the 10th in UTC, so both agree here.
  it("agrees with UTC when the London day has not rolled over", () => {
    const lateEvening = new Date("2026-09-10T22:30:00Z");
    expect(mintBookingRef(lateEvening)).toMatch(/^QC-1009-/);
  });

  it("stamps the ordinary daytime case correctly", () => {
    expect(mintBookingRef(new Date("2026-09-10T09:00:00Z"))).toMatch(/^QC-1009-/);
  });

  // Winter, when London is UTC and there is no offset to get wrong.
  it("is correct in winter too", () => {
    expect(mintBookingRef(new Date("2026-01-05T00:30:00Z"))).toMatch(/^QC-0501-/);
  });
});
