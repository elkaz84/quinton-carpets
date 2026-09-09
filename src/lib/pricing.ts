/**
 * The estimator maths, as a pure module.
 *
 * This is the part that has to match what a fitter would work out
 * on the counter, so it takes no DOM, no fetch and no clock — give
 * it an input, get the same answer every time. Everything the shop
 * can change lives in PRICES.
 *
 * Guide prices only. Nothing this file produces is a quote.
 */

export type RollWidths = readonly number[] | null;

export interface RateCard {
  /** £/m² to fit a soft floor. */
  fitCarpet: number;
  /** £/m² to fit laminate & LVT. */
  fitHard: number;
  /** £ per step. */
  fitStair: number;
  /** £/m² of floor area. */
  uplift: number;
  /** £ per linear metre of perimeter. */
  gripper: number;
  /** £ each, one per room. */
  doorbar: number;
  /** £ flat. */
  furniture: number;
  /** Metres added to the run length for trimming. */
  trim: number;
  /** × area for laminate / LVT. */
  wastageHard: number;
  /** Underlay is charged on floor area × this, not on roll usage. */
  underlayAllowance: number;
  /** m² of carpet per stair step. */
  stairArea: number;
}

/**
 * PLACEHOLDERS pending the shop's real rates. Item 3 on the
 * client's pre-launch list is confirming every one of these so the
 * estimator matches the counter.
 */
export const PRICES: RateCard = {
  fitCarpet: 5.5,
  fitHard: 9.5,
  fitStair: 8.0,
  uplift: 2.2,
  gripper: 2.6,
  doorbar: 14.0,
  furniture: 35.0,
  trim: 0.1,
  wastageHard: 1.1,
  underlayAllowance: 1.05,
  stairArea: 0.85,
};

export type RoomInput =
  | { kind: "room"; name: string; width: number; length: number }
  | { kind: "stairs"; name: string; steps: number };

export interface EstimateInput {
  /** £/m² and roll widths of the chosen floor. */
  floor: { name: string; pricePerSqm: number; widths: RollWidths; hard: boolean };
  /** null when the customer is re-using what is already down. */
  underlay: { name: string; pricePerSqm: number } | null;
  rooms: RoomInput[];
  fit: "fitted" | "supply";
  extras: { uplift: boolean; gripper: boolean; doorbars: boolean; furniture: boolean };
  /** Already validated by the server. The client never decides what a code is worth. */
  discount?: DiscountVerdict | null;
  rates?: RateCard;
}

/** What the Worker sends back when a code is checked. */
export interface DiscountVerdict {
  valid: boolean;
  kind: "referral" | "reward" | "promo" | "none";
  percentOff?: number;
  amountOff?: number;
  message: string;
  code?: string;
}

export interface Line {
  /** How this line was reached, in words. */
  label: string;
  amount: number;
  /** A sub-line carries an explanation, not a figure. */
  sub?: boolean;
}

export interface Estimate {
  lines: Line[];
  /** m² of floor, actual. */
  floorArea: number;
  /** m² actually cut off the roll, which is the number that gets charged. */
  usage: number;
  perimeter: number;
  steps: number;
  roomCount: number;
  /** Which roll width won, per room. Surfaced in the summary. */
  rollWidthsUsed: number[];
  materials: number;
  underlay: number;
  fitting: number;
  extras: number;
  /** Fitting + fitting extras. Discounts only ever apply to this. */
  labour: number;
  subtotal: number;
  discount: number;
  discountLabel: string;
  /** The headline figure. Includes VAT. */
  total: number;
  /** Realistic post-measure range: 0.94× to 1.09×. */
  rangeLow: number;
  rangeHigh: number;
}

const round2 = (n: number) => Math.round(n * 1e2) / 1e2;

/**
 * How much material a room actually eats off a roll of width R.
 *
 * A fitter does not buy your floor area, they buy a length off a
 * roll — so a 4.2m-wide room on a 4m roll needs two strips, and the
 * off-cut is still paid for.
 */
export function usageForWidth(
  width: number,
  length: number,
  rollWidth: number,
  rates: RateCard = PRICES,
): number {
  const short = Math.min(width, length);
  const long = Math.max(width, length);
  const run = long + rates.trim;
  if (short <= rollWidth) return rollWidth * run;
  return Math.ceil(short / rollWidth) * rollWidth * run;
}

/**
 * Cheapest roll width for a room, ties going to the narrower one.
 * Widths are compared in ascending order so the first width to
 * achieve the minimum wins.
 */
export function bestRoll(
  width: number,
  length: number,
  widths: readonly number[],
  rates: RateCard = PRICES,
): { rollWidth: number; usage: number } {
  const ordered = [...widths].sort((a, b) => a - b);
  let bestWidth = ordered[0]!;
  let bestUsage = Infinity;
  for (const R of ordered) {
    const u = usageForWidth(width, length, R, rates);
    // Strictly cheaper only, so an equal result leaves the narrower roll in place.
    if (u < bestUsage - 1e-9) {
      bestUsage = u;
      bestWidth = R;
    }
  }
  return { rollWidth: bestWidth, usage: bestUsage };
}

