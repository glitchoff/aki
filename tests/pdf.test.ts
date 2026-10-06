// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, test } from "vitest";
import { buildPdf, imageOp, textOp } from "./makePdf";
import { primeInspector } from "../lib/pdf/inspector";
import { renderMarkdown, splitPages } from "../lib/pdf/read";

const LONG =
  "The quick brown fox jumps over the lazy dog while the sun sets slowly behind distant hills.";

/** readPdf() fetches its wasm over HTTP; in tests we hand it the bytes. */
beforeAll(async () => {
  const inspector = await import("@firecrawl/pdf-inspector-wasm");
  await inspector.default(
    readFileSync("node_modules/@firecrawl/pdf-inspector-wasm/pdf_inspector_wasm_bg.wasm"),
  );
  primeInspector(inspector);
});

describe("splitPages", () => {
  test("splits on page markers", () => {
    const units = splitPages("<!-- Page 1 -->\n\nFirst.\n\n<!-- Page 2 -->\n\nSecond.", 2);
    expect(units).toHaveLength(2);
    expect(units[0].page).toBe(1);
    expect(units[1].page).toBe(2);
    expect(units[0].html).toContain("First.");
    expect(units[1].html).toContain("Second.");
  });

  test("keeps one unit per page when a page yields no text", () => {
    const units = splitPages("<!-- Page 1 -->\n\nFirst.", 3);
    expect(units).toHaveLength(3);
    expect(units[0].html).toContain("First.");
    expect(units[1].html).toBe("");
    expect(units[2].html).toBe("");
  });

  test("treats unmarked output as a single unit", () => {
    const units = splitPages("Just some text.", 1);
    expect(units).toHaveLength(1);
    expect(units[0].html).toContain("Just some text.");
  });

  test("handles empty output", () => {
    expect(splitPages("", 4)).toHaveLength(4);
  });
});

describe("renderMarkdown", () => {
  test("renders headings, emphasis and lists", () => {
    const html = renderMarkdown("# Title\n\nSome **bold** and *italic*.\n\n- one\n- two");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<li>one</li>");
  });

  test("renders tables", () => {
    const html = renderMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain("<td");
  });

  test("strips script tags", () => {
    const html = renderMarkdown("Hello\n\n<script>alert(1)</script>\n\nWorld");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  test("strips javascript: urls", () => {
    const html = renderMarkdown("[click](javascript:alert(1))");
    expect(html.toLowerCase()).not.toContain("javascript:");
  });

  test("strips inline event handlers", () => {
    const html = renderMarkdown('<p onclick="alert(1)">hi</p>');
    expect(html.toLowerCase()).not.toContain("onclick");
  });
});

describe("readPdf end to end", () => {
  test("returns one sanitised unit per page with real text", async () => {
    const { readPdf } = await import("../lib/pdf/read");
    const pdf = buildPdf([
      textOp("Chapter One", 72, 760, 9) +
        textOp("Introduction", 72, 700, 20, true) +
        textOp(LONG, 72, 660) +
        textOp(LONG, 72, 646) +
        textOp(LONG, 72, 632) +
        textOp("A second paragraph begins here and", 72, 600) +
        textOp("continues on the next line.", 72, 586),
      textOp(LONG, 72, 700) + textOp(LONG, 72, 686) + textOp(LONG, 72, 672),
    ]);

    const read = await readPdf(pdf);

    expect(read.pageCount).toBe(2);
    expect(read.units).toHaveLength(2);
    expect(read.preferPageImages).toBe(false);
    expect(read.textCoverage).toBe(1);

    // The heading must survive as a heading, and the text must be present.
    expect(read.units[0].html).toContain("<h1>Introduction</h1>");
    expect(read.units[0].html).toContain("quick brown fox");
    expect(read.units[0].html).toContain("A second paragraph begins here and continues");
  }, 60_000);

  test("an image-only document falls back to page images", async () => {
    const { readPdf } = await import("../lib/pdf/read");
    const read = await readPdf(buildPdf([imageOp(100, 400)], true));

    expect(read.pageCount).toBe(1);
    expect(read.preferPageImages).toBe(true);
    expect(read.textCoverage).toBe(0);
  }, 60_000);

  test("reads two columns in column order", async () => {
    const { readPdf } = await import("../lib/pdf/read");
    const column = (x: number) =>
      Array.from({ length: 14 }, (_, i) =>
        textOp(`Mark${x}${i} the quick brown fox jumps over things`, x, 700 - i * 14),
      ).join("");

    const read = await readPdf(buildPdf([column(72) + column(340)]));
    const html = read.units[0].html;

    expect(html).toContain("Mark72");
    expect(html).toContain("Mark340");
    expect(html.indexOf("Mark72")).toBeLessThan(html.indexOf("Mark340"));
  }, 60_000);
});