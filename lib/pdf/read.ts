import { marked } from "marked";
import { loadInspector } from "./inspector";
import { sanitizeHtml, sanitizeXhtml } from "../sanitize";

/** One renderable unit of a PDF: the extracted content of a single page. */
export type PdfUnit = {
  page: number;
  /** Sanitized HTML ready for dangerouslySetInnerHTML. */
  html: string;
};

export type PdfRead = {
  pageCount: number;
  units: PdfUnit[];
  pdfType: string;
  /** 1-indexed pages with no usable text layer. */
  pagesNeedingOcr: number[];
  confidence: number;
  title?: string;
  author?: string;
  /** Fraction of pages that yielded real text. */
  textCoverage: number;
  /** True when the document is mostly images and page-image mode should win. */
  preferPageImages: boolean;
};

const PAGE_MARKER = /^<!--\s*Page\s+(\d+)\s*-->$/;

/**
 * Parses a PDF into per-page HTML.
 *
 * Layout analysis — reading order, columns, tables, headings, hyphenation and
 * running-header removal — is done by pdf-inspector rather than reconstructed
 * here, because those decisions are the whole difficulty of PDF reflow.
 */
export async function readPdf(data: Uint8Array): Promise<PdfRead> {
  const inspector = await loadInspector();

  const result = inspector.processPdf(new Uint8Array(data), {
    includePageMarkers: true,
    includeImages: true,
    profile: "fidelity",
  });

  const markdown = result.markdown ?? "";
  const units = splitPages(markdown, result.pageCount);

  const pagesNeedingOcr = result.pagesNeedingOcr ?? [];
  const textCoverage = result.pageCount
    ? (result.pageCount - pagesNeedingOcr.length) / result.pageCount
    : 0;

  return {
    pageCount: result.pageCount,
    units,
    pdfType: result.pdfType,
    pagesNeedingOcr,
    confidence: result.confidence,
    title: result.title,
    author: result.author,
    textCoverage,
    // Below half the pages having text, the page images are the better read.
    preferPageImages: textCoverage < 0.5 || result.pdfType === "Scanned",
  };
}

/**
 * Splits page-marked markdown into one HTML document per page.
 *
 * The virtualiser needs a stable unit per page so that scrolling, progress and
 * re-layout on a font-size change all line up with the document.
 */
export function splitPages(markdown: string, pageCount: number): PdfUnit[] {
  const units: PdfUnit[] = [];

  let current = 1;
  let buffer: string[] = [];
  let sawMarker = false;

  const flush = () => {
    const source = buffer.join("\n").trim();
    if (source) units.push({ page: current, html: renderMarkdown(source) });
    buffer = [];
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const marker = PAGE_MARKER.exec(rawLine.trim());
    if (marker) {
      if (sawMarker) flush();
      sawMarker = true;
      current = Number(marker[1]);
      continue;
    }
    buffer.push(rawLine);
  }
  flush();

  // A document with no markers at all is still readable as one unit.
  if (!units.length && markdown.trim()) {
    units.push({ page: 1, html: renderMarkdown(markdown) });
  }

  // Keep one unit per page so positions line up with the original document.
  if (pageCount > units.length) {
    const filler: PdfUnit[] = [];
    for (let page = 1; page <= pageCount; page++) {
      const found = units.find((u) => u.page === page);
      filler.push(found ?? { page, html: "" });
    }
    return filler;
  }

  return units;
}

/** Markdown -> sanitised HTML. */
export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false, gfm: true, breaks: false }) as string;
  return sanitizeHtml(html);
}

/** EPUB sections are XHTML; they only need the same allowlist treatment. */
export { sanitizeXhtml };