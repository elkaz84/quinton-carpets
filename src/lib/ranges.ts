import { getCollection, type CollectionEntry } from "astro:content";

export type RangeEntry = CollectionEntry<"ranges">;

export interface Range {
  id: string;
  name: string;
  material: "Carpet" | "Laminate" | "Vinyl" | "Underlay";
  spec: string;
  price: number;
  grade: string;
  /** "Heavy domestic · Class 23" → "Class 23", for the tight showcase card. */
  gradeShort: string;
  rooms: string[];
  widths: number[] | null;
  pile: import("./textures.ts").Pile;
  colours: string[];
  order: number;
  showcase?: number;
  body: string;
  /**
   * The photograph, once it exists. While it is absent the CSS
   * texture in textures.ts stands in — that is the whole point of
   * those, and they stay as the fallback range by range.
   */
  photo?: ImageMetadata;
  /** Laminate and LVT are fitted at the hard-floor rate and sold by area. */
  hard: boolean;
}

export const MATERIALS = ["Carpet", "Laminate", "Vinyl", "Underlay"] as const;
export const ROOMS = ["Living", "Bedroom", "Stairs", "Hall", "Kitchen", "Bathroom"] as const;

function toRange(e: RangeEntry): Range {
  const d = e.data;
  const parts = d.grade.split("·");
  return {
    id: e.id,
    name: d.name,
    material: d.material,
    spec: d.spec,
    price: d.price,
    grade: d.grade,
    gradeShort: (parts[parts.length - 1] ?? d.grade).trim(),
    rooms: [...d.rooms],
    widths: d.widths ? [...d.widths] : null,
    pile: d.pile,
    colours: [...d.colours],
    order: d.order,
    showcase: d.showcase,
    photo: d.photo,
    body: e.body?.trim() ?? "",
    // Sheet vinyl comes off a roll like carpet; LVT and laminate do not.
    hard: d.material === "Laminate" || (d.material === "Vinyl" && d.widths === null),
  };
}

export async function allRanges(): Promise<Range[]> {
  const entries = await getCollection("ranges");
  return entries.map(toRange).sort((a, b) => a.order - b.order);
}

/** Everything a customer can put on a floor — underlay is priced separately. */
export const floorRanges = (all: Range[]) => all.filter((r) => r.material !== "Underlay");
export const underlayRanges = (all: Range[]) => all.filter((r) => r.material === "Underlay");

export const showcaseRanges = (all: Range[]) =>
  all
    .filter((r) => typeof r.showcase === "number")
    .sort((a, b) => (a.showcase ?? 0) - (b.showcase ?? 0));

export function filterRanges(all: Range[], material: string, room: string): Range[] {
  return all.filter(
    (r) =>
      (material === "All" || r.material === material) &&
      (room === "All" || r.rooms.includes(room)),
  );
}
