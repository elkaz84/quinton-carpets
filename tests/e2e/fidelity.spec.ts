import { test, expect, type Page } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";

/**
 * Fidelity to the approved prototype.
 *
 * A straight pixel diff is not the right instrument here: the
 * carpet-pile canvas is seeded randomly on every load and the
 * ambient glow drifts on three independent loops, so two correct
 * renders never produce identical pixels. What we can pin down
 * exactly is the geometry and the typography — so this measures
 * both documents and insists the numbers agree.
 *
 * The prototype ships in reference/ purely as this fixture. It is
 * not deployed and nothing imports from it.
 */

const PROTOTYPE = pathToFileURL(path.resolve("reference/prototype.html")).href;

const BREAKPOINTS = [1440, 1024, 768, 390];

/** Computed styles we care about, keyed by selector. */
const PROBES: Record<string, string[]> = {
  ":root": [],
  "h1": ["fontSize", "lineHeight", "letterSpacing", "fontWeight", "fontStretch", "maxWidth"],
  ".hero h1 em.shine": ["backgroundImage", "paddingLeft", "overflow"],
  ".lede": ["fontSize", "color", "maxWidth"],
  ".pill": ["fontSize", "letterSpacing", "borderRadius", "paddingTop", "paddingLeft"],
  ".pill .dot": ["width", "height", "backgroundColor"],
  ".btn.yellow": ["borderRadius", "boxShadow", "paddingTop", "paddingLeft", "fontSize", "fontWeight"],
  ".trustrow": ["fontSize", "columnGap", "marginTop"],
  ".room": ["borderRadius", "borderTopWidth", "aspectRatio"],
  ".room .floor": ["clipPath", "top"],
  ".room .scanline": ["height", "top"],
  ".roomcard": ["borderRadius", "paddingTop", "minWidth"],
  ".picker button": ["width", "height", "borderRadius"],
  ".showhint": ["fontSize", "letterSpacing", "marginTop"],
  ".ticker": ["backgroundColor", "paddingTop", "borderTopWidth"],
  ".ticker li": ["fontSize", "fontWeight", "paddingLeft"],
  ".showcase": ["perspective"],
};

/** The design tokens themselves, read off the root. */
const TOKENS = [
  "--ground", "--surface", "--surface-2", "--ink", "--ink-2", "--muted",
  "--line", "--line-strong", "--yellow", "--yellow-soft", "--yellow-deep",
  "--yellow-ink", "--ok", "--ok-bg", "--warn", "--warn-bg", "--err", "--err-bg",
  "--r-s", "--r-m", "--r-l", "--maxw",
];

async function measure(page: Page) {
  return page.evaluate(
    ({ probes, tokens }) => {
      const out: Record<string, Record<string, string>> = {};
      const root = getComputedStyle(document.documentElement);
      out[":root"] = Object.fromEntries(tokens.map((t) => [t, root.getPropertyValue(t).trim()]));

      for (const [sel, props] of Object.entries(probes)) {
        if (sel === ":root") continue;
        const el = document.querySelector(sel);
        if (!el) {
          out[sel] = { missing: "yes" };
          continue;
        }
        const cs = getComputedStyle(el);
        out[sel] = Object.fromEntries(
          (props as string[]).map((p) => [p, String(cs[p as keyof CSSStyleDeclaration] ?? "")]),
        );
      }
      // Hex spelling differs between the hand-written prototype and
      // the minified build (#FFFFFF vs #fff), so colours are pushed
      // through the browser's own parser and compared as rgb().
      const probe = document.createElement("span");
      probe.style.display = "none";
      document.body.appendChild(probe);
      const norm = (v: string) => {
        const t = v.toLowerCase().trim();
        if (!/^#[0-9a-f]{3,8}$/.test(t)) return t;
        probe.style.color = "";
        probe.style.color = t;
        return getComputedStyle(probe).color;
      };
      for (const group of Object.values(out)) {
        for (const k of Object.keys(group)) group[k] = norm(group[k]!);
      }
      probe.remove();
      return out;
    },
    { probes: PROBES, tokens: TOKENS },
  );
}

for (const width of BREAKPOINTS) {
  for (const scheme of ["light", "dark"] as const) {
    test(`matches the prototype at ${width} in ${scheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });

      await page.goto(PROTOTYPE);
      // The prototype is a hash router; the banner lives on #/home.
      await page.evaluate(() => {
        document.getElementById("protobar")?.remove();
      });
      await page.waitForTimeout(250);
      const expected = await measure(page);

      await page.goto("/");
      await page.waitForTimeout(250);
      const actual = await measure(page);

      // Compared section by section, so a failure names what drifted.
      for (const sel of Object.keys(PROBES)) {
        // The one deliberate exception: in dark mode the highlight
        // behind "on a roll." is a full-height block with ink text,
        // because the prototype's partial band leaves the headline's
        // near-white ink sitting on yellow. See the README.
        if (scheme === "dark" && sel === ".hero h1 em.shine") continue;
        expect(actual[sel], `${sel} at ${width}px in ${scheme}`).toEqual(expected[sel]);
      }
    });
  }
}

test("the design tokens are identical in all three theme states", async ({ page }) => {
  const states = [
    { name: "light (system)", scheme: "light" as const, stamp: null },
    { name: "dark (system)", scheme: "dark" as const, stamp: null },
    { name: "light (stamped)", scheme: "dark" as const, stamp: "light" },
    { name: "dark (stamped)", scheme: "light" as const, stamp: "dark" },
  ];

  for (const state of states) {
    await page.emulateMedia({ colorScheme: state.scheme });

    await page.goto(PROTOTYPE);
    if (state.stamp) {
      await page.evaluate((s) => document.documentElement.setAttribute("data-theme", s), state.stamp);
    }
    const expected = (await measure(page))[":root"];

    await page.goto("/");
    if (state.stamp) {
      await page.evaluate((s) => document.documentElement.setAttribute("data-theme", s), state.stamp);
    }
    const actual = (await measure(page))[":root"];

    expect(actual, `tokens in ${state.name}`).toEqual(expected);
    // And a stamped choice really does override the system preference.
    expect(actual!["--ground"], `--ground in ${state.name}`).toBe(
      state.name.startsWith("dark") ? "rgb(18, 17, 16)" : "rgb(255, 255, 255)",
    );
  }
});

test("the header no longer pushes the page sideways", async ({ page }) => {
  // The one place this build deliberately departs from the prototype:
  // the prototype's full nav does not fit under about 1090px and
  // forces a horizontal scrollbar at 1024, 768 and 390. Ours
  // collapses to the hamburger before that can happen.
  for (const width of [1440, 1180, 1024, 900, 768, 600, 430, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `no horizontal scroll at ${width}px`).toBeLessThanOrEqual(1);
  }
});
