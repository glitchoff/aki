export type BookKind = "pdf" | "epub";

export type Book = {
  id: string;
  title: string;
  author?: string;
  kind: BookKind;
  /** Total pages (pdf) or spine sections (epub). */
  units: number;
  addedAt: number;
  /** Percent 0..100. */
  progress?: number;
  /** Last spine/page id read. */
  locator?: string;
  cover?: Blob;
};

/** A single glyph run at a fixed position on a PDF page. */
export type TextRun = {
  text: string;
  /** Baseline x. */
  x: number;
  /** Baseline y (PDF space, grows upward). */
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  fontFamily: string;
  eol: boolean;
};

/** Runs sharing a baseline, sorted left to right. */
export type Line = {
  runs: TextRun[];
  x0: number;
  x1: number;
  y: number;
  fontSize: number;
  column: number;
};

export type Span = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

export type BlockKind = "p" | "h1" | "h2" | "h3" | "li" | "blockquote" | "img";

/** A reconstructed paragraph (or, for "img", an extracted figure). */
export type Block = {
  kind: BlockKind;
  spans: Span[];
  page: number;
  /** Baseline y of the block's first line, PDF space. Images use their top edge. */
  y: number;
  /** Set for "img" blocks. */
  src?: string;
};

export type ReflowedPage = {
  page: number;
  width: number;
  height: number;
  blocks: Block[];
  /** False when the page had too little text to reflow (scanned/image PDF). */
  reflowable: boolean;
};

export type Typography = {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  margin: number;
  justify: boolean;
  theme: "system" | "light" | "sepia" | "dark";
  /** Render reflowed text, or show original page images. */
  mode: "reflow" | "page";
};

export const DEFAULT_TYPOGRAPHY: Typography = {
  fontSize: 19,
  lineHeight: 1.6,
  fontFamily: "serif",
  margin: 22,
  justify: true,
  theme: "system",
  mode: "reflow",
};

export type EpubSection = {
  id: string;
  href: string;
  title: string;
  /** Sanitized XHTML body markup. */
  html: string;
};

export type EpubBook = {
  title: string;
  author?: string;
  sections: EpubSection[];
  /** Every raster image in the book, in spine order. */
  images: { src: string; alt: string }[];
};