"use client";

import { useEffect, useState } from "react";
import { Check, FolderPlus, Loader2, Plus, X } from "lucide-react";

export type FavoriteCollection = {
  id: string;
  name: string;
  language: string | null;
  wordKeys: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** The favorite being added. */
  word: string;
  language?: string | null;
};

function wordKeyOf(word: string, language?: string | null): string {
  return `${(language ?? "").trim().toLowerCase()}::${word.trim().toLowerCase()}`;
}

/**
 * iPhone-parity modal that opens from the "Collection" swipe action on
 * a favorite. Shows existing collections (with "in" indicator if the
 * word already belongs) and a "+ New collection" input row. Tapping a
 * collection toggles membership; tapping "New" creates one and adds
 * the word in a single round-trip.
 *
 * Storage: backed by /api/collections (Prisma). Same shape as iPhone
 * `FavoriteCollection` so a future iPhone migration can hydrate from
 * the same endpoint.
 */
export default function AddToCollectionModal({ open, onClose, word, language }: Props) {
  const [collections, setCollections] = useState<FavoriteCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showNewInput, setShowNewInput] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const key = wordKeyOf(word, language);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/collections", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = (await r.json()) as { collections: FavoriteCollection[] };
        if (!cancelled) setCollections(d.collections ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function toggleMembership(c: FavoriteCollection) {
    const isIn = c.wordKeys.includes(key);
    setBusyId(c.id);
    setError(null);
    try {
      const url = `/api/collections/${c.id}/items${isIn ? `?key=${encodeURIComponent(key)}` : ""}`;
      const r = await fetch(url, {
        method: isIn ? "DELETE" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: isIn ? undefined : JSON.stringify({ word, language: language ?? undefined }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as { collection: FavoriteCollection };
      setCollections((prev) => prev.map((it) => (it.id === c.id ? d.collection : it)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function createCollection() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const r = await fetch("/api/collections", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          language: language ?? undefined,
          wordKeys: [key],
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as { collection: FavoriteCollection };
      setCollections((prev) => [...prev, d.collection]);
      setNewName("");
      setShowNewInput(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-collection-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-sm"
      />

      <div
        className="relative z-10 mx-3 mb-3 w-full max-w-md rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] px-5 pb-5 pt-6 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.6)] sm:mb-0"
        style={{ animation: "dp-eos-pop 240ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 inline-grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] transition hover:bg-white/[0.06] hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-1 flex items-center gap-2">
          <FolderPlus className="h-4 w-4 text-sky-300" />
          <h2
            id="add-to-collection-title"
            className="text-[15px] font-extrabold tracking-tight text-[var(--foreground)]"
          >
            Add to collection
          </h2>
        </div>
        <p className="mb-4 text-[12px] text-[var(--muted)]">
          Save <span className="font-bold text-[var(--foreground)]">{word}</span> to one of your lists.
        </p>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <ul className="space-y-1.5 max-h-[55vh] overflow-y-auto">
            {collections.length === 0 && !showNewInput ? (
              <li className="rounded-xl border border-dashed border-[var(--card-border)] px-3 py-4 text-center text-[12.5px] text-[var(--muted)]">
                No collections yet. Create your first one below.
              </li>
            ) : null}
            {collections.map((c) => {
              const isIn = c.wordKeys.includes(key);
              const busy = busyId === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void toggleMembership(c)}
                    disabled={busy}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-[13.5px] transition ${
                      isIn
                        ? "border-sky-400/35 bg-sky-400/10 text-sky-200"
                        : "border-[var(--card-border)] bg-[var(--bg-1)] text-[var(--foreground)] hover:bg-white/[0.04]"
                    } ${busy ? "opacity-60" : ""}`}
                  >
                    <span className="truncate text-left font-semibold">{c.name}</span>
                    <span className="flex shrink-0 items-center gap-2 text-[11.5px] text-[var(--muted)]">
                      {c.wordKeys.length} {c.wordKeys.length === 1 ? "word" : "words"}
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-300" />
                      ) : isIn ? (
                        <Check className="h-3.5 w-3.5 text-sky-300" strokeWidth={3} />
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}

            {showNewInput ? (
              <li className="flex items-center gap-2 rounded-xl border border-sky-400/30 bg-sky-400/5 px-3 py-2">
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  placeholder="New collection name"
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void createCollection();
                  }}
                  maxLength={80}
                  className="flex-1 bg-transparent text-[13.5px] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void createCollection()}
                  disabled={creating || newName.trim().length === 0}
                  className="rounded-md bg-sky-400 px-2.5 py-1 text-[12px] font-bold text-[#0e1727] disabled:opacity-50"
                >
                  {creating ? "…" : "Create"}
                </button>
              </li>
            ) : (
              <li>
                <button
                  type="button"
                  onClick={() => setShowNewInput(true)}
                  className="flex w-full items-center gap-2 rounded-xl border border-dashed border-[var(--card-border)] px-3 py-2.5 text-[13.5px] font-semibold text-sky-300 hover:bg-sky-400/5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New collection
                </button>
              </li>
            )}
          </ul>
        )}

        {error ? (
          <p className="mt-3 text-[11.5px] text-rose-300">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
