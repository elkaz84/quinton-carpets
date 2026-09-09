import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against a real Astro server, because the booking journey needs
 * the API routes and the database — testing the booking form against
 * a static build would only prove the markup.
 *
 * Before the first run, point .env at a Supabase database and create
 * the tables:
 *   npm run db:setup
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
    baseURL: "http://localhost:4321",
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
    command: "npm run dev -- --port 4321",
    url: "http://localhost:4321/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
