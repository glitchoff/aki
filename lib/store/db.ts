import type { Book, Typography } from "../types";
import { DEFAULT_TYPOGRAPHY } from "../types";

const DB_NAME = "aki";
const DB_VERSION = 1;

const BOOKS = "books";
const FILES = "files";
const SETTINGS = "settings";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BOOKS)) db.createObjectStore(BOOKS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS);
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

/** ---------------------------------------------------------------------------
 * Library
 * ------------------------------------------------------------------------- */

export const library = {
  all: () => tx<Book[]>(BOOKS, "readonly", (s) => s.getAll() as IDBRequest<Book[]>).then(sortBooks),

  get: (id: string) => tx<Book | undefined>(BOOKS, "readonly", (s) => s.get(id)),

  put: (book: Book) => tx(BOOKS, "readwrite", (s) => s.put(book)),

  remove: async (id: string) => {
    await tx(BOOKS, "readwrite", (s) => s.delete(id));
    await tx(FILES, "readwrite", (s) => s.delete(id));
    await tx(SETTINGS, "readwrite", (s) => s.delete(id));
  },

  saveFile: (id: string, data: ArrayBuffer) =>
    tx(FILES, "readwrite", (s) => s.put(data, id) as IDBRequest<IDBValidKey>),

  loadFile: (id: string) =>
    tx<ArrayBuffer | undefined>(FILES, "readonly", (s) => s.get(id) as IDBRequest<ArrayBuffer | undefined>),

  async add(book: Book, data: ArrayBuffer): Promise<void> {
    await this.saveFile(book.id, data);
    await this.put(book);
  },

  async progress(id: string, patch: Partial<Book>): Promise<void> {
    const book = await this.get(id);
    if (!book) return;
    await this.put({ ...book, ...patch });
  },
};

function sortBooks(books: Book[]): Book[] {
  return books.sort((a, b) => b.addedAt - a.addedAt);
}

/** ---------------------------------------------------------------------------
 * Typography settings
 * ------------------------------------------------------------------------- */

const GLOBAL_KEY = "__global__";

export const settings = {
  async for(bookId: string): Promise<Typography> {
    const global = await this.global();
    const perBook = await tx<Typography | undefined>(SETTINGS, "readonly", (s) => s.get(bookId));
    return { ...global, ...(perBook ?? {}) };
  },

  /** The global (app-wide) typography, with defaults when unset. */
  async global(): Promise<Typography> {
    const global = await tx<Typography | undefined>(SETTINGS, "readonly", (s) =>
      s.get(GLOBAL_KEY),
    );
    return global ?? DEFAULT_TYPOGRAPHY;
  },

  setGlobal: (value: Typography) =>
    tx(SETTINGS, "readwrite", (s) => s.put(value, GLOBAL_KEY) as IDBRequest<IDBValidKey>),

  setForBook: (bookId: string, value: Typography) =>
    tx(SETTINGS, "readwrite", (s) => s.put(value, bookId) as IDBRequest<IDBValidKey>),

  resetForBook: (bookId: string) => tx(SETTINGS, "readwrite", (s) => s.delete(bookId)),
};

/** Maps settings onto CSS custom properties on the scroll container. */
export function typographyVars(
  t: Typography,
  theme: Exclude<Typography["theme"], "system">,
): React.CSSProperties {
  const palette = BACKGROUNDS[theme];
  return {
    "--r-font-size": `${t.fontSize}px`,
    "--r-line-height": String(t.lineHeight),
    "--r-margin": `${t.margin}px`,
    "--r-justify": t.justify ? "justify" : "start",
    "--r-font-family": FONT_STACKS[t.fontFamily] ?? FONT_STACKS.serif,
    "--r-bg": palette.bg,
    "--r-fg": palette.fg,
    "--r-dim": palette.dim,
    "--r-accent": ACCENTS[theme],
    "--r-panel": PANELS[theme],
  } as React.CSSProperties;
}

const ACCENTS: Record<Exclude<Typography["theme"], "system">, string> = {
  light: "#111111",
  sepia: "#8a6f4d",
  dark: "#c2a878",
};

const PANELS: Record<Exclude<Typography["theme"], "system">, string> = {
  light: "#ffffff",
  sepia: "#fbf6ec",
  dark: "#1c1c1c",
};

export const FONT_STACKS: Record<string, string> = {
  serif: "Iowan Old Style, Charter, Georgia, Cambria, 'Times New Roman', serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
};

const BACKGROUNDS: Record<Exclude<Typography["theme"], "system">, { bg: string; fg: string; dim: string }> = {
  light: { bg: "#ffffff", fg: "#111111", dim: "#6b7280" },
  sepia: { bg: "#f6ecd9", fg: "#3b2f21", dim: "#8a7a63" },
  dark: { bg: "#121212", fg: "#d8d8d8", dim: "#7a7a7a" },
};