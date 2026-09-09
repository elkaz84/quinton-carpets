import { describe, it, expect } from "vitest";
import {
  addDaysISO,
  dayOfWeek,
  isBookableDate,
  isBookableSlot,
  longDate,
  monthGrid,
  parseISO,
  slotsFor,
  todayISO,
} from "../src/lib/dates.ts";

// A fixed Tuesday, so these never go stale.
const NOW = new Date("2026-09-08T09:00:00Z");
const TODAY = "2026-09-08";

describe("today, in the shop's timezone", () => {
  it("uses Europe/London, not the machine's clock", () => {
    // 23:30 UTC on 7 September is already the 8th in British Summer Time.
    expect(todayISO(new Date("2026-09-07T23:30:00Z"))).toBe("2026-09-08");
  });

  it("does not roll the day over early in winter", () => {
    // In January, London is UTC, so 23:30 is still the 7th.
    expect(todayISO(new Date("2026-01-07T23:30:00Z"))).toBe("2026-01-07");
  });
});

describe("parsing", () => {
  it("rejects a date that does not exist", () => {
    expect(parseISO("2026-02-31")).toBeNull();
    expect(parseISO("2026-13-01")).toBeNull();
    expect(parseISO("not a date")).toBeNull();
  });

  it("reads a real date", () => {
    expect(parseISO("2026-09-08")).toEqual({ y: 2026, m: 9, d: 8 });
  });
});

describe("which days can be booked", () => {
  it("takes today", () => {
    expect(isBookableDate(TODAY, NOW)).toBe(true);
  });

  it("refuses yesterday", () => {
    expect(isBookableDate("2026-09-07", NOW)).toBe(false);
  });

  it("takes the last day of the 60-day horizon", () => {
    expect(isBookableDate(addDaysISO(TODAY, 60), NOW)).toBe(true);
  });

  it("refuses the day after the horizon", () => {
    expect(isBookableDate(addDaysISO(TODAY, 61), NOW)).toBe(false);
  });
});

describe("Sunday drops the Late window", () => {
  // 13 September 2026 is a Sunday.
  const SUNDAY = "2026-09-13";
  const SATURDAY = "2026-09-12";

  it("knows which day is Sunday", () => {
    expect(dayOfWeek(SUNDAY)).toBe(0);
    expect(dayOfWeek(SATURDAY)).toBe(6);
  });

  it("offers all three windows on a Saturday", () => {
    expect(slotsFor(SATURDAY).every((s) => s.available)).toBe(true);
  });

  it("offers morning and afternoon on a Sunday, but not Late", () => {
    const slots = slotsFor(SUNDAY);
    expect(slots.find((s) => s.key === "am")?.available).toBe(true);
    expect(slots.find((s) => s.key === "pm")?.available).toBe(true);
    // The shop shuts at 4pm on a Sunday, so a 4–6pm slot cannot happen.
    expect(slots.find((s) => s.key === "eve")?.available).toBe(false);
  });

  it("refuses a Sunday Late booking on the server too", () => {
    expect(isBookableSlot(SUNDAY, "eve", NOW)).toBe(false);
    expect(isBookableSlot(SUNDAY, "am", NOW)).toBe(true);
    expect(isBookableSlot(SATURDAY, "eve", NOW)).toBe(true);
  });

  it("refuses a slot that isn't one of ours", () => {
    expect(isBookableSlot(SATURDAY, "midnight", NOW)).toBe(false);
  });
});

describe("the calendar grid", () => {
  it("starts the week on Monday", () => {
    // 1 September 2026 is a Tuesday, so one blank leads the grid.
    expect(monthGrid(2026, 9, NOW).lead).toBe(1);
  });

  it("has the right number of days", () => {
    expect(monthGrid(2026, 9, NOW).days).toHaveLength(30);
    expect(monthGrid(2026, 2, NOW).days).toHaveLength(28);
    expect(monthGrid(2028, 2, NOW).days).toHaveLength(29);
  });

  it("greys out days in the past", () => {
    const { days } = monthGrid(2026, 9, NOW);
    expect(days.find((d) => d.iso === "2026-09-07")?.bookable).toBe(false);
    expect(days.find((d) => d.iso === "2026-09-08")?.bookable).toBe(true);
  });
});

describe("how a date reads", () => {
  it("writes it out the British way", () => {
    // en-GB puts a comma after the weekday, same as the prototype did.
    expect(longDate("2026-09-08")).toBe("Tuesday, 8 September 2026");
  });
});
