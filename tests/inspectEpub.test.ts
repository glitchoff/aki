// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { test } from "vitest";
import { unzipSync } from "fflate";

const FILE = "C:/Users/Abhay/Desktop/As a Man Thinketh - James Allen.epub";
const zip = unzipSync(new Uint8Array(readFileSync(FILE)));
const text = (p: string) => new TextDecoder().decode(zip[p]);

test("inspect", () => {
  for (const name of [
    "OEBPS/3467080318263483672_4507-h-0.htm.xhtml",
    "OEBPS/3467080318263483672_4507-h-1.htm.xhtml",
  ]) {
    const doc = new DOMParser().parseFromString(text(name), "text/html");
    const counts: Record<string, number> = {};
    for (const el of Array.from(doc.body.querySelectorAll("*"))) {
      const t = el.tagName.toLowerCase();
      counts[t] = (counts[t] ?? 0) + 1;
    }
    console.log(`\n=== ${name} ===`);
    console.log("tag counts:", JSON.stringify(counts, null, 1));
    console.log("body text length:", (doc.body.textContent ?? "").trim().length);
    // Direct children of body
    console.log(
      "body children:",
      Array.from(doc.body.children)
        .map((c) => c.tagName.toLowerCase())
        .join(","),
    );
  }
});