"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MediaUploadField from "@/components/studio/MediaUploadField";
import type {
  StudioCatalogBook,
  StudioCatalogStory,
} from "@/lib/studioCatalogBooks";

type Props = { id: string };

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
const VARIANTS = ["latam", "spain", "us", "uk", "brazil", "portugal", "germany", "austria", "france", "canada-fr", "italy"];
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

type FormState = Partial<StudioCatalogBook>;

export default function CatalogBookEditorClient({ id }: Props) {
  const router = useRouter();
  const isNew = id === "new";
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<FormState>(
    isNew
      ? {
          title: "",
          slug: "",
          description: "",
          language: "spanish",
          level: "beginner",
          published: false,
          theme: [],
        }
      : {}
  );
  const [stories, setStories] = useState<StudioCatalogStory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [touchedSlug, setTouchedSlug] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    fetch(`/api/studio/catalog-books/${encodeURIComponent(id)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        return r.json();
      })
      .then((data: { book: StudioCatalogBook; stories: StudioCatalogStory[] }) => {
        if (cancelled) return;
        setForm(data.book);
        setStories(data.stories);
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
  }, [id, isNew]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleTitleChange(v: string) {
    patch("title", v);
    if (isNew && !touchedSlug) patch("slug", slugify(v));
  }

  async function save() {
    if (!form.title?.trim() || !form.slug?.trim()) {
      setError("Título y slug son obligatorios.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const res = await fetch("/api/studio/catalog-books", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `Failed (${res.status})`);
        }
        const j = (await res.json()) as { book: StudioCatalogBook };
        router.replace(`/studio/catalog-books/${encodeURIComponent(j.book.id)}`);
        router.refresh();
      } else {
        const res = await fetch(`/api/studio/catalog-books/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `Failed (${res.status})`);
        }
        const j = (await res.json()) as { book: StudioCatalogBook };
        setForm(j.book);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const count = stories.length;
    if (count > 0) {
      if (!confirm(`Eliminar "${form.title}" y sus ${count} historia${count === 1 ? "" : "s"}? Esta acción no se puede deshacer.`)) return;
    } else {
      if (!confirm(`Eliminar "${form.title}"?`)) return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/catalog-books/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      router.push("/studio/catalog-books");
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
        <Link href="/studio/catalog-books" style={{ ...btnGhost, textDecoration: "none" }}>
          ← Volver
        </Link>
        <div style={{ flex: 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--foreground)" }}>
          <input
            type="checkbox"
            checked={Boolean(form.published)}
            onChange={(e) => patch("published", e.target.checked)}
          />
          Publicado
        </label>
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

      {/* Metadata */}
      <div style={card}>
        <h3 style={{ margin: 0, marginBottom: 12, fontSize: 14 }}>Metadata del libro</h3>
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
            <label style={label}>Subtítulo</label>
            <input style={input} value={form.subtitle ?? ""} onChange={(e) => patch("subtitle", e.target.value || null)} />
          </div>
        </FieldRow>
        <div style={{ height: 14 }} />
        <label style={label}>Descripción</label>
        <textarea
          style={{ ...input, minHeight: 70, fontFamily: "inherit" }}
          value={form.description ?? ""}
          onChange={(e) => patch("description", e.target.value)}
        />
        <div style={{ height: 14 }} />
        <FieldRow>
          <div>
            <label style={label}>Idioma</label>
            <select style={input} value={form.language ?? ""} onChange={(e) => patch("language", e.target.value)}>
              {LANGUAGES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>Variante</label>
            <select style={input} value={form.variant ?? ""} onChange={(e) => patch("variant", e.target.value || null)}>
              <option value="">—</option>
              {VARIANTS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>Región</label>
            <input style={input} value={form.region ?? ""} onChange={(e) => patch("region", e.target.value || null)} />
          </div>
        </FieldRow>
        <div style={{ height: 14 }} />
        <FieldRow>
          <div>
            <label style={label}>Nivel</label>
            <select style={input} value={form.level ?? "beginner"} onChange={(e) => patch("level", e.target.value)}>
              {LEVELS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>CEFR</label>
            <select style={input} value={form.cefrLevel ?? ""} onChange={(e) => patch("cefrLevel", e.target.value || null)}>
              <option value="">—</option>
              {CEFR.map((v) => (
                <option key={v} value={v}>
                  {v.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>Topic</label>
            <input style={input} value={form.topic ?? ""} onChange={(e) => patch("topic", e.target.value || null)} />
          </div>
        </FieldRow>
        <div style={{ height: 14 }} />
        <FieldRow>
          <div>
            <MediaUploadField
              kind="cover"
              label="Cover (sube imagen o pega URL)"
              value={form.coverUrl ?? null}
              onChange={(url) => patch("coverUrl", url)}
            />
          </div>
          <div>
            <label style={label}>Store URL</label>
            <input style={input} value={form.storeUrl ?? ""} onChange={(e) => patch("storeUrl", e.target.value || null)} />
          </div>
          <div>
            <label style={label}>Audio folder (legacy)</label>
            <input style={input} value={form.audioFolder ?? ""} onChange={(e) => patch("audioFolder", e.target.value)} />
          </div>
        </FieldRow>
      </div>

      {/* Stories inside the book */}
      {!isNew && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>
              Historias <span style={{ color: "var(--muted)", fontWeight: 400 }}>({stories.length})</span>
            </h3>
            <Link
              href={`/studio/catalog-books/${encodeURIComponent(id)}/stories/new`}
              style={{ ...btnPrimary, textDecoration: "none", fontSize: 12 }}
            >
              + Agregar historia
            </Link>
          </div>
          {stories.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Este libro todavía no tiene historias.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 4px", fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>#</th>
                  <th style={{ textAlign: "left", padding: "6px 4px", fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Título</th>
                  <th style={{ textAlign: "left", padding: "6px 4px", fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Slug</th>
                  <th style={{ textAlign: "left", padding: "6px 4px", fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Texto</th>
                </tr>
              </thead>
              <tbody>
                {stories.map((s) => (
                  <tr key={s.id}>
                    <td style={{ padding: "6px 4px", fontSize: 12, color: "var(--muted)" }}>{s.position + 1}</td>
                    <td style={{ padding: "6px 4px", fontSize: 13 }}>
                      <Link
                        href={`/studio/catalog-books/${encodeURIComponent(id)}/stories/${encodeURIComponent(s.id)}`}
                        style={{ color: "#14b8a6", textDecoration: "none" }}
                      >
                        {s.title || "(sin título)"}
                      </Link>
                    </td>
                    <td style={{ padding: "6px 4px", fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>{s.slug}</td>
                    <td style={{ padding: "6px 4px", fontSize: 11, color: "var(--muted)" }}>
                      {s.text ? `${s.text.length} chars` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
