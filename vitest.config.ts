import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The pure modules only. The end-to-end specs are Playwright's.
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
  },
});
