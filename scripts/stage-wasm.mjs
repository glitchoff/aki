/**
 * Copies the pdf-inspector WASM binary into public/ so the reader can fetch it
 * at a stable URL. Done at build time rather than imported through the bundler,
 * because .wasm imports are not portable across Next.js/Turbopack, static
 * export and the Capacitor webview.
 */
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/@firecrawl/pdf-inspector-wasm/pdf_inspector_wasm_bg.wasm");
const targetDir = resolve(root, "public/wasm");
const target = resolve(targetDir, "pdf_inspector.wasm");

try {
  const info = await stat(source);
  await mkdir(targetDir, { recursive: true });
  await copyFile(source, target);
  console.log(`pdf-inspector wasm -> public/wasm (${Math.round(info.size / 1024)} KB)`);
} catch (error) {
  console.error("Could not stage the pdf-inspector wasm binary.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}