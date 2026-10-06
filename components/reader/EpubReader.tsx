"use client";

import { useEffect, useState } from "react";
import type { EpubSection, Typography } from "@/lib/types";
import { Window } from "./Window";
import { Spinner } from "./Spinner";

type Props = {
  data: ArrayBuffer;
  typography: Typography;
  onProgress?: (section: number, total: number) => void;
};

export function EpubReader({ data, typography, onProgress }: Props) {
  const [sections, setSections] = useState<EpubSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    import("@/lib/epub/parse")
      .then(({ parseEpub }) => parseEpub(data))
      .then((book) => !cancelled && setSections(book.sections))
      .catch((err) =>
        !cancelled && setError(err instanceof Error ? err.message : "Failed to read EPUB"),
      );

    return () => {
      cancelled = true;
    };
  }, [data]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-[var(--r-dim)]">
        {error}
      </div>
    );
  }

  if (!sections) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-sm text-[var(--r-dim)]">Opening book…</p>
        </div>
      </div>
    );
  }

  // EPUB images already sit in the correct place in the markup, so they flow
  // inline with the text — no repositioning needed.
  return (
    <Window
      items={sections}
      keyOf={keyOfSection}
      estimateHeight={900}
      render={(section) => (
        <article
          className="article epub text-[var(--r-fg)]"
          style={{
            fontSize: "var(--r-font-size)",
            lineHeight: "var(--r-line-height)",
            textAlign: typography.justify ? "justify" : "start",
          }}
          dangerouslySetInnerHTML={{ __html: section.html }}
        />
      )}
      onVisibleIndex={(index) =>
        onProgress?.(Math.min(index + 1, sections.length), sections.length)
      }
    />
  );
}

function keyOfSection(section: EpubSection): string {
  return section.id;
}