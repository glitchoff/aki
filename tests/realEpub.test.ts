// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parseEpub } from "../lib/epub/parse";
import { textLength } from "../lib/sanitize";

const FILE = "C:/Users/Abhay/Desktop/As a Man Thinketh - James Allen.epub";

function load(): ArrayBuffer {
  const bytes = readFileSync(FILE);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

describe("real-world EPUB", () => {
  test("yields readable text", () => {
    const book = parseEpub(load());

    const perSection = book.sections.map((s) => ({
      title: s.title,
      chars: textLength(s.html),
      html: s.html.length,
    }));

    console.log("title:", book.title);
    console.log("author:", book.author);
    console.log("sections:", perSection.length);
    console.log(perSection);

    const total = perSection.reduce((n, s) => n + s.chars, 0);
    console.log("total readable chars:", total);

    // The cover page carries no prose and must not become a chapter.
    for (const section of perSection) {
      expect(section.chars).toBeGreaterThan(200);
    }

    expect(total).toBeGreaterThan(20_000);
    expect(book.sections.some((s) => /thinketh/i.test(s.html))).toBe(true);
  }, 120_000);

  test("does not wrap the whole book in <pre>", () => {
    const book = parseEpub(load());
    for (const section of book.sections) {
      // A <pre> around block content would defeat reflow; the sanitiser
      // unwraps those, so only a genuine code block may remain.
      expect(section.html).not.toMatch(/<pre>[\s\S]*<(h1|h2|h3|p|div)\b/);
    }
  }, 120_000);
});