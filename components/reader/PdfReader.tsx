import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useState } from "react";
import type { Typography } from "@/lib/types";
import { Window } from "./Window";
import { PageCanvas } from "./PageCanvas";
import { Spinner } from "./Spinner";

type Props = {
  file: ArrayBuffer;
  typography: Typography;
  onProgress?: (page: number, total: number) => void;
};

/** Either a page index (original-page mode) or a parsed page of content. */
type Unit = number | { page: number; html: string };

export function PdfReader({ file, typography, onProgress }: Props) {
  const [read, setRead] = useState<Awaited<ReturnType<typeof import("@/lib/pdf/read")["readPdf"]>> | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Parse the document: layout analysis, reading order, tables, headings.
  useEffect(() => {
    let cancelled = false;

    import("@/lib/pdf/read")
      .then(({ readPdf }) => readPdf(new Uint8Array(file.slice(0))))
      .then((result) => !cancelled && setRead(result))
      .catch((err) =>
        !cancelled &&
        setError(err instanceof Error ? err.message : "Could not read this PDF"),
      );

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Page images are only needed in original-page mode, so pdf.js loads lazily.
  // The document is kept once loaded: switching modes back is then instant, and
  // this component is keyed per book so it never needs clearing.
  const wantPages = read?.preferPageImages || typography.mode === "page";

  useEffect(() => {
    if (!wantPages) return;

    let cancelled = false;
    let loaded: { doc: PDFDocumentProxy; destroy: () => Promise<void> } | null = null;

    import("@/lib/pdf/pages")
      .then(({ loadPdf }) => loadPdf(file))
      .then((result) => {
        loaded = result;
        if (cancelled) {
          void result.destroy();
          return;
        }
        setDoc(result.doc);
      })
      .catch(() => {
        /* page mode unavailable; reflow content still shows */
      });

    return () => {
      cancelled = true;
      void loaded?.destroy();
    };
  }, [wantPages, file]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-[var(--r-dim)]">
        {error}
      </div>
    );
  }

  if (!read) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-sm text-[var(--r-dim)]">Reading layout…</p>
        </div>
      </div>
    );
  }

  const pageMode = read.preferPageImages || typography.mode === "page";
  const pageCount = read.pageCount || doc?.numPages || 1;
  const units: Unit[] = pageMode
    ? Array.from({ length: pageCount }, (_, i) => i)
    : read.units;

  return (
    <Window<Unit>
      items={units}
      keyOf={keyOfUnit}
      estimateHeight={pageMode ? 1200 : 900}
      render={(unit) =>
        pageMode && doc ? (
          <PageCanvas pdf={doc} pageNumber={(unit as number) + 1} />
        ) : (
          <ReflowPage unit={unit as { page: number; html: string }} />
        )
      }
      onVisibleIndex={(index) => onProgress?.(index + 1, pageCount)}
    />
  );
}

function keyOfUnit(unit: Unit): string {
  return typeof unit === "number" ? `p${unit}` : `t${unit.page}`;
}

function ReflowPage({ unit }: { unit: { page: number; html: string } }) {
  if (!unit.html) return <div className="h-8" />;

  return (
    <article
      className="article pdf text-[var(--r-fg)]"
      style={{ fontSize: "var(--r-font-size)", lineHeight: "var(--r-line-height)" }}
      dangerouslySetInnerHTML={{ __html: unit.html }}
    />
  );
}