/** Material a single room needs. Hard floors are sold by area plus wastage. */
export function usageForRoom(
  room: RoomInput,
  widths: RollWidths,
  rates: RateCard = PRICES,
): { usage: number; rollWidth: number | null } {
  if (room.kind === "stairs") {
    return { usage: Math.max(0, room.steps) * rates.stairArea, rollWidth: null };
  }
  const { width, length } = room;
  if (!(width > 0 && length > 0)) return { usage: 0, rollWidth: null };
  if (!widths || widths.length === 0) {
    return { usage: width * length * rates.wastageHard, rollWidth: null };
  }
  const { rollWidth, usage } = bestRoll(width, length, widths, rates);
  return { usage, rollWidth };
}

export function estimate(input: EstimateInput): Estimate {
  const rates = input.rates ?? PRICES;
  const { floor, underlay } = input;

  const lines: Line[] = [];
  let floorArea = 0;
  let usage = 0;
  let steps = 0;
  let perimeter = 0;
  let roomCount = 0;
  const rollWidthsUsed = new Set<number>();

  for (const room of input.rooms) {
    if (room.kind === "stairs") {
      const n = Math.max(0, room.steps || 0);
      steps += n;
      floorArea += n * rates.stairArea;
      usage += usageForRoom(room, floor.widths, rates).usage;
      continue;
    }
    const area = (room.width || 0) * (room.length || 0);
    if (area <= 0) continue;
    floorArea += area;
    roomCount += 1;
    perimeter += 2 * ((room.width || 0) + (room.length || 0));
    const got = usageForRoom(room, floor.widths, rates);
    usage += got.usage;
    if (got.rollWidth) rollWidthsUsed.add(got.rollWidth);
  }

  // --- material ---
  const materials = usage * floor.pricePerSqm;
  lines.push({ label: `${floor.name} · ${usage.toFixed(1)} m² cut`, amount: materials });

  const widthsUsed = [...rollWidthsUsed].sort((a, b) => a - b);
  if (widthsUsed.length) {
    lines.push({
      label: `Cut from ${widthsUsed.map((w) => `${w}m`).join(" and ")} roll width, trim included`,
      amount: 0,
      sub: true,
    });
  }

  // --- underlay, on actual floor area, never on roll usage ---
  let underlayCost = 0;
  if (underlay) {
    const underlayArea = floorArea * rates.underlayAllowance;
    underlayCost = underlayArea * underlay.pricePerSqm;
    lines.push({
      label: `${underlay.name} · ${underlayArea.toFixed(1)} m²`,
      amount: underlayCost,
    });
  }

  // --- fitting and fitting extras ---
  let fitting = 0;
  let extras = 0;
  if (input.fit === "fitted") {
    const roomArea = floorArea - steps * rates.stairArea;
    const rate = floor.hard ? rates.fitHard : rates.fitCarpet;
    const fitRooms = roomArea * rate;
    const fitStairs = steps * rates.fitStair;

    if (fitRooms > 0) {
      lines.push({
        label: `Fitting · ${roomArea.toFixed(1)} m² @ ${money(rate)}`,
        amount: fitRooms,
      });
    }
    if (fitStairs > 0) {
      lines.push({
        label: `Stair fitting · ${steps} steps @ ${money(rates.fitStair)}`,
        amount: fitStairs,
      });
    }
    fitting = fitRooms + fitStairs;

    if (input.extras.uplift) {
      const c = floorArea * rates.uplift;
      extras += c;
      lines.push({ label: "Uplift & disposal", amount: c });
    }
    if (input.extras.gripper) {
      const c = perimeter * rates.gripper;
      extras += c;
      lines.push({ label: `Gripper · ${perimeter.toFixed(1)} lin m`, amount: c });
    }
    if (input.extras.doorbars && roomCount) {
      const c = roomCount * rates.doorbar;
      extras += c;
      lines.push({ label: `Door bars × ${roomCount}`, amount: c });
    }
    if (input.extras.furniture) {
      extras += rates.furniture;
      lines.push({ label: "Moving the furniture", amount: rates.furniture });
    }
  }

  const subtotal = materials + underlayCost + fitting + extras;
  const labour = fitting + extras;

  // --- discount: labour only, always. Materials are already at the
  //     shop's best price and never discount. ---
  let discount = 0;
  let discountLabel = "";
  const d = input.discount;
  if (d && d.valid) {
    if (d.percentOff && labour > 0) {
      discount = labour * (d.percentOff / 100);
      discountLabel = d.message;
    } else if (d.amountOff) {
      discount = Math.min(d.amountOff, subtotal);
      discountLabel = d.message;
    }
  }

  const total = Math.max(0, subtotal - discount);

  return {
    lines,
    floorArea: round2(floorArea),
    usage: round2(usage),
    perimeter: round2(perimeter),
    steps,
    roomCount,
    rollWidthsUsed: widthsUsed,
    materials: round2(materials),
    underlay: round2(underlayCost),
    fitting: round2(fitting),
    extras: round2(extras),
    labour: round2(labour),
    subtotal: round2(subtotal),
    discount: round2(discount),
    discountLabel,
    total: round2(total),
    rangeLow: round2(total * 0.94),
    rangeHigh: round2(total * 1.09),
  };
}

/** British English, prices to two decimals. */
export function money(n: number): string {
  return (
    "£" +
    n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

/** Rounded, for the "typical range once measured" line. */
export function moneyRound(n: number): string {
  return "£" + Math.round(n).toLocaleString("en-GB");
}

/** Areas to one decimal with the unit attached. */
export function area(n: number): string {
  return `${n.toFixed(1)} m²`;
}
