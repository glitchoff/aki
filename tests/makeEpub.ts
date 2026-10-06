/** Builds minimal but valid EPUB files in memory for tests. */
import { zipSync, strToU8 } from "fflate";

type Options = {
  title?: string;
  author?: string;
  /** Content documents, keyed by filename under OEBPS/. */
  chapters?: Record<string, string>;
  /** Extra files, e.g. images. */
  extra?: Record<string, Uint8Array>;
  /** Use EPUB2 (NCX) instead of an EPUB3 nav document. */
  epub2?: boolean;
};

export function buildEpub(options: Options = {}): Uint8Array {
  const title = options.title ?? "A Test Book";
  const author = options.author ?? "Ada Lovelace";
  const chapters = options.chapters ?? {
    "ch1.xhtml": `<html><body><h1>Chapter One</h1><p>It was a dark and stormy night.</p></body></html>`,
  };

  const chapterNames = Object.keys(chapters);

  const manifestItems = chapterNames
    .map(
      (name) =>
        `<item id="${name.replace(/\W/g, "")}" href="${name}" media-type="application/xhtml+xml"/>`,
    )
    .join("\n    ");

  const spineRefs = chapterNames
    .map((name) => `<itemref idref="${name.replace(/\W/g, "")}"/>`)
    .join("\n    ");

  const nav = `<?xml version="1.0" encoding="utf-8"?>
    <nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops">
      <h1>Contents</h1>
      <ol>
        ${chapterNames.map((n) => `<li><a href="${n}">${n.replace(".xhtml", "")}</a></li>`).join("")}
      </ol>
    </nav>`;

  const ncxPoints = chapterNames
    .map(
      (n) =>
        `<navPoint id="${n}" playOrder="${chapterNames.indexOf(n) + 1}"><navLabel><text>${n.replace(".xhtml", "")}</text></navLabel><content src="${n}"/></navPoint>`,
    )
    .join("");

  const ncx = `<?xml version="1.0" encoding="utf-8"?>
    <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
      <head><meta name="dtb:uid" content="test"/></head>
      <docTitle><text>${title}</text></docTitle>
      <navMap>${ncxPoints}</navMap>
    </ncx>`;

  const files: Record<string, Uint8Array> = {
    "mimetype": strToU8("application/epub+zip"),

    "META-INF/container.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
      </container>`,
    ),

    "OEBPS/content.opf": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?>
      <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>${title}</dc:title>
          <dc:creator>${author}</dc:creator>
        </metadata>
        <manifest>
          ${manifestItems}
          ${
            options.epub2
              ? `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`
              : `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`
          }
        </manifest>
        <spine${options.epub2 ? ' toc="ncx"' : ""}>
          ${spineRefs}
        </spine>
      </package>`,
    ),

    "OEBPS/nav.xhtml": strToU8(nav),
    "OEBPS/toc.ncx": strToU8(ncx),
  };

  for (const [name, content] of Object.entries(chapters)) {
    files[`OEBPS/${name}`] = strToU8(content);
  }

  return zipSync({ ...files, ...(options.extra ?? {}) }, { level: 0 });
}

/** A 1x1 transparent PNG, for image-in-EPUB tests. */
export const TINY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);