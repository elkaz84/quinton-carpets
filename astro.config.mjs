// @ts-check
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import tailwindcss from "@tailwindcss/vite";

// Static by default. Only the pages that genuinely need a server
// (/ranges/, /book/, /booking/[ref]/ and /admin/) opt out with
// `export const prerender = false`.
export default defineConfig({
  site: "https://www.quintoncarpets.co.uk",
  output: "static",
  adapter: vercel(),
  // Pages keep their trailing slash via build.format "directory".
  // "always" would 308-redirect a POST to /api/bookings, so this is
  // left permissive and the API routes answer either spelling.
  trailingSlash: "ignore",
  build: { format: "directory" },
  vite: { plugins: [tailwindcss()] },
  devToolbar: { enabled: false },
});
