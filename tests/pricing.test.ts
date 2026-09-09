import { describe, it, expect } from "vitest";
import {
  PRICES,
  bestRoll,
  estimate,
  usageForWidth,
  type EstimateInput,
} from "../src/lib/pricing.ts";

const HAGLEY = { name: "Hagley Twist", pricePerSqm: 24.99, widths: [4, 5], hard: false };
const LAMINATE = { name: "Wolverley Oak 8mm", pricePerSqm: 19.99, widths: null, hard: true };
const UNDERLAY = { name: "8mm PU Comfort", pricePerSqm: 4.5 };

const base = (over: Partial<EstimateInput> = {}): EstimateInput => ({
  floor: HAGLEY,
  underlay: null,
  rooms: [],
  fit: "supply",
  extras: { uplift: false, gripper: false, doorbars: false, furniture: false },
  ...over,
});

const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 2);

/**
 * Every figure the estimator returns is rounded to the penny, so an
 * expectation built from an already-rounded intermediate can sit one
 * penny away from the same figure rounded once. That is correct
 * behaviour for money — assert to the penny, not beyond it.
 */
const withinAPenny = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(0.01);

describe("roll-width costing", () => {
  // A 4.2 × 4.6m lounge is the worked example: it will not fit
  // across a 4m roll, so it needs two strips, but it drops straight
  // onto a 5m roll in one.
  const W = 4.2;
  const L = 4.6;

  it("needs two strips off a 4m roll", () => {
    // ceil(4.2 / 4) = 2 strips × 4m × (4.6 + 0.1) = 37.6 m²
    near(usageForWidth(W, L, 4), 37.6);
  });

  it("takes one drop off a 5m roll", () => {
    // 5 × (4.6 + 0.1) = 23.5 m²
    near(usageForWidth(W, L, 5), 23.5);
  });

  it("picks the 5m roll, because it is cheaper", () => {
    const got = bestRoll(W, L, [4, 5]);
    expect(got.rollWidth).toBe(5);
    near(got.usage, 23.5);
  });

  it("gives a genuine tie to the narrower roll", () => {
    // Bigger than any front room, but it is the arithmetic tie: an
    // 18m short side takes five strips of 4m or four strips of 5m,
    // and both come to 20m of width. The narrower roll wins.
    near(usageForWidth(18, 20, 4), usageForWidth(18, 20, 5));
    const got = bestRoll(18, 20, [4, 5]);
    expect(got.rollWidth).toBe(4);
    near(got.usage, 20 * 20.1);
  });

  it("never buys a wider roll than the room needs", () => {
    // Anything that fits inside 4m also fits inside 5m, but 5m wastes
    // a metre down the length — so 4m must win on cost.
    const got = bestRoll(3.2, 4.0, [4, 5]);
    expect(got.rollWidth).toBe(4);
    near(got.usage, 4 * 4.1);
  });

  it("sells hard floors by area plus 10% wastage", () => {
    const out = estimate(
      base({ floor: LAMINATE, rooms: [{ kind: "room", name: "Hall", width: 4.2, length: 4.6 }] }),
    );
    near(out.usage, 4.2 * 4.6 * 1.1); // 21.252
  });
});

describe("the worked lounge", () => {
  const lounge = { kind: "room" as const, name: "Living room", width: 4.2, length: 4.6 };

  it("charges material on roll usage, not floor area", () => {
    const out = estimate(base({ rooms: [lounge] }));
    near(out.floorArea, 19.32); // what is on the floor
    near(out.usage, 23.5); // what comes off the roll
    near(out.materials, 23.5 * 24.99); // 587.265
    expect(out.rollWidthsUsed).toEqual([5]);
  });

  it("surfaces which roll width won", () => {
    const out = estimate(base({ rooms: [lounge] }));
    const note = out.lines.find((l) => l.sub);
    expect(note?.label).toBe("Cut from 5m roll width, trim included");
  });

  it("charges underlay on floor area × 1.05, not on roll usage", () => {
    const out = estimate(base({ rooms: [lounge], underlay: UNDERLAY }));
    near(out.underlay, 19.32 * 1.05 * 4.5); // 91.287
  });
});

describe("stairs", () => {
  const stairs = { kind: "stairs" as const, name: "Stairs & landing", steps: 13 };

  it("counts 0.85 m² a step", () => {
    const out = estimate(base({ rooms: [stairs] }));
    near(out.floorArea, 13 * 0.85); // 11.05
    near(out.usage, 11.05);
    expect(out.steps).toBe(13);
  });

  it("fits stairs per step, never per square metre", () => {
    const out = estimate(base({ rooms: [stairs], fit: "fitted" }));
    near(out.fitting, 13 * PRICES.fitStair); // 104.00
    // Nothing is charged at the per-m² rate for a staircase.
    expect(out.lines.some((l) => l.label.startsWith("Fitting ·"))).toBe(false);
  });

  it("adds no perimeter or door bar for a staircase", () => {
    const out = estimate(
      base({
        rooms: [stairs],
        fit: "fitted",
        extras: { uplift: false, gripper: true, doorbars: true, furniture: false },
      }),
    );
    expect(out.perimeter).toBe(0);
    expect(out.roomCount).toBe(0);
    near(out.extras, 0);
  });
});

