"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StudioCatalogStory } from "@/lib/studioCatalogBooks";

type Props = { bookId: string; storyId: string };

const input: React.CSSProperties = {
  background: "var(--card-background)",
  border: "1px solid var(--card-border)",
  borderRadius: 6,
  padding: "8px 12px",
  fontSize: 13,
  color: "var(--foreground)",
  width: "100%",
};
const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--muted)",
  marginBottom: 6,
};
const card: React.CSSProperties = {
  background: "var(--card-background)",
  border: "1px solid var(--card-border)",
  borderRadius: 10,
  padding: 18,
  marginBottom: 16,
};
const btnPrimary: React.CSSProperties = {
  background: "#14b8a6",
  color: "white",
  border: "none",
  borderRadius: 6,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  background: "transparent",
  color: "var(--muted)",
  border: "1px solid var(--card-border)",
  borderRadius: 6,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};
const btnDanger: React.CSSProperties = {
  background: "rgba(239, 68, 68, 0.1)",
  color: "#ef4444",
  border: "1px solid rgba(239, 68, 68, 0.3)",
  borderRadius: 6,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

const LANGUAGES = ["spanish", "english", "german", "french", "italian", "portuguese"];
const LEVELS = ["beginner", "intermediate", "advanced"];
const CEFR = ["a1", "a2", "b1", "b2", "c1", "c2"];

function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
      {children}
    </div>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type FormState = Partial<StudioCatalogStory> & { vocabRaw?: string };

function vocabToRaw(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return "";
  }
}

