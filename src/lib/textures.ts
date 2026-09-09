/**
 * CSS-generated floor textures.
 *
 * These are DELIBERATE PLACEHOLDERS standing in for photography.
 * They stay as the fallback for any range without a photograph;
 * swap them range by range as the shoot lands, keeping the same
 * 1:1 crop. Do not treat them as the finished design.
 */

export type Pile =
  | "twist" | "saxony" | "loop" | "stripe"
  | "plank" | "herring" | "sheet" | "foam";

export type Swatchable = { pile: Pile; colours: readonly string[] };

/** Card-sized weave. Fine detail, because the swatch is small. */
export function swatchStyle(r: Swatchable): string {
  const a = r.colours[0]!;
  const b = r.colours[1] ?? a;
  const c = r.colours[2] ?? b;
  switch (r.pile) {
    case "twist":
      return `background:${a};background-image:repeating-linear-gradient(92deg,${b} 0 2px,transparent 2px 5px),repeating-linear-gradient(6deg,${c}55 0 1px,transparent 1px 4px)`;
    case "saxony":
      return `background:${a};background-image:radial-gradient(circle at 30% 30%,${b}aa 0 3px,transparent 4px),radial-gradient(circle at 70% 65%,${b}88 0 4px,transparent 5px);background-size:11px 11px,17px 17px`;
    case "loop":
      return `background:${a};background-image:repeating-linear-gradient(0deg,${b}88 0 3px,transparent 3px 8px),repeating-linear-gradient(90deg,${b}66 0 3px,transparent 3px 8px)`;
    case "stripe":
      return `background:${b};background-image:repeating-linear-gradient(90deg,${a} 0 14px,transparent 14px 34px),repeating-linear-gradient(90deg,${a}66 0 3px,transparent 3px 7px)`;
    case "plank":
      return `background:${a};background-image:repeating-linear-gradient(90deg,rgba(0,0,0,.22) 0 2px,transparent 2px 84px),repeating-linear-gradient(3deg,${b}77 0 1px,transparent 1px 6px)`;
    case "herring":
      return `background:${a};background-image:repeating-linear-gradient(45deg,${b} 0 9px,${a} 9px 18px),repeating-linear-gradient(-45deg,rgba(0,0,0,.14) 0 9px,transparent 9px 18px);background-size:36px 36px`;
    case "sheet":
      return `background:${a};background-image:repeating-linear-gradient(90deg,rgba(0,0,0,.13) 0 1.5px,transparent 1.5px 40px),repeating-linear-gradient(0deg,rgba(0,0,0,.13) 0 1.5px,transparent 1.5px 40px),radial-gradient(circle at 50% 50%,${b}55,transparent 60%)`;
    case "foam":
      return `background:${a};background-image:radial-gradient(circle at 25% 25%,${b} 0 4px,transparent 5px);background-size:15px 15px`;
    default:
      return `background:${a}`;
  }
}

/** Room-sized weave for the showcase floor — coarser, because it is seen at distance. */
export function floorStyle(r: Swatchable): string {
  const a = r.colours[0]!;
  const b = r.colours[1] ?? a;
  const c = r.colours[2] ?? b;
  switch (r.pile) {
    case "twist":
      return `background:${a};background-image:repeating-linear-gradient(92deg,${b} 0 3px,transparent 3px 7px),repeating-linear-gradient(6deg,${c}55 0 2px,transparent 2px 6px)`;
    case "loop":
      return `background:${a};background-image:repeating-linear-gradient(0deg,${b}88 0 4px,transparent 4px 11px),repeating-linear-gradient(90deg,${b}66 0 4px,transparent 4px 11px)`;
    case "plank":
      return `background:${a};background-image:repeating-linear-gradient(90deg,rgba(0,0,0,.22) 0 3px,transparent 3px 120px),repeating-linear-gradient(3deg,${b}77 0 2px,transparent 2px 9px)`;
    case "herring":
      return `background:${a};background-image:repeating-linear-gradient(45deg,${b} 0 13px,${a} 13px 26px),repeating-linear-gradient(-45deg,rgba(0,0,0,.14) 0 13px,transparent 13px 26px);background-size:52px 52px`;
    default:
      return `background:${a}`;
  }
}
