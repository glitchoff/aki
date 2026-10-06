"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

type Props = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
};

/** Renders one original PDF page to a canvas, DPR-aware and resize-safe. */
export function PageCanvas({ pdf, pageNumber }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;

      const parent = canvas.parentElement;
      const available = parent?.clientWidth ?? 800;

      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(3, (available - 16) / base.width);
      const viewport = page.getViewport({ scale });

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      setSize({ width: viewport.width, height: viewport.height });

      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
      });

      try {
        await renderTask.promise;
      } catch {
        /* cancelled by unmount */
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber]);

  return (
    <div className="flex justify-center py-4" style={{ minHeight: size?.height ? size.height + 32 : 600 }}>
      <canvas ref={canvasRef} className="max-w-full bg-white shadow-lg" />
    </div>
  );
}