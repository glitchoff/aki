"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Book, Typography } from "@/lib/types";
import { DEFAULT_TYPOGRAPHY } from "@/lib/types";
import { library, settings, typographyVars } from "@/lib/store/db";
import { EpubReader } from "./reader/EpubReader";
import { PdfReader } from "./reader/PdfReader";
import { SettingsSheet } from "./reader/SettingsSheet";
import { resolveTheme, useSystemTheme } from "@/lib/useSystemTheme";

export function Reader() {
  const params = useSearchParams();
  const id = params.get("id");
  const systemTheme = useSystemTheme();

  const [book, setBook] = useState<Book | null>(null);
  const [file, setFile] = useState<ArrayBuffer | null>(null);
  const [typo, setTypo] = useState<Typography>(DEFAULT_TYPOGRAPHY);
  const [sheet, setSheet] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const theme = resolveTheme(typo.theme, systemTheme);

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      const [b, buffer, t] = await Promise.all([
        library.get(id),
        library.loadFile(id),
        settings.for(id),
      ]);
      if (cancelled) return;

      if (!b || !buffer) {
        setStatus("Book not found");
        return;
      }

      setBook(b);
      setFile(buffer);
      setTypo(t);
      setProgress(b.progress ?? 0);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const onProgress = useCallback(
    (unit: number, total: number) => {
      const pct = Math.round((unit / Math.max(total, 1)) * 100);
      // Only re-render when the whole percent actually moves.
      setProgress((prev) => (prev === pct ? prev : pct));

      if (!id) return;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        library.progress(id, { progress: pct, locator: String(unit) });
      }, 800);
    },
    [id],
  );

  // Tap the middle of the screen to toggle the chrome, like a native reader.
  const toggleChrome = useCallback(() => {
    setChrome((prev) => {
      const next = !prev;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (next) hideTimer.current = setTimeout(() => setChrome(false), 4000);
      return next;
    });
  }, []);

  const changeTypography = useCallback(
    (next: Typography) => {
      setTypo(next);
      if (id) settings.setForBook(id, next);
      // The theme choice is app-wide: reflect it in the library and chrome too.
      if (next.theme !== typo.theme) settings.setGlobal(next);
    },
    [id, typo.theme],
  );

  if (status) {
    return (
      <Shell typo={typo} theme={theme}>
        <div className="flex h-full items-center justify-center text-sm text-[var(--r-dim)]">{status}</div>
      </Shell>
    );
  }

  if (!book || !file) {
    return (
      <Shell typo={typo} theme={theme}>
        <div className="flex h-full items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--r-dim)] border-t-transparent" />
        </div>
      </Shell>
    );
  }

  const pct = Math.min(100, progress);

  return (
    <Shell typo={typo} theme={theme}>
      <div className="relative h-full">
        {/* Keyed by book so each document gets fresh reader state. */}
        {book.kind === "pdf" ? (
          <PdfReader
            key={book.id}
            file={file}
            typography={typo}
            onProgress={onProgress}
          />
        ) : (
          <EpubReader
            key={book.id}
            data={file}
            typography={typo}
            onProgress={onProgress}
          />
        )}

        {/* Tap layer sits above the text but lets scrolling through. */}
        <button
          onClick={toggleChrome}
          aria-label="Toggle controls"
          className="absolute inset-x-0 top-0 h-24"
        />

        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-10 transition-opacity duration-200 ${
            chrome ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="pointer-events-auto flex items-center gap-3 bg-[var(--r-panel)]/92 px-3 py-2.5 backdrop-blur">
            <Link href="/" aria-label="Back to library" className="rounded-full px-2 py-1 text-xl leading-none">
              ‹
            </Link>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{book.title}</p>
              <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
                <div
                  className="h-full rounded-full bg-[var(--r-accent)] transition-[width] duration-300"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => setSheet((v) => !v)}
              aria-label="Typography settings"
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                sheet ? "bg-[var(--r-accent)] text-white" : "hover:bg-black/5"
              }`}
            >
              Aa
            </button>
          </div>
        </div>

        {sheet && (
          <SettingsSheet
            value={typo}
            onChange={changeTypography}
            onClose={() => setSheet(false)}
            canReflow={book.kind === "pdf"}
          />
        )}
      </div>
    </Shell>
  );
}

function Shell({
  typo,
  theme,
  children,
}: {
  typo: Typography;
  theme: "light" | "sepia" | "dark";
  children: React.ReactNode;
}) {
  return (
    <div
      className="reader h-dvh w-full"
      data-theme={theme}
      style={typographyVars(typo, theme)}
    >
      {children}
    </div>
  );
}