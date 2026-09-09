import { test, expect, type Page } from "@playwright/test";

/**
 * The whole point of the site: price a floor, book the free measure,
 * come away with a reference and a referral code.
 */

/** Pick the first bookable day in the calendar that falls on a given weekday. */
async function pickDay(page: Page, weekday?: number): Promise<string> {
  const buttons = page.locator("#cal .days button:not([disabled])");
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const b = buttons.nth(i);
    const iso = (await b.getAttribute("data-d")) ?? "";
    if (weekday === undefined || new Date(`${iso}T00:00:00Z`).getUTCDay() === weekday) {
      await b.click();
      return iso;
    }
  }
  throw new Error("no bookable day of that kind in view");
}

test("estimate, then book, and come away with a reference", async ({ page }) => {
  await page.goto("/estimate/");

  // The summary is live from the first paint — no empty state to click past.
  const total = page.locator("#estTotal");
  await expect(total).toContainText("£");
  const opening = await total.textContent();

  // The roll width the fitter would use is shown, not hidden.
  await expect(page.locator("#estLines")).toContainText("roll width, trim included");

  // Adding a room moves the number.
  await page.getByRole("button", { name: "+ Add a room" }).click();
  await expect(total).not.toHaveText(opening ?? "");

  // The estimate code is minted and offered to the booking form.
  const code = (await page.locator("#estFoot .mono").first().textContent())?.trim() ?? "";
  expect(code).toMatch(/^QC-EST-[A-Z0-9]{5}$/);

  await page.getByRole("link", { name: "Book a free measure" }).click();
  await expect(page).toHaveURL(/\/book\//);

  // It carried the code across rather than making them retype it.
  await expect(page.locator("#bEst")).toHaveValue(code);

  await page.locator("#bName").fill("Pat Seddon");
  await page.locator("#bPhone").fill("07855 555 599");
  await page.locator("#bEmail").fill("pat@example.com");
  await page.locator("#bPostcode").fill("B32 1BY");
  await page.locator("#bAddress").fill("589 Hagley Road West");

  await pickDay(page);
  await page.locator("#slots button:not([disabled])").first().click();
  await page.locator("#bConsent").check();

  // The server turns away anything submitted within three seconds of
  // the page loading — no person fills in eight fields and picks a
  // date that fast, but Playwright does. Take the time.
  await page.waitForTimeout(3200);
  await page.getByRole("button", { name: "Confirm my free measure" }).click();

  // The reference, at display size, and the referral code with it.
  const ref = page.locator(".refbig");
  await expect(ref).toBeVisible();
  await expect(ref).toHaveText(/^QC-\d{4}-[A-Z0-9]{4}$/);

  await expect(page.locator(".refcode")).toHaveText(/^QC-REF-[A-Z0-9]{4}$/);
  await expect(page.getByText("Booked — nothing to pay")).toBeVisible();

  // Their own number, in the callback promise.
  await expect(page.locator("#bookDone")).toContainText("07855 555 599");

  // And the booking can be looked up on its own page.
  const reference = (await ref.textContent())!.trim();
  await page.goto(`/booking/${reference}/`);
  await expect(page.locator(".refbig")).toHaveText(reference);
  await expect(page.getByText("Pat Seddon")).toBeVisible();
});

test("Sunday never offers the Late window", async ({ page }) => {
  await page.goto("/book/");
  await pickDay(page, 0); // 0 = Sunday

  await expect(page.locator('#slots button[data-s="am"]')).toBeEnabled();
  await expect(page.locator('#slots button[data-s="pm"]')).toBeEnabled();
  // The shop shuts at 4pm on a Sunday.
  await expect(page.locator('#slots button[data-s="eve"]')).toBeDisabled();
  await expect(page.locator("#slotHint")).toContainText("Sunday, so we finish at 4pm");

  // And a Saturday has all three.
  await pickDay(page, 6);
  await expect(page.locator('#slots button[data-s="eve"]')).toBeEnabled();
});

test("the calendar cannot go back before today", async ({ page }) => {
  await page.goto("/book/");
  await expect(page.getByRole("button", { name: "Previous month" })).toBeDisabled();
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.getByRole("button", { name: "Previous month" })).toBeEnabled();
});

test("every form error names the problem and the fix", async ({ page }) => {
  await page.goto("/book/");
  await page.getByRole("button", { name: "Confirm my free measure" }).click();

  await expect(page.locator("#err-name")).toBeVisible();
  await expect(page.locator("#err-name")).toHaveText("Please tell us your name.");
  await expect(page.locator("#err-phone")).toHaveText("We need a number to ring you back on.");
  await expect(page.locator("#err-email")).toHaveText("That doesn't look like an email address.");
  await expect(page.locator("#err-postcode")).toHaveText(
    "Please add your postcode so we can plan the round.",
  );
  await expect(page.locator("#err-address")).toHaveText("Please add the address we're measuring.");
  await expect(page.locator("#dateErr")).toBeVisible();
  await expect(page.locator("#consentErr")).toBeVisible();

  // A malformed referral code is called out by shape.
  await page.locator("#bRef").fill("NONSENSE");
  await page.getByRole("button", { name: "Confirm my free measure" }).click();
  await expect(page.locator("#err-referral")).toBeVisible();

  // A valid one is accepted without complaint.
  await page.locator("#bRef").fill("QC-REF-7T4M");
  await page.getByRole("button", { name: "Confirm my free measure" }).click();
  await expect(page.locator("#err-referral")).not.toBeVisible();
});

test("no payment anywhere on the site", async ({ page }) => {
  for (const path of ["/", "/ranges/", "/estimate/", "/book/", "/referrals/", "/visit/"]) {
    await page.goto(path);
    const text = (await page.locator("body").innerText()).toLowerCase();
    for (const word of ["checkout", "add to basket", "add to cart", "pay now", "card number", "deposit"]) {
      expect(text, `"${word}" must not appear on ${path}`).not.toContain(word);
    }
    // And nothing is ever called a quote.
    expect(text, `"quote" as a noun must not appear on ${path}`).not.toMatch(
      /\b(free|instant|get a|your) quote\b/,
    );
  }
});

test("booking a measure is free, and says so in three places", async ({ page }) => {
  await page.goto("/book/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Book it. It costs nothing.");
  await expect(page.getByRole("button", { name: "Confirm my free measure" })).toBeVisible();
  await expect(page.getByText("Free of charge · no card details · no obligation")).toBeVisible();
});

test("the ranges filter lives in the URL and works server-side", async ({ page }) => {
  await page.goto("/ranges/?material=Laminate");
  const cards = page.locator(".rangecard");
  await expect(cards).toHaveCount(2);
  await expect(page.locator(".swatch .tag").first()).toHaveText("Laminate");

  // Case-insensitive, because people type it themselves.
  await page.goto("/ranges/?material=carpet&room=stairs");
  await expect(page.locator(".rangecard")).toHaveCount(4);

  // A combination with nothing in it says so, in the shop's voice.
  await page.goto("/ranges/?material=Underlay&room=Bathroom");
  await expect(page.getByText("Nothing matches that combination")).toBeVisible();
});
