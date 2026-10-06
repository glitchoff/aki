"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Book, BookKind } from "@/lib/types";
import { library } from "@/lib/store/db";

export function Library() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setBooks(await library.all());
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const all = await library.all();
      if (!cancelled) setBooks(all);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const kind = detectKind(file);
        if (!kind) {
          setError(`${file.name}: unsupported format (need .pdf or .epub)`);
          continue;
        }

        const buffer = await file.arrayBuffer();

        if (kind === "epub") {
          const { parseEpub } = await import("@/lib/epub/parse");
          const parsed = parseEpub(buffer);
          await library.add(
            {
              id: crypto.randomUUID(),
              title: parsed.title || file.name.replace(/\.epub$/i, ""),
              author: parsed.author,
              kind,
              units: parsed.sections.length,
              addedAt: Date.now(),
            },
            buffer,
          );
        } else {
          const { readPdfInfo } = await import("@/lib/pdf/pages");
          const info = await readPdfInfo(buffer);

          await library.add(
            {
              id: crypto.randomUUID(),
              title: info.title || file.name.replace(/\.pdf$/i, ""),
              author: info.author,
              kind,
              units: info.pageCount,
              addedAt: Date.now(),
            },
            buffer,
          );
        }
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that file");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (id: string, title: string) => {
    if (!confirm(`Remove "${title}"?`)) return;
    await library.remove(id);
    await refresh();
  };

  return (
    <div className="min-h-dvh w-full">
      <div className="mx-auto w-full max-w-5xl px-5 pt-14 pb-20">
        <header className="mb-10 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">aki</h1>
            <p className="mt-1 text-sm text-muted-foreground">PDF &amp; EPUB reader</p>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.epub,application/pdf,application/epub+zip"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition opacity-90 hover:opacity-100 disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add books"}
            </button>
          </div>
        </header>

        {error && (
          <p className="mb-6 rounded-lg bg-destructive/15 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {books === null ? (
          <p className="text-sm text-muted-foreground">Loading library…</p>
        ) : books.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-20 text-center text-muted-foreground">
            <p>No books yet.</p>
            <p className="mt-1 text-sm">Add a PDF or EPUB to get started.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
            {books.map((book) => (
              <li key={book.id} className="group relative">
                <Link href={`/read?id=${book.id}`} className="block">
                  <div className="flex aspect-[2/3] items-end overflow-hidden rounded-xl bg-card p-3 shadow-sm transition group-hover:shadow-md">
                    <div className="w-full">
                      <p className="line-clamp-4 text-sm leading-snug font-medium text-foreground">
                        {book.title}
                      </p>
                      {book.author && (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {book.author}
                        </p>
                      )}
                    </div>
                  </div>

                  {book.progress != null && book.progress > 0 && (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${book.progress}%` }} />
                    </div>
                  )}
                </Link>

                <button
                  onClick={() => remove(book.id, book.title)}
                  aria-label={`Remove ${book.title}`}
                  className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-card text-muted-foreground opacity-0 shadow transition group-hover:opacity-100 hover:text-destructive"
                >
                  ×
                </button>

                <span className="mt-1.5 block text-[11px] text-muted-foreground uppercase">
                  {book.kind} · {book.units} {book.kind === "pdf" ? "pages" : "sections"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function detectKind(file: File): BookKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".epub")) return "epub";
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "application/epub+zip") return "epub";
  return null;
}