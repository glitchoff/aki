/** Elements kept as-is. */
const KEEP = new Set([
  "a", "abbr", "b", "bdi", "bdo", "blockquote", "br", "caption", "cite", "code", "col",
  "colgroup", "dd", "del", "dfn", "dl", "dt", "em", "figcaption", "figure", "h1", "h2",
  "h3", "h4", "h5", "h6", "hr", "i", "img", "ins", "kbd", "li", "mark", "ol", "p", "pre",
  "q", "rp", "rt", "ruby", "s", "samp", "small", "span", "strong", "sub", "summary",
  "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "u", "ul", "var",
  "wbr",
]);

/**
 * Elements replaced by their children.
 *
 * These carry document structure or presentational styling but no meaning of
 * their own in a reader. They must be *unwrapped*, not deleted: EPUB files in
 * the wild wrap the entire body text in <header>/<footer>, so removing them
 * would delete the book.
 */
const UNWRAP = new Set([
  "address", "article", "aside", "body", "center", "div", "fieldset", "figure",
  "font", "footer", "form", "header", "html", "label", "legend", "main", "nav",
  "nobr", "output", "section", "big", "tt", "strike", "center",
]);

/** Elements deleted with their contents: executable, embedded or replaced media. */
const DROP = new Set([
  "script", "style", "link", "meta", "title", "head", "base", "iframe", "object",
  "embed", "applet", "svg", "math", "canvas", "video", "audio", "source",
  "picture", "track", "template", "noscript", "input", "button", "select",
  "option", "textarea", "map", "area", "param", "dialog", "menu",
]);

const ALLOWED_ATTRS = new Set([
  "href", "src", "alt", "title", "colspan", "rowspan", "scope", "lang", "dir",
  "start", "datetime", "cite",
]);

/** Schemes safe to keep in href/src. blob: is what EPUB images resolve to. */
const SAFE_URL = /^(https?:|mailto:|blob:|#|\/|\.\/|\.\.\/|[^a-z0-9+.-]|$)/i;

/** Block-level children mean a <pre> is being misused and must not set pre-wrap. */
const BLOCK_SELECTOR = "div, p, h1, h2, h3, h4, h5, h6, ul, ol, li, table, blockquote";

function unwrap(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

/**
 * Allowlist sanitiser for untrusted document markup.
 *
 * Operates on parsed DOM rather than strings, so nothing can slip past with
 * entity tricks. Three outcomes per element: keep, unwrap (keep the children),
 * or drop (delete the content too).
 */
export function sanitizeFragment(root: Element): Element {
  const walk = (el: Element) => {
    // Snapshot the child list: the walk mutates it.
    for (const child of Array.from(el.children)) {
      const tag = child.tagName.toLowerCase();

      if (DROP.has(tag)) {
        child.remove();
        continue;
      }

      walk(child);

      if (UNWRAP.has(tag)) {
        unwrap(child);
        continue;
      }

      if (tag === "pre" && child.querySelector(BLOCK_SELECTOR)) {
        // A <pre> wrapping block content is not code; keep the text flowing.
        unwrap(child);
        continue;
      }

      if (!KEEP.has(tag)) {
        child.remove();
        continue;
      }

      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value.trim();

        if (name.startsWith("on") || !ALLOWED_ATTRS.has(name)) {
          child.removeAttribute(attr.name);
          continue;
        }

        if ((name === "href" || name === "src") && !SAFE_URL.test(value)) {
          child.removeAttribute(attr.name);
        }
      }

      if (tag === "a") {
        child.removeAttribute("target");
        child.removeAttribute("rel");
      }
    }
  };

  walk(root);
  return root;
}

/** Sanitises an HTML string, ready for dangerouslySetInnerHTML. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  sanitizeFragment(doc.body);
  return doc.body.innerHTML;
}

/**
 * Sanitises an EPUB content document.
 *
 * Parsed as HTML rather than XML on purpose: EPUB files are nominally XHTML but
 * use named entities such as &nbsp; that are undefined in XML, and strict XML
 * parsing rejects the entire document on the first one.
 */
export function sanitizeXhtml(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, "text/html");
  sanitizeFragment(doc.body);
  return doc.body.innerHTML;
}

/** Visible text length, used to drop sections that hold no readable content. */
export function textLength(html: string): number {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim().length;
}