export default function CatalogStoryEditorClient({ bookId, storyId }: Props) {
  const router = useRouter();
  const isNew = storyId === "new";
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<FormState>(
    isNew
      ? {
          title: "",
          slug: "",
          text: "",
          audio: "",
          audioUrl: null,
          coverUrl: null,
          tags: [],
          vocabRaw: "",
        }
      : {}
  );
  const [error, setError] = useState<string | null>(null);
  const [touchedSlug, setTouchedSlug] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    fetch(`/api/studio/catalog-books/${encodeURIComponent(bookId)}/stories/${encodeURIComponent(storyId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        return r.json();
      })
      .then((data: { story: StudioCatalogStory }) => {
        if (cancelled) return;
        setForm({ ...data.story, vocabRaw: vocabToRaw(data.story.vocab) });
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, storyId, isNew]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleTitleChange(v: string) {
    patch("title", v);
    if (isNew && !touchedSlug) patch("slug", slugify(v));
  }

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

  async function save() {
    if (!form.title?.trim() || !form.slug?.trim()) {
      setError("Título y slug son obligatorios.");
      return;
    }
    if (form.vocabRaw && vocabPreview.error) {
      setError(`Vocab: ${vocabPreview.error}`);
      return;
    }

    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {
      slug: form.slug,
      title: form.title,
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
      try {
        payload.vocab = JSON.parse(form.vocabRaw);
      } catch {
        // already guarded above
      }
    } else if (form.vocabRaw === "") {
      payload.vocab = null;
    }

    try {
      if (isNew) {
        const res = await fetch(
          `/api/studio/catalog-books/${encodeURIComponent(bookId)}/stories`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `Failed (${res.status})`);
        }
        const j = (await res.json()) as { story: StudioCatalogStory };
        router.replace(
          `/studio/catalog-books/${encodeURIComponent(bookId)}/stories/${encodeURIComponent(j.story.id)}`
        );
        router.refresh();
      } else {
        const res = await fetch(
          `/api/studio/catalog-books/${encodeURIComponent(bookId)}/stories/${encodeURIComponent(storyId)}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `Failed (${res.status})`);
        }
        const j = (await res.json()) as { story: StudioCatalogStory };
        setForm({ ...j.story, vocabRaw: vocabToRaw(j.story.vocab) });
        // If the slug changed, the id changed too — update the URL.
        if (j.story.id !== storyId) {
          router.replace(
            `/studio/catalog-books/${encodeURIComponent(bookId)}/stories/${encodeURIComponent(j.story.id)}`
          );
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Eliminar "${form.title}"?`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/studio/catalog-books/${encodeURIComponent(bookId)}/stories/${encodeURIComponent(storyId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      router.push(`/studio/catalog-books/${encodeURIComponent(bookId)}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  if (loading) return <div style={{ padding: 20, color: "var(--muted)" }}>Cargando…</div>;

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          padding: "10px 14px",
          background: "var(--card-background)",
          border: "1px solid var(--card-border)",
          borderRadius: 8,
          alignItems: "center",
        }}
      >
        <Link
          href={`/studio/catalog-books/${encodeURIComponent(bookId)}`}
          style={{ ...btnGhost, textDecoration: "none" }}
        >
          ← Volver al libro
        </Link>
        <div style={{ flex: 1 }} />
        {!isNew && (
          <button onClick={remove} disabled={deleting || saving} style={btnDanger}>
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        )}
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? "Guardando…" : isNew ? "Crear" : "Guardar"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: 6,
            color: "#ef4444",
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      <div style={card}>
        <h3 style={{ margin: 0, marginBottom: 12, fontSize: 14 }}>Metadata</h3>
        <FieldRow>
          <div>
            <label style={label}>Título</label>
            <input style={input} value={form.title ?? ""} onChange={(e) => handleTitleChange(e.target.value)} />
          </div>
          <div>
            <label style={label}>Slug</label>
            <input
              style={input}
              value={form.slug ?? ""}
              onChange={(e) => {
                setTouchedSlug(true);
                patch("slug", e.target.value);
              }}
            />
          </div>
          <div>
            <label style={label}>Topic</label>
            <input style={input} value={form.topic ?? ""} onChange={(e) => patch("topic", e.target.value || null)} />
          </div>
        </FieldRow>
        <div style={{ height: 14 }} />
        <FieldRow>
          <div>
            <label style={label}>Idioma (override)</label>
            <select style={input} value={form.language ?? ""} onChange={(e) => patch("language", e.target.value || null)}>
              <option value="">— hereda del libro</option>
              {LANGUAGES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>Nivel (override)</label>
            <select style={input} value={form.level ?? ""} onChange={(e) => patch("level", e.target.value || null)}>
              <option value="">— hereda</option>
              {LEVELS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>CEFR (override)</label>
            <select style={input} value={form.cefrLevel ?? ""} onChange={(e) => patch("cefrLevel", e.target.value || null)}>
              <option value="">— hereda</option>
              {CEFR.map((v) => (
                <option key={v} value={v}>
                  {v.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </FieldRow>
      </div>

      <div style={card}>
        <h3 style={{ margin: 0, marginBottom: 12, fontSize: 14 }}>Contenido</h3>
        <label style={label}>Texto principal</label>
        <textarea
          style={{ ...input, minHeight: 360, fontFamily: "inherit", lineHeight: 1.6 }}
          value={form.text ?? ""}
          onChange={(e) => patch("text", e.target.value)}
        />
      </div>

      <div style={card}>
        <h3 style={{ margin: 0, marginBottom: 12, fontSize: 14 }}>Vocabulary</h3>
        <label style={label}>vocab (JSON array de {"{ word, definition, type? }"})</label>
        <textarea
          style={{ ...input, minHeight: 200, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
          value={form.vocabRaw ?? ""}
          onChange={(e) => patch("vocabRaw", e.target.value)}
        />
        <p style={{ fontSize: 12, color: vocabPreview.error ? "#ef4444" : "var(--muted)", marginTop: 6 }}>
          {vocabPreview.error ?? `${vocabPreview.count} ítem${vocabPreview.count === 1 ? "" : "s"}`}
        </p>
      </div>

      <div style={card}>
        <h3 style={{ margin: 0, marginBottom: 12, fontSize: 14 }}>Media</h3>
        <FieldRow>
          <div>
            <label style={label}>Cover URL (R2 preferido)</label>
            <input style={input} value={form.coverUrl ?? ""} onChange={(e) => patch("coverUrl", e.target.value || null)} />
          </div>
          <div>
            <label style={label}>Audio URL (R2 preferido)</label>
            <input style={input} value={form.audioUrl ?? ""} onChange={(e) => patch("audioUrl", e.target.value || null)} />
          </div>
        </FieldRow>
        {form.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview
          <img src={form.coverUrl} alt="cover preview" style={{ maxWidth: 140, marginTop: 12, borderRadius: 6 }} />
        )}
        {form.audioUrl && (
          <audio controls src={form.audioUrl} style={{ width: "100%", marginTop: 12 }} />
        )}
      </div>
    </div>
  );
}
