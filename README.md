# Quinton Carpets

The production website for Quinton Carpets, 589–613 Hagley Road West, Birmingham B32 1BY.

Astro 5 · Tailwind 4 · TypeScript · Cloudflare Pages + D1.

---

## The three rules

1. **No payment anywhere on this site.** No cards, no checkout, no deposits. Money is taken in
   the shop. If a change would add one, it is the wrong change.
2. **Booking a measure is free**, and the page says so in the heading, on the button and in the
   confirmation.
3. Every figure the site produces before a physical measure is an **estimate** or a **guide
   price** — never a "quote".

---

## Running it

```bash
npm install
npm run dev            # http://localhost:4321 — pages only, no database
```

The booking form and the code checker need D1, so they need the real Worker:

```bash
npm run build
npm run db:local       # creates the tables in the local database, once
npx wrangler pages dev # http://localhost:8788 — the whole site
```

`wrangler pages dev` takes its bindings from `wrangler.toml`. Do not pass `--d1` or `--kv`
flags as well: that creates a second, empty local database and the bookings will fail with
"no such table".

### Tests

```bash
npm test               # the pricing and date maths — pure, fast, no browser
npm run test:e2e       # the journey, accessibility, and the banner
npm run check          # types
```

The end-to-end suite needs `npm run build` and `npm run db:local` first. It starts its own
`wrangler pages dev` and clears the local rate-limit ledger before each run — the booking
endpoint caps one IP at eight bookings an hour, and every test run comes from the same address.

---

## Layout

```
src/
  content/ranges/*.md    the 14 ranges — the shop edits these, no deploy needed
  data/                  business facts and the 12 real reviews
  lib/
    pricing.ts           the estimator maths. Pure, unit-tested, no DOM
    dates.ts             the diary rules, in Europe/London
    codes.ts             minting and shape-checking references
    textures.ts          the CSS floor textures (placeholders for photography)
    ranges.ts            reading the content collection
    server/              validation, email and bindings — server only
  pages/
    api/                 the booking and code endpoints
    booking/[ref].astro  a customer looking up their own booking
    admin/               the staff diary, behind basic auth
  scripts/               the browser: motion, the estimator, the booking island
  styles/                the design system, split by concern
reference/prototype.html the approved prototype, kept as a test fixture only
```

### Which pages are static

Everything is prerendered except four routes that genuinely need a server:

| Route | Why |
|---|---|
| `/ranges/` | the filter is real server-side filtering, so `?material=carpet` works with JavaScript off |
| `/book/` | "today" has to be today, and the date picker works without JavaScript |
| `/booking/[ref]/` | reads the diary |
| `/admin/` | reads the diary, behind basic auth |

**On the Worker.** The brief asked for Cloudflare Pages plus one Worker for the form endpoint.
Astro's Cloudflare adapter emits a `_worker.js` that owns all routing, and a project with one
of those ignores a `functions/` directory entirely — so the API routes live inside that same
Worker, at `src/pages/api/`. That is one Worker, as intended; it just is not a second one.

---

## Deploying

```bash
npx wrangler d1 create quinton-carpets       # paste the id into wrangler.toml
npx wrangler kv namespace create SESSION     # paste that id in too
npm run db:remote                            # create the tables

npx wrangler pages secret put RESEND_API_KEY
npx wrangler pages secret put ADMIN_USER
npx wrangler pages secret put ADMIN_PASSWORD

npm run deploy
```

The KV namespace is only there because the adapter wires sessions to KV. The site does not use
sessions; the binding just has to exist.

Without `RESEND_API_KEY` the site still works — bookings save and the customer still gets their
reference on screen. Only the two confirmation emails are skipped, and the Worker logs that it
skipped them. A mail provider having a bad morning must never lose a booking.

---

## The estimator

The maths lives in `src/lib/pricing.ts` and nowhere else. It is pure: give it an input, get the
same answer every time, no DOM and no clock.

The part that sells the site is roll-width costing. A fitter does not buy your floor area, they
buy a length off a roll — so a 4.2 × 4.6m lounge takes two strips off a 4m roll (37.6 m²) but
drops onto a 5m roll in one (23.5 m²), and the site charges the cheaper of the two and says
which won. Ties go to the narrower roll. Underlay is charged on actual floor area × 1.05, not
on roll usage. Stairs are 0.85 m² a step and are fitted per step, never per m².

