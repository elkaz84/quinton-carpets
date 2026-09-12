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
  // Vercel's own image optimisation, not Astro's.
  // /ranges/ is server-rendered, so <Picture> emits /_image URLs that
  // have to be answered at request time — and Astro's endpoint is not
  // deployed on this adapter, so every photo on that page 404s
  // without this.
  adapter: vercel({ imageService: true }),
  // Pages keep their trailing slash via build.format "directory".
  // "always" would 308-redirect a POST to /api/bookings, so this is
  // left permissive and the API routes answer either spelling.
  trailingSlash: "ignore",
  build: { format: "directory" },
  // Photographs at quality 100 are indistinguishable from 78 and three
  // to five times the bytes. The showcase floors alone were arriving as
  // half a megabyte each. Carpet texture is forgiving of compression.
  image: { quality: 78 },
  vite: { plugins: [tailwindcss()] },
  devToolbar: { enabled: false },
});
