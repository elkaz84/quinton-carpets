import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against a real `wrangler pages dev` server, because the
 * booking journey needs the Functions and D1 — testing the booking
 * form against a static build would only prove the markup.
 *
 * Before the first run:
 *   npm run build
 *   npx wrangler d1 execute quinton-carpets --local --file=./schema.sql
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",

  // The pages pull Archivo, Hanken Grotesk and DM Mono from Google
  // Fonts, and `load` waits on that stylesheet. font-display:swap
  // means a slow CDN never blocks the text, but it can slow a
  // navigation down — so give it room rather than flaking.
  timeout: 60_000,

  use: {
    baseURL: "http://localhost:8788",
    navigationTimeout: 45_000,
    trace: "on-first-retry",
    locale: "en-GB",
    timezoneId: "Europe/London",
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      // The banner sweep and the prototype comparison set their own
      // viewports at all four breakpoints, so running them again
      // under an emulated phone would only duplicate the work — and
      // fork the screenshot baselines. The journey and the
      // accessibility checks do belong here: touch, a real hamburger,
      // and a thumb on the calendar.
      testIgnore: [/banner\.spec\.ts/, /fidelity\.spec\.ts/],
    },
  ],

  webServer: {
    // No --d1/--kv flags: wrangler.toml already declares the bindings,
    // and passing them again creates a second, empty local database.
    command: "npx wrangler pages dev --port 8788",
    url: "http://localhost:8788/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
