/**
 * Writes the 14 placeholder ranges out as content files.
 *
 * Run once at scaffold time. After that the markdown in
 * src/content/ranges/ is the source of truth and the shop edits it
 * directly — do not re-run this over their changes.
 */
import { mkdirSync, writeFileSync } from "node:fs";

const DIR = new URL("../src/content/ranges/", import.meta.url);
mkdirSync(DIR, { recursive: true });

const RANGES = [
  { id: "hagley-twist", name: "Hagley Twist", material: "Carpet", spec: "80/20 wool-rich twist pile", price: 24.99, grade: "Heavy domestic · Class 23", rooms: ["Living", "Bedroom", "Stairs"], pile: "twist", colours: ["#B8AE9C", "#8E8474", "#6B6355"], widths: [4, 5], order: 1, showcase: 1,
    body: "The one most people end up with. A wool-rich twist takes a hoover and a hallway without flattening off, and the 80/20 blend keeps its colour where the light lands." },
  { id: "ridgacre-saxony", name: "Ridgacre Saxony", material: "Carpet", spec: "Deep polypropylene saxony", price: 17.99, grade: "General domestic · Class 22", rooms: ["Living", "Bedroom"], pile: "saxony", colours: ["#D8CFC0", "#B3A895"], widths: [4, 5], order: 2,
    body: "Deep and soft underfoot, and polypropylene means you can get most things out of it with a damp cloth. Best in a bedroom or a lounge rather than a hall." },
  { id: "woodgate-loop", name: "Woodgate Loop", material: "Carpet", spec: "Natural wool-rich loop", price: 29.99, grade: "Heavy domestic · Class 23", rooms: ["Living", "Hall", "Stairs"], pile: "loop", colours: ["#C9BFA8", "#9A8F76"], widths: [4, 5], order: 3, showcase: 5,
    body: "A loop pile holds its shape in a busy hall better than anything else we sell. Worth knowing: if you have a cat, a loop is the one to avoid." },
  { id: "bartley-berber", name: "Bartley Berber", material: "Carpet", spec: "Stain-resistant berber twist", price: 14.99, grade: "General domestic · Class 22", rooms: ["Bedroom", "Hall"], pile: "twist", colours: ["#CFC7B6", "#A69C86"], widths: [4, 5], order: 4,
    body: "The sensible choice for a first house or a rental. Flecked, so it hides a multitude, and the stain treatment is built into the fibre rather than sprayed on." },
  { id: "quinton-heather", name: "Quinton Heather", material: "Carpet", spec: "Heathered twist, 50oz", price: 21.99, grade: "Heavy domestic · Class 23", rooms: ["Living", "Stairs", "Bedroom"], pile: "twist", colours: ["#8D8B91", "#63616A"], widths: [4, 5], order: 5, showcase: 2,
    body: "50oz is a heavy carpet — you can feel it in the roll. The heathered yarn gives it depth on a staircase where a flat colour would show every tread." },
  { id: "nailers-felt-back", name: "Nailers Felt-back", material: "Carpet", spec: "Felt-back cord, fitter's favourite", price: 8.99, grade: "Light domestic · Class 21", rooms: ["Bedroom", "Hall"], pile: "loop", colours: ["#B7B2A6", "#8F8A7D"], widths: [4], order: 6,
    body: "Felt-back goes down without underlay or gripper, so it is quick and it is cheap. A box room, a landing, a house you are selling." },
  { id: "halesowen-stripe", name: "Halesowen Stripe", material: "Carpet", spec: "Flatweave stripe, wool blend", price: 26.99, grade: "Heavy domestic · Class 23", rooms: ["Hall", "Stairs"], pile: "stripe", colours: ["#2F2C28", "#C8BEA9"], widths: [4], order: 7,
    body: "Stripes want planning on a staircase — the pattern has to run true up every riser, which is why we measure before we cut. Only comes on a 4m roll." },
  { id: "wolverley-oak", name: "Wolverley Oak 8mm", material: "Laminate", spec: "AC4 laminate, click fit", price: 19.99, grade: "Commercial · Class 32", rooms: ["Living", "Kitchen", "Hall"], pile: "plank", colours: ["#C69B63", "#9A733F"], widths: null, order: 8, showcase: 3,
    body: "AC4 is rated for commercial use, so a family hallway is nothing to it. Click fit over a combi board, with a 10mm expansion gap under the skirting." },
  { id: "ridgeway-grey", name: "Ridgeway Grey 12mm", material: "Laminate", spec: "AC5, water-resistant core", price: 27.99, grade: "Commercial · Class 33", rooms: ["Kitchen", "Hall", "Living"], pile: "plank", colours: ["#A9A49C", "#7E7972"], widths: null, order: 9,
    body: "12mm and AC5, with a core that will take a spilled washing machine without swelling at the joints. The thickness is what stops it sounding hollow." },
  { id: "lapal-vinyl", name: "Lapal Cushioned Vinyl", material: "Vinyl", spec: "Cushioned sheet vinyl", price: 12.99, grade: "General domestic", rooms: ["Kitchen", "Bathroom"], pile: "sheet", colours: ["#DCD6CB", "#B6AEA0"], widths: [3, 4], order: 10,
    body: "Sheet vinyl comes off 3m and 4m rolls, so a bathroom usually goes down in one piece with no seam. Warm underfoot because of the cushioned backing." },
  { id: "californian-herringbone", name: "Californian Herringbone", material: "Vinyl", spec: "Luxury vinyl tile, click", price: 34.99, grade: "Commercial · Class 33", rooms: ["Kitchen", "Hall", "Living"], pile: "herring", colours: ["#B78A55", "#8C6435"], widths: null, order: 11, showcase: 4,
    body: "The best-looking floor in the shop, and the one that takes longest to lay — a herringbone is set out from the centre line, not from a wall." },
  { id: "pu-comfort", name: "8mm PU Comfort", material: "Underlay", spec: "8mm polyurethane · 2.1 tog", price: 4.5, grade: "For carpet", rooms: ["Living", "Bedroom", "Stairs"], pile: "foam", colours: ["#6FAF8E", "#4E8C6C"], widths: null, order: 12,
    body: "What we put under most carpets. 2.1 tog, so it holds the heat in, and it takes the drum out of a suspended timber floor." },
  { id: "pu-luxury", name: "11mm PU Luxury", material: "Underlay", spec: "11mm polyurethane · 2.6 tog", price: 7.5, grade: "For carpet", rooms: ["Living", "Bedroom"], pile: "foam", colours: ["#7FA8CF", "#5C86AD"], widths: null, order: 13,
    body: "Three more millimetres than you think you need, and the difference is obvious the first time you walk on it. Not for stairs — too much give on a nosing." },
  { id: "combi-board", name: "Combi Board 6mm", material: "Underlay", spec: "Foam & foil, for laminate and LVT", price: 3.2, grade: "For hard floors", rooms: ["Kitchen", "Hall", "Living"], pile: "foam", colours: ["#C9C3B4", "#A49D8C"], widths: null, order: 14,
    body: "Foam one side, foil the other. The foil is the damp-proof membrane, which is not optional on a concrete floor." },
];

const yamlList = (a) => "[" + a.map((v) => (typeof v === "string" ? `"${v}"` : v)).join(", ") + "]";

for (const r of RANGES) {
  const fm = [
    "---",
    `name: "${r.name}"`,
    `material: "${r.material}"`,
    `spec: "${r.spec}"`,
    `price: ${r.price}`,
    `grade: "${r.grade}"`,
    `rooms: ${yamlList(r.rooms)}`,
    `widths: ${r.widths ? yamlList(r.widths) : "null"}`,
    `pile: "${r.pile}"`,
    `colours: ${yamlList(r.colours)}`,
    `photo: ../../assets/ranges/${r.id}.jpg`,
    `order: ${r.order}`,
    ...(r.showcase ? [`showcase: ${r.showcase}`] : []),
    "---",
    "",
    r.body,
    "",
  ].join("\n");
  writeFileSync(new URL(`${r.id}.md`, DIR), fm, "utf8");
}

console.log(`wrote ${RANGES.length} ranges`);
