import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // pdf.js's standard build assumes browser-only globals; the legacy build
      // is the one it ships for Node.
      "pdfjs-dist": fileURLToPath(new URL("./node_modules/pdfjs-dist/legacy/build/pdf.mjs", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});