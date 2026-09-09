// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// Static by default. Only the pages that genuinely need a server
// (/booking/[ref]/ and /admin/) opt out with `export const prerender = false`.
export default defineConfig({
  site: "https://www.quintoncarpets.co.uk",
  output: "static",
  adapter: cloudflare({ imageService: "compile" }),
  // Pages keep their trailing slash via build.format "directory".
  // "always" would 308-redirect a POST to /api/bookings, so this is
  // left permissive and the API routes answer either spelling.
  trailingSlash: "ignore",
  build: { format: "directory" },
  vite: { plugins: [tailwindcss()] },
  devToolbar: { enabled: false },
});
