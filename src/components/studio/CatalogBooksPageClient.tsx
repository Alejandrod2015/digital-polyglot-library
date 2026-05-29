"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import MediaUploadField from "@/components/studio/MediaUploadField";
import { getIsoLanguageTag } from "@/lib/languageFlags";
import type { StudioCatalogBook, StudioCatalogStory } from "@/lib/studioCatalogBooks";

// ── Inline SVG icons (no emoji) — same set as MonitorClient ──
type IconName = "chevron" | "edit" | "x" | "plus" | "trash" | "check" | "external";
function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "chevron": return (<svg {...common}><polyline points="6 4 10 8 6 12" /></svg>);
    case "edit": return (<svg {...common}><path d="M10.5 2.5l3 3-7.5 7.5H3v-3z" /></svg>);
    case "x": return (<svg {...common}><line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" /></svg>);
    case "plus": return (<svg {...common}><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></svg>);
    case "trash": return (<svg {...common}><polyline points="3 4 13 4" /><path d="M5 4v9h6V4" /><path d="M7 4V2.5h2V4" /></svg>);
    case "check": return (<svg {...common}><polyline points="3 8.5 6.5 12 13 4.5" /></svg>);
    case "external": return (<svg {...common}><path d="M6 3H3v10h10v-3" /><polyline points="9 3 13 3 13 7" /><line x1="13" y1="3" x2="8" y2="8" /></svg>);
  }
}

const LANGUAGES = ["spanish", "english", "german", "french", "italian", "portuguese"];
const VARIANTS = ["latam", "spain", "us", "uk", "brazil", "portugal", "germany", "austria", "france", "canada-fr", "italy"];
const LEVELS = ["beginner", "intermediate", "advanced"];
const CEFR = ["a1", "a2", "b1", "b2", "c1", "c2"];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function vocabToRaw(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v, null, 2); } catch { return ""; }
}

type BookForm = Partial<StudioCatalogBook>;
type StoryForm = Partial<StudioCatalogStory> & { vocabRaw?: string };
type GenKind = "text" | "title" | "synopsis" | "vocab" | "validate" | "quality" | "cover" | "audio";

type VocabQualityReport = {
  status: "good" | "usable" | "weak";
  candidateCount: number;
  lexicalDiversity: number;
  expressionCandidateCount: number;
  suggestedMinItems: number;
  reason: string;
};

type StoryGenerators = {
  generating: Set<GenKind>;
  onGenerateText: () => void;
  onRegenerateTitle: () => void;
  onRegenerateSynopsis: () => void;
  onGenerateVocab: () => void;
  onValidateVocab: () => void;
  onCheckVocabQuality: () => void;
  onGenerateCover: () => void;
  onGenerateAudio: () => void;
  // Public reader URL for the story (or null while it has no slug). Used
  // by the "Ver en reader" button. The catalog reader lives at
  // /books/[bookSlug]/[storySlug] — story.slug alone is not enough.
  readerUrl: string | null;
  // Latest quality report for this story, if the editor has run it during
  // the current expand. Cleared on close / next reload.
  vocabQuality: VocabQualityReport | null;
};

