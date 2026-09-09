import { test, expect } from "@playwright/test";

/**
 * The home banner is the acceptance gate, so it gets its own file:
 * the four breakpoints, both themes, and reduced motion.
 */

const BREAKPOINTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1024", width: 1024, height: 900 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
];

for (const bp of BREAKPOINTS) {
  for (const scheme of ["light", "dark"] as const) {
    test(`banner at ${bp.name} in ${scheme}`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");

      // Everything meant to be read is readable in the first frame.
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toBeVisible();
      await expect(h1).toContainText("When it comes to carpets, we're on a roll.");
      await expect(page.locator(".hero-sub")).toBeVisible();
      await expect(page.locator(".showcase .room")).toBeVisible();

      // The page never scrolls sideways.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `no horizontal scroll at ${bp.name}`).toBeLessThanOrEqual(1);

      await expect(page).toHaveScreenshot(`banner-${bp.name}-${scheme}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: "disabled",
      });
    });
  }
}

test("the headline splits into words but keeps the highlight whole", async ({ page }) => {
  await page.goto("/");
  const words = page.locator("h1 .w");
  await expect(words.first()).toBeVisible();
  expect(await words.count()).toBeGreaterThan(5);

  // The splitter walks text nodes, so the <em> survives as one element.
  const em = page.locator("h1 em.shine");
  await expect(em).toHaveCount(1);
  await expect(em).toHaveText("on a roll.");
});

test("the floor lays flat as you scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const rx = () =>
    page.locator(".showcase-inner").evaluate((el) => getComputedStyle(el).getPropertyValue("--rx").trim());

  const before = await rx();
  await page.locator(".showcase").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const after = await rx();

  // It starts tilted and ends flat.
  expect(parseFloat(before)).toBeGreaterThan(1);
  expect(parseFloat(after)).toBeLessThan(parseFloat(before));
});

test("the showcase rotates through the ranges and a click takes over", async ({ page }) => {
  await page.goto("/");
  const name = page.locator("#scName");
  const first = await name.textContent();

  // A viewer picking a swatch wins over the auto-advance.
  await page.locator("#scPicker button").nth(2).click();
  const picked = await name.textContent();
  expect(picked).not.toBe(first);
  await expect(page.locator("#scPicker button").nth(2)).toHaveAttribute("aria-pressed", "true");

  // And it carries the spec, price and wear class with it.
  await expect(page.locator("#scGrade")).not.toBeEmpty();
  await expect(page.locator("#scPrice")).toContainText("/m²");
});

test("reduced motion stops everything and leaves the page readable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  // The headline is simply there.
  const opacity = await page.locator("h1 .w").first().evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBe(1);

  // The showcase renders flat.
  const transform = await page
    .locator(".showcase-inner")
    .evaluate((el) => getComputedStyle(el).transform);
  expect(transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);

  // The beam, the sheen, the ticker and the ping are all off.
  for (const sel of [".room .scanline", ".pill .dot", ".ticker .track", ".aurora i"]) {
    const anim = await page.locator(sel).first().evaluate((el) => getComputedStyle(el).animationName);
    expect(anim, `${sel} should not animate`).toBe("none");
  }
});

test("nothing is parked at opacity 0 waiting on a scroll", async ({ page }) => {
  await page.goto("/");

  // The headline arrives on load rather than on scroll, so poll until
  // everything on screen has settled instead of sampling once — on a
  // loaded machine the staggered words can still be in flight.
  const stuck = () =>
    page.evaluate(() => {
      const vh = window.innerHeight;
      return Array.from(document.querySelectorAll<HTMLElement>(".rv, .hero *"))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.top > vh || r.bottom < 0 || r.width === 0) return false;
          return Number(getComputedStyle(el).opacity) === 0;
        })
        .map((el) => String(el.className))
        // The spotlight appears on hover and the B floor layer only
        // during a cross-fade; both are meant to be invisible at rest.
        .filter((c) => !/aurora|spot|floor fade/.test(c));
    });

  await expect
    .poll(stuck, { timeout: 10_000, message: "these never became visible" })
    .toEqual([]);
});

test("the ticker is decorative, and its facts appear as real text", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".ticker")).toHaveAttribute("aria-hidden", "true");

  // Same facts, in text a screen reader will actually read.
  const body = await page.locator("main").innerText();
  expect(body).toContain("Free measure");
  expect(body).toContain("Mon–Sat 10am – 6pm");
  expect(body).toContain("No appointment needed");
});

test("the header sticks, and the progress bar tracks the scroll", async ({ page }) => {
  await page.goto("/");
  const header = page.locator("header.site");
  await expect(header).not.toHaveClass(/stuck/);

  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(150);
  await expect(header).toHaveClass(/stuck/);

  const width = await page.locator("#progress").evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(0);
});