**Discounts apply to labour only** — fitting and fitting extras. Materials are already at the
shop's best price and never discount. The client never decides what a code is worth: it posts
the code to `/api/codes`, gets back `{ valid, kind, percentOff | amountOff, message }`, and
recomputes from the server's answer.

All the placeholder rates are in one object, `PRICES`, at the top of `pricing.ts`.

---

## Where this build departs from the prototype

The prototype is the visual source of truth, and `tests/e2e/fidelity.spec.ts` proves it: it
loads both documents at 1440, 1024, 768 and 390 in both themes and asserts that every design
token and the banner's geometry and typography match exactly. Four things were changed
deliberately, because reproducing them would have shipped a defect.

1. **The nav collapses at 1080px, not 760px.** The full nav, the wordmark and the call button
   need about 1090px between them. In the prototype they simply overflow: it scrolls sideways
   by 66px at 1024, 322px at 768 and 11px at 390. The hamburger now takes over before that can
   happen, and the phone number still stays visible down to 760px exactly as specified. Below
   420px and 380px the header tightens its own gaps; below 340px the wordmark's strapline is
   dropped. The rest of the page keeps the prototype's 760px breakpoint untouched.

2. **The footer and the referral band have their own tokens.** Both painted themselves with
   `background: var(--ink)` and hard-coded cream text. In dark mode `--ink` flips to near-white,
   so the footer became a pale slab with pale text on it — unreadable. They are meant to be ink
   in both themes, so they now use `--slab` / `--slab-ink`, which are constant across themes the
   way `--yellow` is.

3. **The dark-mode highlight behind "on a roll." is a full block.** The prototype paints a
   partial band across the lower part of the words. That works in light, where the headline is
   ink; in dark the headline is near-white, so the words ended up near-white on yellow — about
   1.5:1, and against the rule that yellow never carries white text. In dark mode the band now
   covers the full line and the text is ink, which is the same relationship the light theme
   already has. Light mode is untouched.

4. **Three small contrast fixes.** `--muted` on the `--surface` tint is 4.16:1, just under AA
   for small text, so the selected option's description and the eyebrow on tinted sections step
   up to `--ink-2`. The star ratings gained `role="img"` so their label is legal. The privacy
   link in the footer's fine print is underlined, because it sits at low contrast by design and
   cannot be marked by colour alone. Axe reports zero violations on every route in all three
   theme states.

The reduced-motion block also needed `.aurora i:nth-child(n)` rather than `.aurora i` — the
drift rules are written per-child, so the original override lost on specificity and the glow
kept moving for people who had asked it not to.

---

## Still to do before it goes live

These need the shop, not the developer.

1. **Photograph** the shop, the fitters and every range, and replace the images. Every range
   currently points at a **random placeholder** in `src/assets/ranges/<id>.jpg` — drop the real
   photograph in over the top, same filename, 1:1 crop, and nothing else needs touching. The
   category cards on the home page and `public/og.jpg` are placeholders too. The CSS textures in
   `lib/textures.ts` remain the automatic fallback for any range whose `photo` is removed.
   **Alt text is generated from the range name and spec**, so it will only be truthful once the
   real photographs are in.
2. **Replace every placeholder range name and guide price** with the real ranges and today's
   rates, in `src/content/ranges/`.
3. **Confirm the fitting, uplift, gripper, door bar and stair rates** in `PRICES` so the
   estimator matches the counter. Everything on the site is currently a placeholder.
4. **Sign off the referral percentages** (10% / 20%) and the promotion codes in `promo_codes`.
5. **Point the domain**, set up the shop's email, verify the Google Business Profile.
6. **Decide on a room visualiser** for phase two, once the photography exists.

### Two things worth a decision

- **The reviews section** is parked as built, pending a decision on it. There is no
  `AggregateRating` in the structured data and there must not be until it is wired to the live
  Google Business Profile feed.
- **The privacy notice** at `/privacy/` states 12 months for a booking that does not become a
  job and 6 years for one that does. Those are sensible defaults, not instructions from the
  shop. Confirm them, and confirm the shop is content to be named as the data controller at
  that address.
