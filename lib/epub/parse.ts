import { unzipSync } from "fflate";
import { sanitizeXhtml } from "../sanitize";
import type { EpubBook, EpubSection } from "../types";

type Zip = Record<string, Uint8Array>;

const decoder = new TextDecoder("utf-8");

function readText(zip: Zip, path: string): string | null {
  const bytes = zip[path];
  if (!bytes) return null;
  return decoder.decode(bytes);
}

/** Normalizes "a/b/../c" style relative paths against a base directory. */
function resolvePath(base: string, relative: string): string {
  if (/^[a-z]+:/i.test(relative)) return relative;
  const stack = base.split("/").slice(0, -1);
  for (const part of relative.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

/**
 * Parses EPUB markup leniently, as HTML rather than XML.
 *
 * EPUB documents are nominally XHTML but routinely contain HTML named entities
 * (&nbsp;, &mdash;), unescaped ampersands and other constructs that strict XML
 * parsing rejects outright. HTML parsing recovers from all of them.
 */
function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "text/html");
}

function mimeOf(path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    svg: "image/svg+xml", webp: "image/webp",
  };
  return map[ext] ?? "application/octet-stream";
}

/**
 * Rewrites image references to blob URLs so figures render from inside the zip.
 * Runs before sanitisation, which then allowlists what survives.
 */
function rewriteImages(root: Element, base: string, zip: Zip, objectUrls: string[]): void {
  for (const img of Array.from(root.getElementsByTagName("img"))) {
    const src = img.getAttribute("src");
    if (!src) continue;

    const bytes = zip[resolvePath(base, src)];
    if (!bytes) {
      img.remove();
      continue;
    }

const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeOf(src) }));
    objectUrls.push(url);
    img.setAttribute("src", url);
  }
}

/** ---------------------------------------------------------------------------
 * Parse
 * ------------------------------------------------------------------------- */

export function parseEpub(data: ArrayBuffer): EpubBook {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(new Uint8Array(data));
  } catch {
    throw new Error("Not a valid EPUB: could not read archive");
  }

  // 1. container.xml -> OPF path
  const containerText = readText(zip, "META-INF/container.xml");
  if (!containerText) throw new Error("Not a valid EPUB: missing META-INF/container.xml");

  const opfPath = parseXml(containerText)
    .getElementsByTagName("rootfile")[0]
    ?.getAttribute("full-path");
  if (!opfPath) throw new Error("Not a valid EPUB: no rootfile in container.xml");

  // 2. OPF -> manifest + spine
  const opfText = readText(zip, opfPath);
  if (!opfText) throw new Error(`EPUB rootfile missing: ${opfPath}`);
  const opf = parseXml(opfText);

  const title =
    opf.getElementsByTagName("dc:title")[0]?.textContent?.trim() || "Untitled";
  const author =
    opf.getElementsByTagName("dc:creator")[0]?.textContent?.trim() || undefined;

  const manifest = new Map<string, { href: string; type: string; properties: string }>();
  for (const item of Array.from(opf.getElementsByTagName("item"))) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (!id || !href) continue;
    manifest.set(id, {
      href: resolvePath(opfPath, decodeURIComponent(href)),
      type: item.getAttribute("media-type") ?? "",
      properties: item.getAttribute("properties") ?? "",
    });
  }

  // 3. nav titles (EPUB3 nav doc, else EPUB2 NCX)
  const titles = readNavTitles(zip, opf, manifest);

  // 4. spine -> sections
  const objectUrls: string[] = [];
  const sections: EpubSection[] = [];
  const images: { src: string; alt: string }[] = [];

  for (const ref of Array.from(opf.getElementsByTagName("itemref"))) {
    const idref = ref.getAttribute("idref");
    if (!idref) continue;
    const entry = manifest.get(idref);
    if (!entry) continue;
    if (entry.properties.includes("nav")) continue;

const xhtml = readText(zip, entry.href);
    if (!xhtml) continue;

    const root = parseXml(xhtml).body;
    const heading =
      root.getElementsByTagName("h1")[0]?.textContent?.trim() ||
      root.getElementsByTagName("h2")[0]?.textContent?.trim() ||
      "";

    // Rewrite images to blob URLs, then run the allowlist sanitiser over the
    // whole section; only the sanitised markup is ever rendered.
    rewriteImages(root, entry.href, zip, objectUrls);

    const html = sanitizeXhtml(root.innerHTML);
    if (!html.trim()) continue;

    sections.push({
      id: idref,
      href: entry.href,
      title: titles.get(idref) || heading || `Section ${sections.length + 1}`,
      html,
    });
  }

  if (!sections.length) throw new Error("EPUB contained no readable sections");

  // Record the images in spine order so figures can be listed book-wide.
  for (const section of sections) {
    const doc = parseXml(section.html);
    for (const img of Array.from(doc.getElementsByTagName("img"))) {
      const src = img.getAttribute("src");
      if (src) images.push({ src, alt: img.getAttribute("alt") ?? "" });
    }
  }

  return { title, author, sections, images };
}

function readNavTitles(
  zip: Zip,
  opf: Document,
  manifest: Map<string, { href: string; type: string; properties: string }>,
): Map<string, string> {
  const titles = new Map<string, string>();

  // EPUB 3: manifest item with properties="nav"
  for (const entry of manifest.values()) {
    if (!entry.properties.split(/\s+/).includes("nav")) continue;
    const navText = readText(zip, entry.href);
    if (!navText) continue;
    for (const a of Array.from(parseXml(navText).getElementsByTagName("a"))) {
      const href = a.getAttribute("href");
      const label = a.textContent?.trim();
      if (!href || !label) continue;
      const path = resolvePath(entry.href, decodeURIComponent(href.split("#")[0]));
      for (const [mid, m] of manifest) if (m.href === path && !titles.has(mid)) titles.set(mid, label);
    }
    break;
  }

  // EPUB 2: NCX referenced by spine@toc
  if (titles.size === 0) {
    const ncxId = opf.getElementsByTagName("spine")[0]?.getAttribute("toc");
    const ncx = ncxId ? manifest.get(ncxId) : undefined;
    const ncxText = ncx ? readText(zip, ncx.href) : null;
    if (ncx && ncxText) {
      const ncxDoc = parseXml(ncxText);
      for (const point of Array.from(ncxDoc.getElementsByTagName("navPoint"))) {
        const src = point.getElementsByTagName("content")[0]?.getAttribute("src");
        const label = point.getElementsByTagName("navLabel")[0]?.textContent?.trim();
        if (!src || !label) continue;
        const path = resolvePath(ncx.href, decodeURIComponent(src.split("#")[0]));
        for (const [mid, m] of manifest) if (m.href === path && !titles.has(mid)) titles.set(mid, label);
      }
    }
  }
  return titles;
}

