import type { PDFDocumentProxy } from "pdfjs-dist";

let configured = false;

async function configure() {
  if (configured) return;
  configured = true;
  // In Node (tests) pdf.js falls back to its in-process fake worker; pointing
  // workerSrc at a bundler URL would break it.
  if (typeof window === "undefined") return;

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url,
  ).toString();
}

export type LoadedPdf = {
  doc: PDFDocumentProxy;
  destroy: () => Promise<void>;
};

/** Opens a PDF with pdf.js, used only for rendering original page images. */
export async function loadPdf(data: ArrayBuffer | Uint8Array): Promise<LoadedPdf> {
  await configure();
  const pdfjs = await import("pdfjs-dist");

  // Copy: pdf.js transfers the buffer to its worker, detaching the caller's.
  const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice(0));
  const task = pdfjs.getDocument({ data: bytes });
  const doc = await task.promise;

  return { doc, destroy: () => task.destroy() };
}

/** Document metadata, for the library entry. */
export async function readPdfInfo(data: ArrayBuffer) {
  const { doc, destroy } = await loadPdf(data);
  try {
    const info = (await doc.getMetadata()).info as {
      Title?: string;
      Author?: string;
      PDFFormatVersion?: string;
    };
    return {
      title: info.Title?.trim() || undefined,
      author: info.Author?.trim() || undefined,
      pageCount: doc.numPages,
    };
  } finally {
    await destroy();
  }
}