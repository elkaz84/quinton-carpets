import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTES = ["/", "/ranges/", "/estimate/", "/book/", "/referrals/", "/visit/", "/privacy/", "/404"];

// Three theme states, and the site has to be clean in all of them.
const THEMES = [
  { name: "light", stamp: "light", prefers: "light" as const },
  { name: "dark", stamp: "dark", prefers: "dark" as const },
  { name: "system-dark", stamp: null, prefers: "dark" as const },
];

for (const theme of THEMES) {
  for (const route of ROUTES) {
    test(`axe: ${route} in ${theme.name}`, async ({ page }) => {
      // Reduced motion, so nothing is scanned mid-transition: a
      // contrast reading taken while an element is fading in measures
      // the animation, not the design.
      await page.emulateMedia({ colorScheme: theme.prefers, reducedMotion: "reduce" });
      await page.goto(route);
      if (theme.stamp) {
        await page.evaluate((s) => document.documentElement.setAttribute("data-theme", s), theme.stamp);
      }
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
}

test("focus order through the header", async ({ page }) => {
  await page.goto("/");

  const order: string[] = [];
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press("Tab");
    order.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return (el?.textContent?.trim() || el?.getAttribute("aria-label") || "").slice(0, 24);
      }),
    );
  }

  // The skip link always comes first, wherever we are.
  expect(order[0]).toContain("Skip to content");

  // Below 1080px the nav is behind the hamburger, so the links are
  // correctly out of the tab order and the toggle stands in for them.
  const navVisible = await page.locator("nav.main").isVisible();
  if (navVisible) {
    expect(order.join("|")).toContain("Home");
    expect(order.join("|")).toContain("Ranges");
    expect(order.join("|")).toContain("Instant estimate");
  } else {
    expect(order.join("|")).toContain("Menu");
    // And opening it puts the links in reach.
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.locator("nav.main")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Instant estimate" }),
    ).toBeVisible();
  }
});

test("the focus ring is never removed", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    return { width: s.outlineWidth, style: s.outlineStyle };
  });
  expect(outline.style).not.toBe("none");
  expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(3);
});

test("the calendar is real buttons, reachable by tab", async ({ page }) => {
  await page.goto("/book/");
  const days = page.locator("#cal .days button:not([disabled])");
  await expect(days.first()).toBeVisible();

  // Real <button>s with real disabled state, not divs with click handlers.
  const tags = await page.locator("#cal .days > *").evaluateAll((els) =>
    Array.from(new Set(els.map((e) => e.tagName))),
  );
  expect(tags.sort()).toEqual(["BUTTON", "SPAN"]);

  await days.first().focus();
  await expect(days.first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(days.first()).toHaveClass(/on/);
});

test("errors sit next to the field they belong to", async ({ page }) => {
  await page.goto("/book/");
  await page.getByRole("button", { name: "Confirm my free measure" }).click();

  const sameParent = await page.evaluate(() => {
    const err = document.querySelector("#err-phone");
    const input = document.querySelector("#bPhone");
    return err?.parentElement === input?.parentElement;
  });
  expect(sameParent).toBe(true);
});

test("decorative layers are hidden from screen readers", async ({ page }) => {
  await page.goto("/");
  for (const sel of ["#pile", "#spot", ".aurora", ".ticker", ".scanline", ".floor"]) {
    const hidden = await page.locator(sel).first().getAttribute("aria-hidden");
    expect(hidden, `${sel} should be aria-hidden`).toBe("true");
  }
  // The map is not decorative — it carries a role and a full label.
  const map = page.locator(".mapbox svg").first();
  await expect(map).toHaveAttribute("role", "img");
  const label = await map.getAttribute("aria-label");
  expect(label?.length ?? 0).toBeGreaterThan(40);
});

test("every page has one h1, a title and a description", async ({ page }) => {
  for (const route of ROUTES) {
    await page.goto(route);
    await expect(page.locator("h1"), `${route} should have exactly one h1`).toHaveCount(1);
    expect(await page.title()).toContain("Quinton Carpets");
    const desc = await page.locator('meta[name="description"]').getAttribute("content");
    expect((desc ?? "").length, `${route} needs a description`).toBeGreaterThan(60);
  }
});
