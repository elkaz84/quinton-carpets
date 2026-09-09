/**
 * Everything factual about the shop, in one place.
 *
 * Nothing goes in here that the shop has not told us. No founding
 * year, no awards, no accreditations, no parking arrangements, no
 * bus routes — if it isn't below, it isn't on the site.
 */

export const BUSINESS = {
  name: "Quinton Carpets",
  strapline: "When it comes to carpets, we are on a roll.",
  street: "589–613 Hagley Road West",
  locality: "Quinton",
  city: "Birmingham",
  postcode: "B32 1BY",
  region: "West Midlands",
  country: "GB",
  phone: "0121 423 3322",
  phoneHref: "tel:01214233322",
  mobile: "07855 555 599",
  mobileHref: "tel:07855555599",
  email: "quintoncarpets@gmail.com",
  /** Where the shop actually is, for LocalBusiness `geo`. */
  geo: { lat: 52.4562, lon: -2.0092 },
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=589-613+Hagley+Road+West+Birmingham+B32+1BY",
} as const;

export const ADDRESS_LINES = [
  "589–613 Hagley Road West",
  "Birmingham",
  "B32 1BY",
] as const;

/** Mon–Sat 10am–6pm, Sunday 10am–4pm. */
export const HOURS = [
  { days: ["Mo", "Tu", "We", "Th", "Fr", "Sa"], label: "Mon – Sat", open: "10:00", close: "18:00" },
  { days: ["Su"], label: "Sunday", open: "10:00", close: "16:00" },
] as const;

/** The places we actually serve, for honest local titles. No doorway pages. */
export const AREAS = [
  "Birmingham",
  "Quinton",
  "Halesowen",
  "Harborne",
  "Bartley Green",
  "Woodgate",
] as const;

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/ranges/", label: "Ranges" },
  { href: "/estimate/", label: "Instant estimate" },
  { href: "/book/", label: "Book a measure" },
  { href: "/referrals/", label: "Refer a friend" },
  { href: "/visit/", label: "Visit us" },
] as const;

/**
 * The ticker band. aria-hidden, because it scrolls — every one of
 * these facts appears as real, readable text elsewhere on the page.
 */
export const TICKER = [
  "Free consultation",
  "Free measuring",
  "Our own fitters",
  "Carpet · Underlay · Laminate · Vinyl",
  "Mon–Sat 10–6 · Sun 10–4",
  "Pop in, no appointment",
  "Refer a friend, get 20% off",
] as const;