describe("fitting extras", () => {
  const rooms = [
    { kind: "room" as const, name: "Living room", width: 4.2, length: 4.6 },
    { kind: "stairs" as const, name: "Stairs & landing", steps: 13 },
  ];

  it("prices every extra on its own basis", () => {
    const out = estimate(
      base({
        rooms,
        fit: "fitted",
        extras: { uplift: true, gripper: true, doorbars: true, furniture: true },
      }),
    );
    const floorArea = 19.32 + 11.05;
    const perimeter = 2 * (4.2 + 4.6); // 17.6, the room only
    near(out.extras, floorArea * 2.2 + perimeter * 2.6 + 1 * 14 + 35);
  });

  it("drops the extras entirely on supply only", () => {
    const out = estimate(
      base({
        rooms,
        fit: "supply",
        extras: { uplift: true, gripper: true, doorbars: true, furniture: true },
      }),
    );
    near(out.fitting, 0);
    near(out.extras, 0);
  });
});

describe("discounts — labour only, always", () => {
  const rooms = [{ kind: "room" as const, name: "Living room", width: 4.2, length: 4.6 }];
  const fitted = base({
    rooms,
    underlay: UNDERLAY,
    fit: "fitted",
    extras: { uplift: true, gripper: true, doorbars: true, furniture: false },
  });

  const labourOf = (i: EstimateInput) => estimate(i).labour;

  it("takes a friend's 10% off the fitting and nothing else", () => {
    const plain = estimate(fitted);
    const out = estimate({
      ...fitted,
      discount: { valid: true, kind: "referral", percentOff: 10, message: "Friend's referral code — 10% off fitting" },
    });
    withinAPenny(out.discount, plain.labour * 0.1);
    near(out.materials, plain.materials); // materials never move
    withinAPenny(out.total, plain.subtotal - plain.labour * 0.1);
  });

  it("takes an earned reward at 20% of the fitting", () => {
    const out = estimate({
      ...fitted,
      discount: { valid: true, kind: "reward", percentOff: 20, message: "Your referral reward — 20% off fitting" },
    });
    withinAPenny(out.discount, labourOf(fitted) * 0.2);
  });

  it("takes WINTER10 off the fitting", () => {
    const out = estimate({
      ...fitted,
      discount: { valid: true, kind: "promo", percentOff: 10, message: "WINTER10 applied — 10% off fitting." },
    });
    withinAPenny(out.discount, labourOf(fitted) * 0.1);
  });

  it("takes NEWFLOOR25 off the order as a flat £25", () => {
    const out = estimate({
      ...fitted,
      discount: { valid: true, kind: "promo", amountOff: 25, message: "NEWFLOOR25 applied — £25 off your order." },
    });
    near(out.discount, 25);
  });

  it("never discounts a supply-only order, because there is no labour", () => {
    const supplyOnly = { ...fitted, fit: "supply" as const };
    const out = estimate({
      ...supplyOnly,
      discount: { valid: true, kind: "referral", percentOff: 10, message: "10% off fitting" },
    });
    near(out.discount, 0);
    near(out.total, estimate(supplyOnly).subtotal);
  });

  it("never takes more off than the order is worth", () => {
    const tiny = base({
      rooms: [{ kind: "room", name: "Cupboard", width: 0.5, length: 0.5 }],
      floor: { name: "Offcut", pricePerSqm: 1, widths: [4], hard: false },
      discount: { valid: true, kind: "promo", amountOff: 25, message: "£25 off" },
    });
    const out = estimate(tiny);
    expect(out.total).toBeGreaterThanOrEqual(0);
    near(out.discount, out.subtotal);
  });

  it("ignores a verdict the server rejected", () => {
    const out = estimate({
      ...fitted,
      discount: {
        valid: false,
        kind: "none",
        message: "That's your own code — pass it to a friend and the 20% comes back to you.",
      },
    });
    near(out.discount, 0);
    expect(out.discountLabel).toBe("");
  });
});

describe("the post-measure range", () => {
  it("brackets the estimate at 0.94× and 1.09×", () => {
    const out = estimate(
      base({ rooms: [{ kind: "room", name: "Living room", width: 4.2, length: 4.6 }] }),
    );
    withinAPenny(out.rangeLow, out.total * 0.94);
    withinAPenny(out.rangeHigh, out.total * 1.09);
    expect(out.rangeLow).toBeLessThan(out.total);
    expect(out.rangeHigh).toBeGreaterThan(out.total);
  });
});

describe("empty and daft inputs", () => {
  it("costs nothing with no rooms", () => {
    const out = estimate(base());
    near(out.total, 0);
  });

  it("ignores a room with no size yet", () => {
    const out = estimate(base({ rooms: [{ kind: "room", name: "Room 2", width: 0, length: 3 }] }));
    near(out.usage, 0);
    expect(out.roomCount).toBe(0);
  });
});
