"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MediaUploadField from "@/components/studio/MediaUploadField";
import type { StudioStandaloneStory } from "@/lib/studioStandaloneStories";

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
const FOCUS = ["adjectives", "verbs", "nouns", "expressions", "mixed"];
const FORMALITY = ["informal", "neutral", "formal"];
const JOURNEY_FOCUS = ["General", "Travel & Local Life", "Work & Career", "Culture & Belonging"];

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

type FormState = Partial<StudioStandaloneStory>;

export default function StandaloneStoryEditorClient({ id }: Props) {
  const router = useRouter();
  const isNew = id === "new";
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<FormState>(
    isNew
      ? {
          sourceType: "studio",
          title: "",
          slug: "",
          synopsis: "",
          text: "",
          language: null,
          variant: null,
          region: null,
          level: null,
          cefrLevel: null,
          focus: null,
          topic: null,
          journeyEligible: false,
          journeyTopic: null,
          journeyOrder: null,
          journeyFocus: null,
          vocabRaw: "",
          coverUrl: null,
          audioUrl: null,
          published: false,
        }
      : {}
  );
  const [error, setError] = useState<string | null>(null);
  const [touchedSlug, setTouchedSlug] = useState(false);
  type GenerateKind = "text" | "vocab" | "cover" | "audio";
  const [generating, setGenerating] = useState<GenerateKind | null>(null);
  const [genStatus, setGenStatus] = useState<string | null>(null);

  async function runGenerator(kind: GenerateKind) {
    if (isNew) {
      setError("Guarda la historia primero. Los generadores trabajan sobre una historia existente.");
      return;
    }
    if (generating) return;
    setGenerating(kind);
    setError(null);
    setGenStatus(`Generando ${kind}...`);
    try {
      const res = await fetch(
        `/api/studio/standalone-stories/${encodeURIComponent(id)}/generate-${kind}`,
        { method: "POST", headers: { "content-type": "application/json" } }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Generation failed (${res.status})`);
      }
      const j = (await res.json()) as { story: Partial<StudioStandaloneStory> };
      // Merge only the fields the endpoint actually updated, so other in-flight
      // edits in the form don't get wiped.
      setForm((prev) => ({ ...prev, ...j.story }));
      setGenStatus(`✓ ${kind} listo`);
      setTimeout(() => setGenStatus(null), 2500);
    } catch (e) {
      setError((e as Error).message);
      setGenStatus(null);
    } finally {
      setGenerating(null);
    }
  }

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    fetch(`/api/studio/standalone-stories/${encodeURIComponent(id)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load (${r.status})`);
        return r.json();
      })
      .then((data: { story: StudioStandaloneStory }) => {
        if (cancelled) return;
        setForm(data.story);
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
    if (!form.title?.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    if (!form.slug?.trim()) {
      setError("El slug es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const res = await fetch("/api/studio/standalone-stories", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `Failed (${res.status})`);
        }
        const j = (await res.json()) as { story: StudioStandaloneStory };
        router.replace(`/studio/standalone-stories/${encodeURIComponent(j.story.id)}`);
        router.refresh();
      } else {
        const res = await fetch(`/api/studio/standalone-stories/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `Failed (${res.status})`);
        }
        const j = (await res.json()) as { story: StudioStandaloneStory };
        setForm(j.story);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Eliminar "${form.title}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/standalone-stories/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Failed (${res.status})`);
      }
      router.push("/studio/standalone-stories");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  const vocabPreview = useMemo(() => {
    if (!form.vocabRaw?.trim()) return { count: 0, error: null };
    try {
      const parsed = JSON.parse(form.vocabRaw);
      if (!Array.isArray(parsed)) return { count: 0, error: "JSON debe ser un array" };
      return { count: parsed.length, error: null };
    } catch {
      return { count: 0, error: "JSON inválido" };
    }
  }, [form.vocabRaw]);

  if (loading) {
    return <div style={{ padding: 20, color: "var(--muted)" }}>Cargando…</div>;
  }

  return (
    <div>
      {/* sticky action bar */}
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
        <Link href="/studio/standalone-stories" style={{ ...btnGhost, textDecoration: "none" }}>
          ← Volver
        </Link>
        <div style={{ flex: 1 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--foreground)" }}>
          <input
            type="checkbox"
            checked={Boolean(form.published)}
            onChange={(e) => patch("published", e.target.checked)}
          />
          Publicada
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

      {genStatus && (
        <div
          style={{
            padding: "8px 14px",
            background: "rgba(20, 184, 166, 0.1)",
            border: "1px solid rgba(20, 184, 166, 0.3)",
            borderRadius: 6,
            color: "#14b8a6",
            fontSize: 12,
            marginBottom: 14,
          }}
        >
          {genStatus}
        </div>
      )}

      {/* Metadata */}
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
            <label style={label}>Fuente</label>
            <select style={input} value={form.sourceType ?? "studio"} onChange={(e) => patch("sourceType", e.target.value)}>
              <option value="studio">studio</option>
              <option value="sanity">sanity (legacy)</option>
              <option value="create">create (user-generated)</option>
            </select>
          </div>
        </FieldRow>
        <div style={{ height: 14 }} />
        <FieldRow>
          <div>
            <label style={label}>Idioma</label>
            <select style={input} value={form.language ?? ""} onChange={(e) => patch("language", e.target.value || null)}>
              <option value="">—</option>
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
            <select style={input} value={form.level ?? ""} onChange={(e) => patch("level", e.target.value || null)}>
              <option value="">—</option>
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
            <label style={label}>Enfoque</label>
            <select style={input} value={form.focus ?? ""} onChange={(e) => patch("focus", e.target.value || null)}>
              <option value="">—</option>
              {FOCUS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </FieldRow>
        <div style={{ height: 14 }} />
        <FieldRow>
          <div>
            <label style={label}>Topic</label>
            <input style={input} value={form.topic ?? ""} onChange={(e) => patch("topic", e.target.value || null)} />
          </div>
        </FieldRow>
      </div>

      {/* Content */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Contenido</h3>
          <button
            type="button"
            onClick={() => runGenerator("text")}
            disabled={generating !== null || isNew}
            style={{ ...btnGhost, fontSize: 12 }}
            title={isNew ? "Guarda la historia primero" : "Generar título + texto con IA"}
          >
            {generating === "text" ? "Generando…" : "🪄 Generate story"}
          </button>
        </div>
        <label style={label}>Sinopsis</label>
        <textarea
          style={{ ...input, minHeight: 70, fontFamily: "inherit" }}
          value={form.synopsis ?? ""}
          onChange={(e) => patch("synopsis", e.target.value || null)}
        />
        <div style={{ height: 14 }} />
        <label style={label}>Texto principal</label>
        <textarea
          style={{ ...input, minHeight: 320, fontFamily: "inherit", lineHeight: 1.6 }}
          value={form.text ?? ""}
          onChange={(e) => patch("text", e.target.value)}
        />
      </div>

      {/* Vocab */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Vocabulary</h3>
          <button
            type="button"
            onClick={() => runGenerator("vocab")}
            disabled={generating !== null || isNew}
            style={{ ...btnGhost, fontSize: 12 }}
            title={isNew ? "Guarda la historia primero" : "Extraer vocab del texto con IA"}
          >
            {generating === "vocab" ? "Generando…" : "🧠 Generate vocabulary"}
          </button>
        </div>
        <label style={label}>vocabRaw (JSON array de {"{ word, definition, type? }"})</label>
        <textarea
          style={{ ...input, minHeight: 200, fontFamily: "ui-monospace, monospace", fontSize: 12 }}
          value={form.vocabRaw ?? ""}
          onChange={(e) => patch("vocabRaw", e.target.value || null)}
        />
        <p style={{ fontSize: 12, color: vocabPreview.error ? "#ef4444" : "var(--muted)", marginTop: 6 }}>
          {vocabPreview.error ?? `${vocabPreview.count} ítem${vocabPreview.count === 1 ? "" : "s"}`}
        </p>
      </div>

      {/* Media */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Media</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => runGenerator("cover")}
              disabled={generating !== null || isNew}
              style={{ ...btnGhost, fontSize: 12 }}
              title={isNew ? "Guarda la historia primero" : "Generar cover con Flux + subir a R2"}
            >
              {generating === "cover" ? "Generando…" : "🖼️ Generate cover"}
            </button>
            <button
              type="button"
              onClick={() => runGenerator("audio")}
              disabled={generating !== null || isNew}
              style={{ ...btnGhost, fontSize: 12 }}
              title={isNew ? "Guarda la historia primero" : "Narrar con ElevenLabs + subir a R2"}
            >
              {generating === "audio" ? "Generando…" : "🎙️ Generate audio"}
            </button>
          </div>
        </div>
        <FieldRow>
          <MediaUploadField
            kind="cover"
            label="Cover (sube imagen o pega URL)"
            value={form.coverUrl ?? null}
            onChange={(url) => patch("coverUrl", url)}
          />
          <MediaUploadField
            kind="audio"
            label="Audio (sube archivo o pega URL)"
            value={form.audioUrl ?? null}
            onChange={(url) => patch("audioUrl", url)}
          />
        </FieldRow>
      </div>

      {/* Journey */}
      <div style={card}>
        <h3 style={{ margin: 0, marginBottom: 12, fontSize: 14 }}>Journey</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={Boolean(form.journeyEligible)}
            onChange={(e) => patch("journeyEligible", e.target.checked)}
          />
          Show in Journey
        </label>
        {form.journeyEligible && (
          <FieldRow>
            <div>
              <label style={label}>Journey topic</label>
              <input
                style={input}
                value={form.journeyTopic ?? ""}
                onChange={(e) => patch("journeyTopic", e.target.value || null)}
              />
            </div>
            <div>
              <label style={label}>Journey order</label>
              <input
                style={input}
                type="number"
                value={form.journeyOrder ?? ""}
                onChange={(e) => patch("journeyOrder", e.target.value === "" ? null : Number(e.target.value))}
              />
            </div>
            <div>
              <label style={label}>Journey focus</label>
              <select
                style={input}
                value={form.journeyFocus ?? "General"}
                onChange={(e) => patch("journeyFocus", e.target.value)}
              >
                {JOURNEY_FOCUS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </FieldRow>
        )}
      </div>

      {/* QA (readonly informational) */}
      {!isNew && (form.audioQaStatus || form.audioDeliveryQaStatus) && (
        <div style={card}>
          <h3 style={{ margin: 0, marginBottom: 12, fontSize: 14 }}>QA (read-only)</h3>
          <FieldRow>
            <div>
              <label style={label}>Audio QA</label>
              <div style={{ fontSize: 13 }}>{form.audioQaStatus ?? "—"}</div>
            </div>
            <div>
              <label style={label}>Audio QA score</label>
              <div style={{ fontSize: 13 }}>{form.audioQaScore ?? "—"}</div>
            </div>
            <div>
              <label style={label}>Audio delivery QA</label>
              <div style={{ fontSize: 13 }}>{form.audioDeliveryQaStatus ?? "—"}</div>
            </div>
          </FieldRow>
        </div>
      )}
    </div>
  );
}
