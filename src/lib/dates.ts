/**
 * Dates, in the shop's timezone.
 *
 * The site is served from edge machines running on UTC. The shop is
 * in Birmingham, which is an hour ahead for half the year — so
 * "today" is worked out in Europe/London, not wherever the request
 * happened to land. Getting this wrong offers someone a slot in the
 * past at half eleven at night in July.
 */

export const TZ = "Europe/London";

/** How far ahead the diary is open. */
export const HORIZON_DAYS = 60;

export type SlotKey = "am" | "pm" | "eve";

export const SLOTS: ReadonlyArray<{ key: SlotKey; title: string; when: string }> = [
  { key: "am", title: "Morning", when: "10am – 1pm" },
  { key: "pm", title: "Afternoon", when: "1pm – 4pm" },
  { key: "eve", title: "Late", when: "4pm – 6pm" },
];

const ymdFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-09-08" for a moment in time, in the shop's timezone. */
export function todayISO(now: Date = new Date()): string {
  return ymdFmt.format(now);
}

/** Parse "2026-09-08" into its parts without touching local time. */
export function parseISO(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Round-trip through UTC to reject 31 February and friends.
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, m: mo, d };
}

export const toISO = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Day of week, 0 = Sunday, for a plain date string. */
export function dayOfWeek(iso: string): number {
  const p = parseISO(iso);
  if (!p) return -1;
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

export const addDaysISO = (iso: string, days: number): string => {
  const p = parseISO(iso)!;
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d) + days * 86400000);
  return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
};

/** Is this date one we can actually send a fitter out on? */
export function isBookableDate(iso: string, now: Date = new Date()): boolean {
  if (!parseISO(iso)) return false;
  const today = todayISO(now);
  return iso >= today && iso <= addDaysISO(today, HORIZON_DAYS);
}

/**
 * Sunday drops the Late window, because the shop closes at 4pm.
 * Never offer a slot that cannot happen.
 */
export function slotsFor(iso: string): ReadonlyArray<{ key: SlotKey; title: string; when: string; available: boolean }> {
  const sunday = dayOfWeek(iso) === 0;
  return SLOTS.map((s) => ({ ...s, available: !(sunday && s.key === "eve") }));
}

export function isBookableSlot(iso: string, slot: string, now: Date = new Date()): boolean {
  if (!isBookableDate(iso, now)) return false;
  const found = slotsFor(iso).find((s) => s.key === slot);
  return !!found?.available;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const monthName = (m: number) => MONTHS[m - 1]!;

/** The grid for one month: leading blanks, then every day with its state. */
export function monthGrid(year: number, month: number, now: Date = new Date()) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  // Monday-first, the way a British calendar reads.
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toISO(year, month, d);
    days.push({ day: d, iso, bookable: isBookableDate(iso, now) });
  }
  return { lead, days };
}

/** "Tuesday 8 September 2026" */
export function longDate(iso: string): string {
  const p = parseISO(iso);
  if (!p) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(p.y, p.m - 1, p.d)));
}

/** "Tuesday 8 September" — no year, for the picker hint. */
export function shortDate(iso: string): string {
  const p = parseISO(iso);
  if (!p) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(p.y, p.m - 1, p.d)));
}

export const slotLabel = (key: string): string => {
  const s = SLOTS.find((x) => x.key === key);
  return s ? `${s.title} (${s.when})` : key;
};
