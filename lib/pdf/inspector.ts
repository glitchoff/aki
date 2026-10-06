export type Inspector = typeof import("@firecrawl/pdf-inspector-wasm");

/**
 * Where the WASM binary is served from. Staged into public/ at build time by
 * scripts/stage-wasm.mjs, so the same URL works in dev, in a static export and
 * inside the Capacitor webview.
 */
export const WASM_URL = "wasm/pdf_inspector.wasm";

let ready: Promise<Inspector> | null = null;

async function boot(): Promise<Inspector> {
  const inspector = await import("@firecrawl/pdf-inspector-wasm");

  // In a browser the binary comes over HTTP; elsewhere (tests) the caller
  // primes it with primeInspector instead.
  if (typeof fetch === "function") {
    const response = await fetch(WASM_URL);
    if (!response.ok) {
      throw new Error(`Could not load the PDF parser (${response.status})`);
    }
    await inspector.default(await response.arrayBuffer());
  }

  return inspector;
}

/**
 * Loads and initialises the PDF layout parser once per app session.
 *
 * The module is a few megabytes, so callers should treat the first call as
 * something to do while the reader is opening, and reuse the promise after.
 */
export function loadInspector(): Promise<Inspector> {
  ready ??= boot();
  return ready;
}

/**
 * Supplies an already-initialised parser instead of fetching the binary.
 * Used by tests, and by anything that wants to warm the parser during idle.
 */
export function primeInspector(module: Inspector): void {
  ready = Promise.resolve(module);
}

/** Test seam: drops the cached parser. */
export function resetInspector(): void {
  ready = null;
}