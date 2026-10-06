// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { parseEpub } from "../lib/epub/parse";
import { buildEpub, TINY_PNG } from "./makeEpub";

const buffer = (bytes: Uint8Array) => bytes.buffer.slice(0) as ArrayBuffer;

describe("EPUB parsing", () => {
  test("reads title, author and spine order", () => {
    const book = parseEpub(
      buffer(
        buildEpub({
          title: "Notes on the Engine",
          author: "Charles Babbage",
          chapters: {
            "ch1.xhtml": "<html><body><h1>One</h1><p>Alpha.</p></body></html>",
            "ch2.xhtml": "<html><body><h1>Two</h1><p>Beta.</p></body></html>",
          },
        }),
      ),
    );

    expect(book.title).toBe("Notes on the Engine");
    expect(book.author).toBe("Charles Babbage");
    expect(book.sections).toHaveLength(2);
    expect(book.sections[0].html).toContain("Alpha.");
    expect(book.sections[1].html).toContain("Beta.");
  });

  test("reads titles from an EPUB3 nav document", () => {
    const book = parseEpub(
      buffer(
        buildEpub({
          chapters: {
            "ch1.xhtml": "<html><body><p>Alpha.</p></body></html>",
            "ch2.xhtml": "<html><body><p>Beta.</p></body></html>",
          },
        }),
      ),
    );

    expect(book.sections[0].title).toBe("ch1");
    expect(book.sections[1].title).toBe("ch2");
  });

  test("reads titles from an EPUB2 NCX", () => {
    const book = parseEpub(
      buffer(
        buildEpub({
          epub2: true,
          chapters: { "ch1.xhtml": "<html><body><p>Alpha.</p></body></html>" },
        }),
      ),
    );

    expect(book.sections[0].title).toBe("ch1");
  });

  /**
   * Real-world regression: EPUB files use HTML named entities, which strict XML
   * parsing rejects. This previously produced a book with no readable sections.
   */
  test("survives HTML named entities in content", () => {
    const book = parseEpub(
      buffer(
        buildEpub({
          chapters: {
            "ch1.xhtml":
              "<html><body><p>One&nbsp;two&mdash;three &amp; four &hellip;</p></body></html>",
          },
        }),
      ),
    );

    expect(book.sections).toHaveLength(1);
    expect(book.sections[0].html).toContain("two");
    expect(book.sections[0].html).toContain("three");
  });

  test("survives a DOCTYPE and unescaped ampersands", () => {
    const book = parseEpub(
      buffer(
        buildEpub({
          chapters: {
            "ch1.xhtml":
              "<!DOCTYPE html><html><body><p>Smith & Wesson & Co.</p></body></html>",
          },
        }),
      ),
    );

    expect(book.sections).toHaveLength(1);
    expect(book.sections[0].html).toContain("Wesson");
  });

  test("resolves images from inside the zip", () => {
    const book = parseEpub(
      buffer(
        buildEpub({
          chapters: {
            "ch1.xhtml": '<html><body><p>Look:</p><img src="images/fig.png" alt="A figure"/></body></html>',
          },
          extra: { "OEBPS/images/fig.png": TINY_PNG },
        }),
      ),
    );

    expect(book.sections[0].html).toContain("<img");
    expect(book.sections[0].html).toContain('alt="A figure"');
    expect(book.sections[0].html).toMatch(/src="blob:/);
    expect(book.images).toHaveLength(1);
  });

  test("drops an image reference that is not in the zip", () => {
    const book = parseEpub(
      buffer(
        buildEpub({
          chapters: { "ch1.xhtml": '<html><body><img src="missing.png"/></body></html>' },
        }),
      ),
    );

    expect(book.sections[0].html).not.toContain("<img");
    expect(book.images).toHaveLength(0);
  });

  test("resolves a parent-relative image path", () => {
    const book = parseEpub(
      buffer(
        buildEpub({
          chapters: {
            "text/ch1.xhtml": '<html><body><img src="../images/fig.png"/></body></html>',
          },
          extra: { "OEBPS/images/fig.png": TINY_PNG },
        }),
      ),
    );

    expect(book.sections[0].html).toMatch(/src="blob:/);
  });

  test("strips scripts and event handlers", () => {
    const book = parseEpub(
      buffer(
        buildEpub({
          chapters: {
            "ch1.xhtml":
              '<html><body><script>alert(1)</script><p onclick="alert(2)">Safe.</p><a href="javascript:alert(3)">x</a></body></html>',
          },
        }),
      ),
    );

    const html = book.sections[0].html;
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(");
    expect(html).not.toContain("onclick");
    expect(html.toLowerCase()).not.toContain("javascript:");
    expect(html).toContain("Safe.");
  });

  test("keeps headings, lists and emphasis", () => {
    const book = parseEpub(
      buffer(
        buildEpub({
          chapters: {
            "ch1.xhtml":
              "<html><body><h2>Title</h2><p>Body with <em>emphasis</em>.</p><ul><li>One</li></ul></body></html>",
          },
        }),
      ),
    );

    const html = book.sections[0].html;
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<em>emphasis</em>");
    expect(html).toContain("<li>One</li>");
  });

  test("rejects a file that is not an EPUB", () => {
    expect(() => parseEpub(buffer(new Uint8Array([1, 2, 3, 4])))).toThrow();
  });

  test("reports a missing container rather than returning nothing", () => {
    expect(() => parseEpub(buffer(new Uint8Array([0x50, 0x4b, 0x03, 0x04])))).toThrow(
      /container\.xml|valid EPUB/i,
    );
  });
});