// ── Component ──
export default function CatalogBooksPageClient() {
  const [books, setBooks] = useState<StudioCatalogBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [level, setLevel] = useState("");
  const [publishedFilter, setPublishedFilter] = useState<"" | "true" | "false">("");

  // Expansion + cached forms
  const [expandedBookIds, setExpandedBookIds] = useState<Set<string>>(new Set());
  const [bookForms, setBookForms] = useState<Map<string, BookForm>>(new Map());
  const [bookStories, setBookStories] = useState<Map<string, StudioCatalogStory[]>>(new Map());
  const [bookLoading, setBookLoading] = useState<Set<string>>(new Set());
  const [bookSaving, setBookSaving] = useState<Set<string>>(new Set());
  const [bookErrors, setBookErrors] = useState<Map<string, string>>(new Map());

  const [expandedStoryIds, setExpandedStoryIds] = useState<Set<string>>(new Set());
  const [storyForms, setStoryForms] = useState<Map<string, StoryForm>>(new Map());
  const [storyLoading, setStoryLoading] = useState<Set<string>>(new Set());
  const [storySaving, setStorySaving] = useState<Set<string>>(new Set());
  const [storyErrors, setStoryErrors] = useState<Map<string, string>>(new Map());

  // Per-story generation state. Maps storyId → set of kinds currently in
  // flight ("text" | "vocab" | "cover" | "audio"). Used to disable buttons
  // and show a spinner-style label. Errors are stored separately.
  const [storyGenerating, setStoryGenerating] = useState<Map<string, Set<GenKind>>>(new Map());
  const [storyQuality, setStoryQuality] = useState<Map<string, VocabQualityReport>>(new Map());

  function markGenerating(storyId: string, kind: GenKind, on: boolean) {
    setStoryGenerating((prev) => {
      const next = new Map(prev);
      const cur = new Set(next.get(storyId) ?? []);
      if (on) cur.add(kind); else cur.delete(kind);
      next.set(storyId, cur);
      return next;
    });
  }

  // New book draft (rendered above the list when active)
  const [newBookDraft, setNewBookDraft] = useState<BookForm | null>(null);
  const [creatingBook, setCreatingBook] = useState(false);
  const [createBookError, setCreateBookError] = useState<string | null>(null);

  // New story draft, keyed by bookId (only one open per book at a time)
  const [newStoryDraft, setNewStoryDraft] = useState<{ bookId: string; form: StoryForm } | null>(null);
  const [creatingStory, setCreatingStory] = useState(false);

  // Confirms
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void; confirmLabel?: string; confirmTone?: "red" | "amber" | "primary" } | null>(null);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/catalog-books", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { books: StudioCatalogBook[] };
      setBooks(data.books);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadBooks(); }, [loadBooks]);

  const filtered = useMemo(() => {
    return books.filter((b) => {
      if (language && b.language !== language) return false;
      if (level && b.level !== level) return false;
      if (publishedFilter === "true" && !b.published) return false;
      if (publishedFilter === "false" && b.published) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const hay = [b.title, b.slug, b.topic ?? ""].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [books, language, level, publishedFilter, query]);

  const availableLanguages = useMemo(
    () => Array.from(new Set(books.map((b) => b.language).filter(Boolean))).sort(),
    [books]
  );
  const availableLevels = useMemo(
    () => Array.from(new Set(books.map((b) => b.level).filter(Boolean))).sort(),
    [books]
  );

  async function toggleBook(b: StudioCatalogBook) {
    if (expandedBookIds.has(b.id)) {
      setExpandedBookIds((prev) => { const n = new Set(prev); n.delete(b.id); return n; });
      return;
    }
    setExpandedBookIds((prev) => new Set(prev).add(b.id));
    if (!bookForms.has(b.id)) {
      setBookLoading((prev) => new Set(prev).add(b.id));
      try {
        const res = await fetch(`/api/studio/catalog-books/${encodeURIComponent(b.id)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { book: StudioCatalogBook; stories: StudioCatalogStory[] };
        setBookForms((prev) => new Map(prev).set(b.id, data.book));
        setBookStories((prev) => new Map(prev).set(b.id, data.stories));
      } catch (e) {
        setBookErrors((prev) => new Map(prev).set(b.id, e instanceof Error ? e.message : String(e)));
      } finally {
        setBookLoading((prev) => { const n = new Set(prev); n.delete(b.id); return n; });
      }
    }
  }

  function patchBook(bookId: string, key: keyof BookForm, value: unknown) {
    setBookForms((prev) => {
      const next = new Map(prev);
      const current = next.get(bookId) ?? {};
      next.set(bookId, { ...current, [key]: value });
      return next;
    });
  }

  async function saveBook(bookId: string) {
    const form = bookForms.get(bookId);
    if (!form) return;
    if (!form.title?.trim() || !form.slug?.trim()) {
      setBookErrors((prev) => new Map(prev).set(bookId, "Título y slug son obligatorios."));
      return;
    }
    setBookSaving((prev) => new Set(prev).add(bookId));
    setBookErrors((prev) => { const n = new Map(prev); n.delete(bookId); return n; });
    try {
      const res = await fetch(`/api/studio/catalog-books/${encodeURIComponent(bookId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
        // Surface the real error (`details`) when the server provides
        // one. Without this the Studio UI only sees the generic top
        // line (e.g. "Cover generation failed") and the curator never
        // learns what actually broke (e.g. Flux content moderation).
        const top = j.error ?? `HTTP ${res.status}`;
        throw new Error(j.details ? `${top}: ${j.details}` : top);
      }
      const j = (await res.json()) as { book: StudioCatalogBook };
      setBookForms((prev) => new Map(prev).set(bookId, j.book));
      setBooks((prev) => prev.map((bk) => (bk.id === bookId ? { ...bk, ...j.book } : bk)));
    } catch (e) {
      setBookErrors((prev) => new Map(prev).set(bookId, e instanceof Error ? e.message : String(e)));
    } finally {
      setBookSaving((prev) => { const n = new Set(prev); n.delete(bookId); return n; });
    }
  }

  async function deleteBook(b: StudioCatalogBook) {
    try {
      const res = await fetch(`/api/studio/catalog-books/${encodeURIComponent(b.id)}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
        // Surface the real error (`details`) when the server provides
        // one. Without this the Studio UI only sees the generic top
        // line (e.g. "Cover generation failed") and the curator never
        // learns what actually broke (e.g. Flux content moderation).
        const top = j.error ?? `HTTP ${res.status}`;
        throw new Error(j.details ? `${top}: ${j.details}` : top);
      }
      setBooks((prev) => prev.filter((bk) => bk.id !== b.id));
      setExpandedBookIds((prev) => { const n = new Set(prev); n.delete(b.id); return n; });
      setBookForms((prev) => { const n = new Map(prev); n.delete(b.id); return n; });
      setBookStories((prev) => { const n = new Map(prev); n.delete(b.id); return n; });
    } catch (e) {
      setBookErrors((prev) => new Map(prev).set(b.id, e instanceof Error ? e.message : String(e)));
    }
  }

  async function createBook() {
    if (!newBookDraft?.title?.trim() || !newBookDraft.slug?.trim()) {
      setCreateBookError("Título y slug son obligatorios.");
      return;
    }
    setCreatingBook(true);
    setCreateBookError(null);
    try {
      const res = await fetch("/api/studio/catalog-books", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(newBookDraft),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
        // Surface the real error (`details`) when the server provides
        // one. Without this the Studio UI only sees the generic top
        // line (e.g. "Cover generation failed") and the curator never
        // learns what actually broke (e.g. Flux content moderation).
        const top = j.error ?? `HTTP ${res.status}`;
        throw new Error(j.details ? `${top}: ${j.details}` : top);
      }
      const j = (await res.json()) as { book: StudioCatalogBook };
      setBooks((prev) => [j.book, ...prev]);
      setBookForms((prev) => new Map(prev).set(j.book.id, j.book));
      setBookStories((prev) => new Map(prev).set(j.book.id, []));
      setExpandedBookIds((prev) => new Set(prev).add(j.book.id));
      setNewBookDraft(null);
    } catch (e) {
      setCreateBookError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingBook(false);
    }
  }

  async function toggleStory(bookId: string, s: StudioCatalogStory) {
    if (expandedStoryIds.has(s.id)) {
      setExpandedStoryIds((prev) => { const n = new Set(prev); n.delete(s.id); return n; });
      return;
    }
    setExpandedStoryIds((prev) => new Set(prev).add(s.id));
    if (!storyForms.has(s.id)) {
      setStoryLoading((prev) => new Set(prev).add(s.id));
      try {
        const res = await fetch(
          `/api/studio/catalog-books/${encodeURIComponent(bookId)}/stories/${encodeURIComponent(s.id)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { story: StudioCatalogStory };
        setStoryForms((prev) => new Map(prev).set(s.id, { ...data.story, vocabRaw: vocabToRaw(data.story.vocab) }));
      } catch (e) {
        setStoryErrors((prev) => new Map(prev).set(s.id, e instanceof Error ? e.message : String(e)));
      } finally {
        setStoryLoading((prev) => { const n = new Set(prev); n.delete(s.id); return n; });
      }
    }
  }

  function patchStory(storyId: string, key: keyof StoryForm, value: unknown) {
    setStoryForms((prev) => {
      const next = new Map(prev);
      const current = next.get(storyId) ?? {};
      next.set(storyId, { ...current, [key]: value });
      return next;
    });
  }

  async function saveStory(bookId: string, storyId: string) {
    const form = storyForms.get(storyId);
    if (!form) return;
    if (!form.title?.trim() || !form.slug?.trim()) {
      setStoryErrors((prev) => new Map(prev).set(storyId, "Título y slug son obligatorios."));
      return;
    }
    setStorySaving((prev) => new Set(prev).add(storyId));
    setStoryErrors((prev) => { const n = new Map(prev); n.delete(storyId); return n; });
    const payload: Record<string, unknown> = {
      slug: form.slug,
      title: form.title,
      synopsis: form.synopsis ?? null,
      text: form.text ?? "",
      audio: form.audio ?? "",
      audioUrl: form.audioUrl ?? null,
      cover: form.cover ?? null,
      coverUrl: form.coverUrl ?? null,
      topic: form.topic ?? null,
      tags: form.tags ?? [],
      language: form.language ?? null,
      variant: form.variant ?? null,
      region: form.region ?? null,
      level: form.level ?? null,
      cefrLevel: form.cefrLevel ?? null,
      formality: form.formality ?? null,
      overrideMetadata: form.overrideMetadata ?? false,
    };
    if (form.vocabRaw?.trim()) {
      try { payload.vocab = JSON.parse(form.vocabRaw); }
      catch {
        setStoryErrors((prev) => new Map(prev).set(storyId, "Vocab JSON inválido."));
        setStorySaving((prev) => { const n = new Set(prev); n.delete(storyId); return n; });
        return;
      }
    } else if (form.vocabRaw === "") {
      payload.vocab = null;
    }

    try {
      const res = await fetch(
        `/api/studio/catalog-books/${encodeURIComponent(bookId)}/stories/${encodeURIComponent(storyId)}`,
        { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
        // Surface the real error (`details`) when the server provides
        // one. Without this the Studio UI only sees the generic top
        // line (e.g. "Cover generation failed") and the curator never
        // learns what actually broke (e.g. Flux content moderation).
        const top = j.error ?? `HTTP ${res.status}`;
        throw new Error(j.details ? `${top}: ${j.details}` : top);
      }
      const j = (await res.json()) as { story: StudioCatalogStory };
      // Slug change → id change. Re-map in caches.
      if (j.story.id !== storyId) {
        setStoryForms((prev) => {
          const next = new Map(prev);
          next.delete(storyId);
          next.set(j.story.id, { ...j.story, vocabRaw: vocabToRaw(j.story.vocab) });
          return next;
        });
        setExpandedStoryIds((prev) => { const n = new Set(prev); n.delete(storyId); n.add(j.story.id); return n; });
      } else {
        setStoryForms((prev) => new Map(prev).set(storyId, { ...j.story, vocabRaw: vocabToRaw(j.story.vocab) }));
      }
      setBookStories((prev) => {
        const list = prev.get(bookId) ?? [];
        const updated = list.map((sx) => (sx.id === storyId ? j.story : sx));
        return new Map(prev).set(bookId, updated);
      });
    } catch (e) {
      setStoryErrors((prev) => new Map(prev).set(storyId, e instanceof Error ? e.message : String(e)));
    } finally {
      setStorySaving((prev) => { const n = new Set(prev); n.delete(storyId); return n; });
    }
  }

  async function deleteStory(bookId: string, storyId: string) {
    try {
      const res = await fetch(
        `/api/studio/catalog-books/${encodeURIComponent(bookId)}/stories/${encodeURIComponent(storyId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
        // Surface the real error (`details`) when the server provides
        // one. Without this the Studio UI only sees the generic top
        // line (e.g. "Cover generation failed") and the curator never
        // learns what actually broke (e.g. Flux content moderation).
        const top = j.error ?? `HTTP ${res.status}`;
        throw new Error(j.details ? `${top}: ${j.details}` : top);
      }
      setBookStories((prev) => {
        const list = prev.get(bookId) ?? [];
        return new Map(prev).set(bookId, list.filter((sx) => sx.id !== storyId));
      });
      setExpandedStoryIds((prev) => { const n = new Set(prev); n.delete(storyId); return n; });
      setStoryForms((prev) => { const n = new Map(prev); n.delete(storyId); return n; });
    } catch (e) {
      setStoryErrors((prev) => new Map(prev).set(storyId, e instanceof Error ? e.message : String(e)));
    }
  }

  // ── Generation handlers (text / vocab / cover / audio) ──
  // Each one hits the matching /api/studio/catalog-books/[id]/stories/[storyId]/generate-* endpoint,
  // merges the returned fields into the local form, and surfaces errors inline.

  async function callGenerate(
    bookId: string,
    storyId: string,
    kind: GenKind,
    path: string,
    apply: (data: any) => void
  ) {
    markGenerating(storyId, kind, true);
    setStoryErrors((prev) => { const n = new Map(prev); n.delete(storyId); return n; });
    try {
      const res = await fetch(
        `/api/studio/catalog-books/${encodeURIComponent(bookId)}/stories/${encodeURIComponent(storyId)}/${path}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
        // Surface the real error (`details`) when the server provides
        // one. Without this the Studio UI only sees the generic top
        // line (e.g. "Cover generation failed") and the curator never
        // learns what actually broke (e.g. Flux content moderation).
        const top = j.error ?? `HTTP ${res.status}`;
        throw new Error(j.details ? `${top}: ${j.details}` : top);
      }
      const data = await res.json();
      apply(data);
    } catch (e) {
      setStoryErrors((prev) => new Map(prev).set(storyId, e instanceof Error ? e.message : String(e)));
    } finally {
      markGenerating(storyId, kind, false);
    }
  }

  async function generateStoryText(bookId: string, storyId: string) {
    await callGenerate(bookId, storyId, "text", "generate-text", (data: { story: { title?: string; text?: string; vocab?: unknown } }) => {
      patchStory(storyId, "title", data.story.title);
      patchStory(storyId, "text", data.story.text);
      patchStory(storyId, "vocab", data.story.vocab as never);
      patchStory(storyId, "vocabRaw", vocabToRaw(data.story.vocab));
      setBookStories((prev) => {
        const list = prev.get(bookId) ?? [];
        const updated = list.map((sx) =>
          sx.id === storyId
            ? { ...sx, title: data.story.title ?? sx.title, text: data.story.text ?? sx.text, vocab: data.story.vocab ?? sx.vocab }
            : sx
        );
        return new Map(prev).set(bookId, updated);
      });
    });
  }

  async function generateStoryVocab(bookId: string, storyId: string) {
    await callGenerate(bookId, storyId, "vocab", "generate-vocab", (data: { story: { vocab?: unknown } }) => {
      patchStory(storyId, "vocab", data.story.vocab as never);
      patchStory(storyId, "vocabRaw", vocabToRaw(data.story.vocab));
    });
  }

  async function validateStoryVocab(bookId: string, storyId: string) {
    await callGenerate(bookId, storyId, "validate", "validate-vocab", (data: { story: { vocab?: unknown } }) => {
      patchStory(storyId, "vocab", data.story.vocab as never);
      patchStory(storyId, "vocabRaw", vocabToRaw(data.story.vocab));
    });
  }

  async function regenerateStoryTitle(bookId: string, storyId: string) {
    await callGenerate(bookId, storyId, "title", "regenerate-title", (data: { story: { title?: string } }) => {
      if (data.story.title) {
        patchStory(storyId, "title", data.story.title);
        setBookStories((prev) => {
          const list = prev.get(bookId) ?? [];
          const updated = list.map((sx) => (sx.id === storyId ? { ...sx, title: data.story.title ?? sx.title } : sx));
          return new Map(prev).set(bookId, updated);
        });
      }
    });
  }

  async function regenerateStorySynopsis(bookId: string, storyId: string) {
    await callGenerate(bookId, storyId, "synopsis", "regenerate-synopsis", (data: { story: { synopsis?: string | null } }) => {
      patchStory(storyId, "synopsis", data.story.synopsis ?? null);
    });
  }

  async function checkStoryVocabQuality(bookId: string, storyId: string) {
    await callGenerate(bookId, storyId, "quality", "check-vocab-quality", (data: { quality?: VocabQualityReport }) => {
      if (data.quality) {
        setStoryQuality((prev) => new Map(prev).set(storyId, data.quality!));
      }
    });
  }

  async function generateStoryCover(bookId: string, storyId: string) {
    await callGenerate(bookId, storyId, "cover", "generate-cover", (data: { story: { coverUrl?: string | null } }) => {
      patchStory(storyId, "coverUrl", data.story.coverUrl ?? null);
      setBookStories((prev) => {
        const list = prev.get(bookId) ?? [];
        const updated = list.map((sx) => (sx.id === storyId ? { ...sx, coverUrl: data.story.coverUrl ?? null } : sx));
        return new Map(prev).set(bookId, updated);
      });
    });
  }

  async function generateStoryAudio(bookId: string, storyId: string) {
    await callGenerate(bookId, storyId, "audio", "generate-audio", (data: { story: { audioUrl?: string | null } }) => {
      patchStory(storyId, "audioUrl", data.story.audioUrl ?? null);
      setBookStories((prev) => {
        const list = prev.get(bookId) ?? [];
        const updated = list.map((sx) => (sx.id === storyId ? { ...sx, audioUrl: data.story.audioUrl ?? null } : sx));
        return new Map(prev).set(bookId, updated);
      });
    });
  }

  async function createStory(bookId: string) {
    if (!newStoryDraft || newStoryDraft.bookId !== bookId) return;
    const form = newStoryDraft.form;
    // Clear stale "__new__" error from a previous failed attempt so the
    // user gets a fresh signal on each click.
    setStoryErrors((prev) => {
      if (!prev.has("__new__")) return prev;
      const n = new Map(prev);
      n.delete("__new__");
      return n;
    });
    if (!form.title?.trim() || !form.slug?.trim()) {
      setNewStoryDraft({ ...newStoryDraft, form: { ...form } });
      return;
    }
    setCreatingStory(true);
    const payload: Record<string, unknown> = {
      slug: form.slug,
      title: form.title,
      synopsis: form.synopsis ?? null,
      text: form.text ?? "",
      audio: form.audio ?? "",
      audioUrl: form.audioUrl ?? null,
      coverUrl: form.coverUrl ?? null,
      topic: form.topic ?? null,
      tags: form.tags ?? [],
    };
    if (form.vocabRaw?.trim()) {
      try { payload.vocab = JSON.parse(form.vocabRaw); }
      catch { setCreatingStory(false); return; }
    }
    try {
      const res = await fetch(`/api/studio/catalog-books/${encodeURIComponent(bookId)}/stories`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { story: StudioCatalogStory };
      setBookStories((prev) => {
        const list = prev.get(bookId) ?? [];
        return new Map(prev).set(bookId, [...list, j.story]);
      });
      setStoryForms((prev) => new Map(prev).set(j.story.id, { ...j.story, vocabRaw: vocabToRaw(j.story.vocab) }));
      setExpandedStoryIds((prev) => new Set(prev).add(j.story.id));
      setNewStoryDraft(null);
    } catch (e) {
      setStoryErrors((prev) => new Map(prev).set("__new__", e instanceof Error ? e.message : String(e)));
    } finally {
      setCreatingStory(false);
    }
  }

  // ═══════════════════ RENDER ═══════════════════
  return (
    <div className="jm-root">
      {confirmAction && (
        <div className="jm-backdrop">
          <div className="jm-modal">
            <p className="jm-modal__msg">{confirmAction.message}</p>
            <div className="jm-row" style={{ justifyContent: "flex-end" }}>
              <button className="jm-btn jm-btn--sm" onClick={() => setConfirmAction(null)}>Cancelar</button>
              <button
                className={`jm-btn jm-btn--sm ${confirmAction.confirmTone === "primary" ? "jm-btn--primary" : confirmAction.confirmTone === "amber" ? "jm-btn-tone-amber" : "jm-btn-tone-red"}`}
                onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
              >
                {confirmAction.confirmLabel ?? "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Filters + New Book ══ */}
      <section className="jm-panel">
        <header className="jm-panel__head">
          <div>
            <p className="jm-eyebrow">Catálogo</p>
            <h2 className="jm-panel__title">Libros y sus historias</h2>
          </div>
          <div className="jm-row jm-row--tight" style={{ marginLeft: "auto" }}>
            <span className="jm-mono jm-dim" style={{ fontSize: 12 }}>
              <strong>{filtered.length}</strong>{filtered.length !== books.length ? `/${books.length}` : ""} {books.length === 1 ? "libro" : "libros"}
            </span>
            <button
              className="jm-btn jm-btn--primary"
              onClick={() => setNewBookDraft({ title: "", slug: "", description: "", language: "spanish", level: "beginner", published: false })}
              disabled={!!newBookDraft}
            >
              <Icon name="plus" size={12} /> Nuevo libro
            </button>
          </div>
        </header>

        <div className="jm-row jm-row--wrap">
          <input
            className="jm-input"
            style={{ maxWidth: 320, minWidth: 220, flex: 1 }}
            placeholder="Buscar por título, slug o tema"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="jm-input" style={{ maxWidth: 160 }} value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="">Cualquier idioma</option>
            {availableLanguages.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className="jm-input" style={{ maxWidth: 160 }} value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">Cualquier nivel</option>
            {availableLevels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className="jm-input" style={{ maxWidth: 180 }} value={publishedFilter} onChange={(e) => setPublishedFilter(e.target.value as "" | "true" | "false")}>
            <option value="">Publicación: todas</option>
            <option value="true">Publicados</option>
            <option value="false">Sin publicar</option>
          </select>
        </div>
      </section>

      {loading && <p className="jm-dim" style={{ fontSize: 12 }}>Cargando…</p>}
      {error && <div className="jm-ex__error">{error}</div>}

      {/* New book draft */}
      {newBookDraft && (
        <article className="jm-journey jm-journey--open">
          <header className="jm-j-head" style={{ cursor: "default" }}>
            <span className="jm-lang-tag">NEW</span>
            <span className="jm-j-head__name">Nuevo libro</span>
            <span className="jm-row__spacer" />
            <button className="jm-btn jm-btn--sm" onClick={() => setNewBookDraft(null)} disabled={creatingBook}>
              Cancelar
            </button>
            <button className="jm-btn jm-btn--primary jm-btn--sm" onClick={() => void createBook()} disabled={creatingBook}>
              {creatingBook ? "Creando…" : "Crear libro"}
            </button>
          </header>
          <div className="jm-j-body">
            <BookEditorPanel
              form={newBookDraft}
              onPatch={(k, v) =>
                setNewBookDraft((prev) => (prev ? { ...prev, [k]: v } : prev))
              }
              isNew
              autoSlug
            />
            {createBookError && <div className="jm-ex__error">{createBookError}</div>}
          </div>
        </article>
      )}

      {/* Books list */}
      {filtered.map((b) => {
        const isOpen = expandedBookIds.has(b.id);
        const form = bookForms.get(b.id) ?? b;
        const stories = bookStories.get(b.id) ?? [];
        const isBookLoading = bookLoading.has(b.id);
        const isBookSaving = bookSaving.has(b.id);
        const bookErr = bookErrors.get(b.id);

        return (
          <article key={b.id} className={`jm-journey ${isOpen ? "jm-journey--open" : ""}`}>
            <header className="jm-j-head" onClick={() => void toggleBook(b)}>
              <span className={`jm-j-head__caret ${isOpen ? "jm-j-head__caret--open" : ""}`}>
                <Icon name="chevron" />
              </span>
              <span className="jm-lang-tag">{getIsoLanguageTag(form.language)}</span>
              <span className="jm-j-head__name">{form.title || "(sin título)"}</span>
              {form.cefrLevel && (
                <span className="jm-chip jm-chip--teal jm-chip--mono">{form.cefrLevel.toUpperCase()}</span>
              )}
              <span className="jm-j-head__meta">
                {form.level ?? "—"}{form.topic ? ` · ${form.topic}` : ""}
              </span>
              <span className="jm-row__spacer" />
              <span className="jm-j-head__count">
                <strong>{b.storyCount ?? stories.length}</strong> {((b.storyCount ?? stories.length) === 1) ? "historia" : "historias"}
              </span>
              <span className={`jm-chip ${form.published ? "jm-chip--green" : ""}`}>
                {form.published ? "Publicado" : "Borrador"}
              </span>
              <button
                className="jm-btn jm-btn--icon jm-btn--ghost"
                style={{ color: "var(--mx-neg)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmAction({
                    message: `Eliminar "${form.title}" y sus ${b.storyCount ?? stories.length} historia${(b.storyCount ?? stories.length) === 1 ? "" : "s"}? Esta acción es irreversible.`,
                    onConfirm: () => void deleteBook(b),
                    confirmTone: "red",
                  });
                }}
                title="Eliminar libro"
              >
                <Icon name="x" size={12} />
              </button>
            </header>

            {isOpen && (
              <div className="jm-j-body">
                {isBookLoading ? (
                  <p className="jm-dim" style={{ fontSize: 12 }}>Cargando libro…</p>
                ) : (
                  <>
                    <BookEditorPanel
                      form={form}
                      onPatch={(k, v) => patchBook(b.id, k, v)}
                    />

                    {bookErr && <div className="jm-ex__error">{bookErr}</div>}

                    <div className="jm-row" style={{ justifyContent: "flex-end", marginTop: 4 }}>
                      <button
                        className="jm-btn jm-btn--primary jm-btn--sm"
                        onClick={() => void saveBook(b.id)}
                        disabled={isBookSaving}
                      >
                        {isBookSaving ? "Guardando…" : "Guardar libro"}
                      </button>
                    </div>

                    {/* Stories sub-section */}
                    <div className="jm-level-head" style={{ marginTop: 10 }}>
                      <span className="jm-level-code">HIST</span>
                      <span className="jm-level-head__rule" />
                      <button
                        className="jm-btn jm-btn--primary jm-btn--sm"
                        onClick={() => setNewStoryDraft({
                          bookId: b.id,
                          form: { title: "", slug: "", text: "", audioUrl: null, coverUrl: null, tags: [], vocabRaw: "" },
                        })}
                        disabled={!!newStoryDraft && newStoryDraft.bookId !== b.id}
                      >
                        <Icon name="plus" size={11} /> Agregar historia
                      </button>
                      <span className="jm-chip jm-chip--mono">{stories.length}</span>
                    </div>

                    {/* New story draft inline */}
                    {newStoryDraft?.bookId === b.id && (
                      <div className="jm-editor">
                        <div className="jm-row" style={{ marginBottom: 8 }}>
                          <span className="jm-eyebrow" style={{ margin: 0 }}>Nueva historia</span>
                          <span className="jm-row__spacer" />
                          <button
                            className="jm-btn jm-btn--sm"
                            onClick={() => {
                              setNewStoryDraft(null);
                              // Drop any "__new__" error so it doesn't reappear
                              // when the editor re-opens.
                              setStoryErrors((prev) => {
                                if (!prev.has("__new__")) return prev;
                                const n = new Map(prev);
                                n.delete("__new__");
                                return n;
                              });
                            }}
                            disabled={creatingStory}
                          >
                            Cancelar
                          </button>
                          <button
                            className="jm-btn jm-btn--primary jm-btn--sm"
                            onClick={() => void createStory(b.id)}
                            disabled={creatingStory}
                          >
                            {creatingStory ? "Creando…" : "Crear historia"}
                          </button>
                        </div>
                        {storyErrors.get("__new__") && (
                          <div className="jm-ex__error" style={{ marginBottom: 8 }}>
                            {storyErrors.get("__new__")}
                          </div>
                        )}
                        <StoryEditorPanel
                          form={newStoryDraft.form}
                          onPatch={(k, v) =>
                            setNewStoryDraft((prev) =>
                              prev ? { bookId: prev.bookId, form: { ...prev.form, [k]: v } } : prev
                            )
                          }
                          autoSlug
                        />
                      </div>
                    )}

                    {stories.length === 0 && newStoryDraft?.bookId !== b.id && (
                      <p className="jm-dim" style={{ fontSize: 12, padding: "8px 4px" }}>
                        Este libro todavía no tiene historias.
                      </p>
                    )}

                    <div className="jm-stories">
                      {stories.map((s) => {
                        const isStoryOpen = expandedStoryIds.has(s.id);
                        const storyForm = storyForms.get(s.id);
                        const isStoryLoading = storyLoading.has(s.id);
                        const isStorySaving = storySaving.has(s.id);
                        const storyErr = storyErrors.get(s.id);

                        return (
                          <Fragment key={s.id}>
                            <div className="jm-story" onClick={() => void toggleStory(b.id, s)}>
                              <span className="jm-story__dot-cell">
                                <span className={`jm-sdot ${s.text ? "jm-sdot--published" : "jm-sdot--draft"}`} />
                              </span>
                              <span className={`jm-story__title ${isStoryOpen ? "jm-story__title--open" : ""}`}>
                                {s.title || "(sin título)"}
                              </span>
                              <span className="jm-chip jm-chip--mono">
                                {s.text ? `${s.text.length}c` : "0c"}
                              </span>
                              <span className="jm-chip jm-chip--mono" style={{ color: "var(--mx-muted)" }}>{s.slug}</span>
                              <button
                                className="jm-btn jm-btn--icon jm-btn--ghost jm-btn--sm"
                                style={{ color: "var(--mx-neg)" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmAction({
                                    message: `Eliminar la historia "${s.title}"?`,
                                    onConfirm: () => void deleteStory(b.id, s.id),
                                    confirmTone: "red",
                                  });
                                }}
                                title="Eliminar historia"
                              >
                                <Icon name="trash" size={11} />
                              </button>
                            </div>
                            {isStoryOpen && (
                              <div className="jm-editor" style={{ marginLeft: 0 }}>
                                {isStoryLoading || !storyForm ? (
                                  <p className="jm-dim" style={{ fontSize: 12 }}>Cargando historia…</p>
                                ) : (
                                  <>
                                    <StoryEditorPanel
                                      form={storyForm}
                                      onPatch={(k, v) => patchStory(s.id, k, v)}
                                      generators={{
                                        generating: storyGenerating.get(s.id) ?? new Set<GenKind>(),
                                        onGenerateText: () => void generateStoryText(b.id, s.id),
                                        onRegenerateTitle: () => void regenerateStoryTitle(b.id, s.id),
                                        onRegenerateSynopsis: () => void regenerateStorySynopsis(b.id, s.id),
                                        onGenerateVocab: () => void generateStoryVocab(b.id, s.id),
                                        onValidateVocab: () => void validateStoryVocab(b.id, s.id),
                                        onCheckVocabQuality: () => void checkStoryVocabQuality(b.id, s.id),
                                        onGenerateCover: () => void generateStoryCover(b.id, s.id),
                                        onGenerateAudio: () => void generateStoryAudio(b.id, s.id),
                                        readerUrl: form.slug && s.slug
                                          ? `/books/${encodeURIComponent(form.slug)}/${encodeURIComponent(s.slug)}`
                                          : null,
                                        vocabQuality: storyQuality.get(s.id) ?? null,
                                      }}
                                    />
                                    {storyErr && <div className="jm-ex__error">{storyErr}</div>}
                                    <div className="jm-row" style={{ justifyContent: "flex-end", marginTop: 4 }}>
                                      <button
                                        className="jm-btn jm-btn--primary jm-btn--sm"
                                        onClick={() => void saveStory(b.id, s.id)}
                                        disabled={isStorySaving}
                                      >
                                        {isStorySaving ? "Guardando…" : "Guardar historia"}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </Fragment>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </article>
        );
      })}

      {!loading && filtered.length === 0 && !newBookDraft && (
        <div className="jm-empty">
          {books.length === 0 ? "No hay libros todavía. Pulsa Nuevo libro." : "No hay libros que coincidan con los filtros."}
        </div>
      )}
    </div>
  );
}

// ── BookEditorPanel ──
function BookEditorPanel({
  form,
  onPatch,
  isNew = false,
  autoSlug = false,
}: {
  form: BookForm;
  onPatch: (key: keyof BookForm, value: unknown) => void;
  isNew?: boolean;
  autoSlug?: boolean;
}) {
  const [touchedSlug, setTouchedSlug] = useState(false);

  function handleTitle(v: string) {
    onPatch("title", v);
    if (autoSlug && !touchedSlug) onPatch("slug", slugify(v));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <div>
          <label className="jm-field-label">Título</label>
          <input className="jm-input" value={form.title ?? ""} onChange={(e) => handleTitle(e.target.value)} />
        </div>
        <div>
          <label className="jm-field-label">Slug</label>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              className="jm-input jm-input--mono"
              style={{ flex: 1, minWidth: 0 }}
              value={form.slug ?? ""}
              onChange={(e) => { setTouchedSlug(true); onPatch("slug", e.target.value); }}
            />
            <button
              type="button"
              className="jm-btn jm-btn-tone-teal jm-btn--sm"
              onClick={() => { setTouchedSlug(true); onPatch("slug", slugify(form.title ?? "")); }}
              disabled={!form.title?.trim()}
              title={form.title?.trim() ? "Regenerar slug desde el título actual" : "Necesita título primero"}
            >
              Slug ↻
            </button>
          </div>
        </div>
        <div>
          <label className="jm-field-label">Subtítulo</label>
          <input className="jm-input" value={form.subtitle ?? ""} onChange={(e) => onPatch("subtitle", e.target.value || null)} />
        </div>
      </div>

      <div>
        <label className="jm-field-label">Descripción</label>
        <textarea
          className="jm-input"
          rows={3}
          value={form.description ?? ""}
          onChange={(e) => onPatch("description", e.target.value)}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <div>
          <label className="jm-field-label">Idioma</label>
          <select className="jm-input" value={form.language ?? ""} onChange={(e) => onPatch("language", e.target.value)}>
            {LANGUAGES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="jm-field-label">Variante</label>
          <select className="jm-input" value={form.variant ?? ""} onChange={(e) => onPatch("variant", e.target.value || null)}>
            <option value="">—</option>
            {VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="jm-field-label">Región</label>
          <input className="jm-input" value={form.region ?? ""} onChange={(e) => onPatch("region", e.target.value || null)} />
        </div>
        <div>
          <label className="jm-field-label">Nivel</label>
          <select className="jm-input" value={form.level ?? "beginner"} onChange={(e) => onPatch("level", e.target.value)}>
            {LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="jm-field-label">CEFR</label>
          <select className="jm-input" value={form.cefrLevel ?? ""} onChange={(e) => onPatch("cefrLevel", e.target.value || null)}>
            <option value="">—</option>
            {CEFR.map((v) => <option key={v} value={v}>{v.toUpperCase()}</option>)}
          </select>
        </div>
        <div>
          <label className="jm-field-label">Topic</label>
          <input className="jm-input" value={form.topic ?? ""} onChange={(e) => onPatch("topic", e.target.value || null)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 1fr 1fr", gap: 12 }}>
        <MediaUploadField
          kind="cover"
          label="Cover"
          value={form.coverUrl ?? null}
          onChange={(url) => onPatch("coverUrl", url)}
        />
        <div>
          <label className="jm-field-label">Store URL</label>
          <input className="jm-input jm-input--mono" value={form.storeUrl ?? ""} onChange={(e) => onPatch("storeUrl", e.target.value || null)} />
        </div>
        <div>
          <label className="jm-field-label">Audio folder (legacy)</label>
          <input className="jm-input jm-input--mono" value={form.audioFolder ?? ""} onChange={(e) => onPatch("audioFolder", e.target.value)} />
        </div>
      </div>

      {!isNew && (
        <div className="jm-row jm-row--tight">
          <label className="jm-row jm-row--tight" style={{ cursor: "pointer", fontSize: 12.5, color: "var(--mx-fg-soft)" }}>
            <input
              type="checkbox"
              checked={Boolean(form.published)}
              onChange={(e) => onPatch("published", e.target.checked)}
            />
            Publicado
          </label>
        </div>
      )}
    </div>
  );
}

// ── StoryEditorPanel ──
function StoryEditorPanel({
  form,
  onPatch,
  autoSlug = false,
  generators,
}: {
  form: StoryForm;
  onPatch: (key: keyof StoryForm, value: unknown) => void;
  autoSlug?: boolean;
  generators?: StoryGenerators;
}) {
  const [touchedSlug, setTouchedSlug] = useState(false);

  const vocabPreview = useMemo(() => {
    if (!form.vocabRaw?.trim()) return { count: 0, error: null as string | null };
    try {
      const parsed = JSON.parse(form.vocabRaw);
      if (!Array.isArray(parsed)) return { count: 0, error: "JSON debe ser un array" };
      return { count: parsed.length, error: null };
    } catch {
      return { count: 0, error: "JSON inválido" };
    }
  }, [form.vocabRaw]);

  // Length budget. Thresholds picked from production data:
  //   - Journey stories average ~600 words / ~3700 chars (~4 min audio).
  //   - ElevenLabs narration starts to get expensive + slow past ~5 min.
  //   - Anything over ~7000 chars often times out at audio generation.
  // We warn (amber) at the soft limit and flag hard (red) past the hard one.
  // Speech rate = 150 wpm is the average for narrated audiobook-style TTS.
  const SOFT_WORDS = 800;
  const HARD_WORDS = 1100;
  const SOFT_CHARS = 5000;
  const HARD_CHARS = 7000;
  const charCount = (form.text ?? "").length;
  const wordCount = (form.text ?? "").trim() ? (form.text ?? "").trim().split(/\s+/).length : 0;
  const audioMin = wordCount > 0 ? wordCount / 150 : 0;
  const overHard = wordCount > HARD_WORDS || charCount > HARD_CHARS;
  const overSoft = !overHard && (wordCount > SOFT_WORDS || charCount > SOFT_CHARS);
  const counterColor = overHard ? "var(--mx-neg)" : overSoft ? "var(--mx-warn)" : undefined;

  function handleTitle(v: string) {
    onPatch("title", v);
    if (autoSlug && !touchedSlug) onPatch("slug", slugify(v));
  }

  // Generation row — only shown when the story already exists (editor opens
  // on an unsaved draft → no storyId yet, so no endpoints to hit). Buttons
  // follow the Journey Manager tone contract: yellow primary for "create
  // from scratch", purple for "deeper edit (text)", teal for analyze/vocab,
  // amber for "re-run one piece (cover/audio)". Disabled when the required
  // upstream is missing (no text → can't make vocab/audio; no title → can't
  // make cover/audio).
  const hasText = Boolean(form.text?.trim());
  const hasTitle = Boolean(form.title?.trim());
  const anyGenerating = (generators?.generating.size ?? 0) > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {generators && (
        <div className="jm-tool-row">
          <span className="jm-tool-row__label">Generar</span>
          {/* "Generar historia" (primer draft) sigue disponible; el modo
             "Regenerar historia" (sobreescribir un texto ya hecho) está
             desactivado porque cuesta tokens y por política del proyecto
             nunca se ejecuta sin disparador explícito. */}
          {!hasText ? (
            <button
              type="button"
              className="jm-btn jm-btn--primary jm-btn--sm"
              onClick={generators.onGenerateText}
              disabled={anyGenerating}
              title="Genera título + cuerpo + vocab desde la metadata"
            >
              {generators.generating.has("text") ? "Generando…" : "Generar historia"}
            </button>
          ) : (
            <button
              type="button"
              className="jm-btn jm-btn--sm"
              disabled
              title="Regenerar historia está deshabilitado por política. Edita el texto a mano si quieres cambios."
            >
              Regenerar historia (off)
            </button>
          )}
          {/* Granular regenerators — solo afectan title o synopsis, sin
              tocar el body. Costo de tokens bajo, riesgo controlado. */}
          <button
            type="button"
            className="jm-btn jm-btn-tone-teal jm-btn--sm"
            onClick={generators.onRegenerateTitle}
            disabled={anyGenerating}
            title="Genera un título nuevo desde la metadata (sinopsis + topic + idioma). No toca el body."
          >
            {generators.generating.has("title") ? "Generando…" : hasTitle ? "Regenerar título" : "Generar título"}
          </button>
          <button
            type="button"
            className="jm-btn jm-btn-tone-teal jm-btn--sm"
            onClick={generators.onRegenerateSynopsis}
            disabled={!hasTitle || anyGenerating}
            title={hasTitle ? "Genera una sinopsis nueva desde el título + metadata. No toca el body." : "Necesita título primero"}
          >
            {generators.generating.has("synopsis") ? "Generando…" : form.synopsis?.trim() ? "Regenerar synopsis" : "Generar synopsis"}
          </button>
          <button
            type="button"
            className="jm-btn jm-btn-tone-teal jm-btn--sm"
            onClick={generators.onGenerateVocab}
            disabled={!hasText || anyGenerating}
            title={hasText ? "Re-extrae vocab desde el texto actual" : "Necesita texto primero"}
          >
            {generators.generating.has("vocab") ? "Generando…" : "Regenerar vocab"}
          </button>
          <button
            type="button"
            className="jm-btn jm-btn-tone-teal jm-btn--sm"
            onClick={generators.onValidateVocab}
            disabled={!hasText || anyGenerating}
            title={hasText ? "Limpia el vocab actual: descarta ítems fuera del texto, ajusta conteo a 15-22" : "Necesita texto + vocab existente"}
          >
            {generators.generating.has("validate") ? "Validando…" : "Validar & arreglar vocab"}
          </button>
          <button
            type="button"
            className="jm-btn jm-btn-tone-teal jm-btn--sm"
            onClick={generators.onCheckVocabQuality}
            disabled={!hasText || anyGenerating}
            title={hasText ? "Evalúa el texto: diversidad léxica, # de candidatos a vocab, status (good/usable/weak)" : "Necesita texto primero"}
          >
            {generators.generating.has("quality") ? "Chequeando…" : "Verificar calidad"}
          </button>
          <button
            type="button"
            className="jm-btn jm-btn-tone-amber jm-btn--sm"
            onClick={generators.onGenerateCover}
            disabled={!hasTitle || !hasText || anyGenerating}
            title={!hasTitle ? "Necesita título primero" : !hasText ? "Necesita texto primero" : "Genera la portada con Flux + sube a R2"}
          >
            {generators.generating.has("cover") ? "Generando…" : form.coverUrl ? "Regenerar cover" : "Generar cover"}
          </button>
          {/* Regenerar audio: deshabilitado por política. ElevenLabs cobra
             por uso y la memoria del proyecto prohíbe regeneración de
             audio sin disparador explícito ("regenera/lanza/manda audio"). */}
          <button
            type="button"
            className="jm-btn jm-btn--sm"
            disabled
            title="Regenerar audio está deshabilitado por política (cuesta créditos ElevenLabs). Pídeselo a Claude explícitamente cuando estés seguro."
          >
            Regenerar audio (off)
          </button>
          {generators.readerUrl && (
            <>
              <span className="jm-row__spacer" />
              <a
                href={generators.readerUrl}
                target="_blank"
                rel="noopener"
                className="jm-btn jm-btn-tone-teal jm-btn--sm"
                title="Abre la historia en el reader público (pestaña nueva)"
              >
                Ver en reader ↗
              </a>
            </>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div>
          <label className="jm-field-label">Título</label>
          <input className="jm-input" value={form.title ?? ""} onChange={(e) => handleTitle(e.target.value)} />
        </div>
        <div>
          <label className="jm-field-label">Slug</label>
          <div style={{ display: "flex", gap: 4 }}>
            <input
              className="jm-input jm-input--mono"
              style={{ flex: 1, minWidth: 0 }}
              value={form.slug ?? ""}
              onChange={(e) => { setTouchedSlug(true); onPatch("slug", e.target.value); }}
            />
            <button
              type="button"
              className="jm-btn jm-btn-tone-teal jm-btn--sm"
              onClick={() => { setTouchedSlug(true); onPatch("slug", slugify(form.title ?? "")); }}
              disabled={!form.title?.trim()}
              title={form.title?.trim() ? "Regenerar slug desde el título actual" : "Necesita título primero"}
            >
              Slug ↻
            </button>
          </div>
        </div>
        <div>
          <label className="jm-field-label">Topic</label>
          <input className="jm-input" value={form.topic ?? ""} onChange={(e) => onPatch("topic", e.target.value || null)} />
        </div>
      </div>

      <div>
        <label className="jm-field-label">Synopsis</label>
        <textarea
          className="jm-input"
          rows={2}
          value={form.synopsis ?? ""}
          onChange={(e) => onPatch("synopsis", e.target.value || null)}
          placeholder="Blurb corto que se usa en el preview del reader, social cards, y SEO. 1-2 frases."
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div>
          <label className="jm-field-label">Idioma (override)</label>
          <select className="jm-input" value={form.language ?? ""} onChange={(e) => onPatch("language", e.target.value || null)}>
            <option value="">— hereda del libro</option>
            {LANGUAGES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="jm-field-label">Nivel (override)</label>
          <select className="jm-input" value={form.level ?? ""} onChange={(e) => onPatch("level", e.target.value || null)}>
            <option value="">— hereda</option>
            {LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="jm-field-label">CEFR (override)</label>
          <select className="jm-input" value={form.cefrLevel ?? ""} onChange={(e) => onPatch("cefrLevel", e.target.value || null)}>
            <option value="">— hereda</option>
            {CEFR.map((v) => <option key={v} value={v}>{v.toUpperCase()}</option>)}
          </select>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
          <label className="jm-field-label" style={{ margin: 0 }}>Texto principal</label>
          <span style={{ flex: 1 }} />
          <span className="jm-mono" style={{ fontSize: 11, color: counterColor ?? "var(--mx-muted)" }}>
            {wordCount} palabras · {charCount} chars · ~{audioMin.toFixed(1)} min audio
          </span>
        </div>
        <textarea
          className="jm-input"
          rows={14}
          style={{
            lineHeight: 1.55,
            fontFamily: "var(--mx-font)",
            borderColor: overHard ? "var(--mx-neg)" : overSoft ? "var(--mx-warn)" : undefined,
          }}
          value={form.text ?? ""}
          onChange={(e) => onPatch("text", e.target.value)}
        />
        {overHard && (
          <p style={{ fontSize: 11, color: "var(--mx-neg)", marginTop: 4, lineHeight: 1.5 }}>
            Texto muy largo (&gt;{HARD_WORDS} palabras o &gt;{HARD_CHARS} chars). Considera dividir en historias más cortas.
          </p>
        )}
        {!overHard && (
          <p className="jm-dim" style={{ fontSize: 11, marginTop: 4 }}>
            Acepta texto plano o HTML con <code>&lt;p&gt;</code> y <code>&lt;blockquote&gt;</code> (para multi-voz).
          </p>
        )}
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
          <label className="jm-field-label" style={{ margin: 0 }}>Vocab (JSON array)</label>
          <span style={{ flex: 1 }} />
          {generators?.vocabQuality && (() => {
            const q = generators.vocabQuality;
            const tone = q.status === "good" ? "jm-chip--green" : q.status === "usable" ? "jm-chip--amber" : "jm-chip--red";
            const label = q.status === "good" ? "Calidad: buena" : q.status === "usable" ? "Calidad: aceptable" : "Calidad: débil";
            return (
              <span
                className={`jm-chip jm-chip--mono ${tone}`}
                title={`${q.reason} · diversidad léxica ${q.lexicalDiversity.toFixed(2)} · ${q.candidateCount} candidatos · sugerido ≥${q.suggestedMinItems}`}
              >
                {label} · {q.candidateCount}c · ld {q.lexicalDiversity.toFixed(2)}
              </span>
            );
          })()}
          <span className="jm-mono jm-dim" style={{ fontSize: 11, color: vocabPreview.error ? "var(--mx-neg)" : undefined }}>
            {vocabPreview.error ?? `${vocabPreview.count} ítem${vocabPreview.count === 1 ? "" : "s"}`}
          </span>
        </div>
        <textarea
          className="jm-input jm-input--mono"
          rows={6}
          value={form.vocabRaw ?? ""}
          onChange={(e) => onPatch("vocabRaw", e.target.value)}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <MediaUploadField
          kind="cover"
          label="Cover"
          value={form.coverUrl ?? null}
          onChange={(url) => onPatch("coverUrl", url)}
        />
        <MediaUploadField
          kind="audio"
          label="Audio"
          value={form.audioUrl ?? null}
          onChange={(url) => onPatch("audioUrl", url)}
        />
      </div>
    </div>
  );
}
