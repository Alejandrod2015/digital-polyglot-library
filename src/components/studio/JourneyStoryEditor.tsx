"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StudioJourneyStory } from "@/lib/studioJourneyStories";
import StudioActionLink from "@/components/studio/StudioActionLink";
import StudioToast, { showToast } from "@/components/studio/StudioToast";

type Props = { story: StudioJourneyStory };

function legacyStoryHref(story: Pick<StudioJourneyStory, "draftId" | "documentId" | "hasDraft">) {
  const documentId = story.hasDraft ? story.draftId : story.documentId;
  return `/studio/sanity/intent/edit/id=${encodeURIComponent(documentId)};type=standaloneStory`;
}

/* ── Validation rules ── */
type ValidationErrors = Partial<Record<string, string>>;

function validate(form: StudioJourneyStory): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!form.title.trim()) errors.title = "El título es obligatorio";
  if (!form.slug.trim()) errors.slug = "El slug es obligatorio";
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) errors.slug = "El slug debe ir en minúsculas y con guiones";
  if (!form.variant.trim()) errors.variant = "La variante es obligatoria";
  if (!form.journeyTopic.trim()) errors.journeyTopic = "El topic del journey es obligatorio";
  return errors;
}

/* ── Styles ── */
const field: React.CSSProperties = {
  height: 40, width: "100%", borderRadius: 8,
  border: "1px solid var(--card-border)", backgroundColor: "var(--background)",
  color: "var(--foreground)", padding: "0 12px", fontSize: 14, outline: "none",
};
const fieldError: React.CSSProperties = { ...field, borderColor: "#ef4444" };

const textarea: React.CSSProperties = {
  ...field, height: "auto", padding: 12, lineHeight: 1.6, resize: "vertical",
};

const label: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4,
};

const errorMsg: React.CSSProperties = {
  fontSize: 12, color: "#ef4444", marginTop: 3, fontWeight: 500,
};

const btn: React.CSSProperties = {
  height: 36, borderRadius: 8, border: "1px solid var(--card-border)",
  backgroundColor: "transparent", color: "var(--foreground)", padding: "0 14px",
  fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none",
  display: "inline-flex", alignItems: "center", gap: 6,
};

const btnPrimary: React.CSSProperties = {
  ...btn, border: "none", backgroundColor: "var(--primary)", color: "#fff",
};

const qaPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 999,
  backgroundColor: "rgba(148, 163, 184, 0.12)",
  color: "var(--foreground)",
  fontSize: 12,
  fontWeight: 600,
};

const AUTOSAVE_DELAY = 5000;

export default function JourneyStoryEditor({ story }: Props) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [form, setForm] = useState(story);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const lastSavedRef = useRef(JSON.stringify(story));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const statusLabel = useMemo(() => {
    if (form.hasDraft) return "Borrador";
    if (form.published) return "Publicada";
    return "Falta borrador";
  }, [form.hasDraft, form.published]);

  const statusColor = form.hasDraft ? "#f59e0b" : form.published ? "#10b981" : "#6b7280";
  const publishedStoryHref = form.slug.trim() ? `/stories/${encodeURIComponent(form.slug.trim())}` : null;

  /* ── Revalidate on form changes ── */
  useEffect(() => {
    if (touched.size > 0) {
      setErrors(validate(form));
    }
  }, [form, touched]);

  function update<K extends keyof StudioJourneyStory>(key: K, value: StudioJourneyStory[K]) {
    setTouched((t) => new Set(t).add(key as string));
    setForm((c) => {
      const next = { ...c, [key]: value };
      setDirty(JSON.stringify(next) !== lastSavedRef.current);
      return next;
    });
  }

  /* ── Save ── */
  const save = useCallback(async (isAuto = false) => {
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setTouched(new Set(Object.keys(validationErrors)));
      if (!isAuto) showToast("Corrige los errores antes de guardar.", "error");
      return;
    }

    if (isAuto) setAutoSaveStatus("saving");
    else setSaving(true);

    try {
      const res = await fetch(`/api/studio/journey-stories/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, slug: form.slug, synopsis: form.synopsis, text: form.text,
          vocabRaw: form.vocabRaw, coverUrl: form.coverUrl, audioUrl: form.audioUrl,
          language: form.language, variant: form.variant, region: form.region, cefrLevel: form.cefrLevel,
          topic: form.topic, languageFocus: form.languageFocus, journeyTopic: form.journeyTopic,
          journeyOrder: form.journeyOrder, journeyFocus: form.journeyFocus,
          journeyEligible: form.journeyEligible, published: form.published,
        }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = (await res.json()) as { story: StudioJourneyStory };
      setForm(json.story);
      lastSavedRef.current = JSON.stringify(json.story);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
      if (isAuto) {
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      } else {
        showToast("Borrador guardado.", "success");
      }
    } catch (error) {
      console.error("Failed to save Journey story", error);
      if (isAuto) setAutoSaveStatus("idle");
      else showToast("No se pudo guardar la historia. Inténtalo otra vez.", "error");
    } finally {
      if (!isAuto) setSaving(false);
    }
  }, [form, story.id]);

  /* ── Auto-save ── */
  useEffect(() => {
    if (!dirty) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void save(true);
    }, AUTOSAVE_DELAY);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [dirty, save]);

  /* ── Cmd+S / Ctrl+S ── */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        void save(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [save]);

  /* ── Unsaved changes warning ── */
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) { e.preventDefault(); }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  async function duplicate() {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/studio/journey-stories/${story.id}?action=duplicate`, { method: "POST" });
      if (res.status === 401) {
        router.push(`/sign-in?redirect_url=${encodeURIComponent(`/studio/journey-stories/${story.id}`)}`);
        return;
      }
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = (await res.json()) as { story: StudioJourneyStory };
      showToast("Historia duplicada.", "success");
      startTransition(() => { router.push(`/studio/journey-stories/${json.story.id}`); });
    } catch (error) {
      console.error("Failed to duplicate Journey story", error);
      showToast("No se pudo duplicar la historia. Inténtalo otra vez.", "error");
    } finally { setDuplicating(false); }
  }

  /** Helper to render a field with optional error */
  function fieldStyle(key: string) {
    return errors[key] && touched.has(key) ? fieldError : field;
  }

  function renderError(key: string) {
    return errors[key] && touched.has(key) ? <p style={errorMsg}>{errors[key]}</p> : null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Toolbar ── */}
      <div
        style={{
          display: "flex", flexWrap: "wrap", alignItems: "center",
          justifyContent: "space-between", gap: 12, padding: "14px 18px",
          borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
            {form.title || "Historia sin título"}
          </h2>
          <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600, backgroundColor: `${statusColor}20`, color: statusColor }}>
            {statusLabel}
          </span>
          {dirty && autoSaveStatus === "idle" && (
            <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
              Cambios sin guardar
            </span>
          )}
          {autoSaveStatus === "saving" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, backgroundColor: "rgba(37, 99, 235, 0.12)", color: "var(--primary)" }}>
              <span style={{ width: 10, height: 10, border: "2px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" }} />
              Guardando...
            </span>
          )}
          {autoSaveStatus === "saved" && (
            <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, backgroundColor: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
              Todo guardado
            </span>
          )}
          {savedAt && autoSaveStatus === "idle" && <span style={{ fontSize: 12, color: "#10b981", fontWeight: 600 }}>Guardado a las {savedAt}</span>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <StudioActionLink href="/studio/journey-stories" className="studio-btn-ghost" style={btn} pendingLabel="Abriendo historias...">Volver a la lista</StudioActionLink>
          <StudioActionLink href={legacyStoryHref(form)} className="studio-btn-ghost" style={btn} pendingLabel="Abriendo Sanity...">Abrir en Sanity</StudioActionLink>
          <button onClick={() => void duplicate()} disabled={duplicating || isNavigating} className="studio-btn-ghost" style={{ ...btn, opacity: duplicating || isNavigating ? 0.6 : 1 }}>
            {duplicating ? "Duplicando..." : isNavigating ? "Abriendo..." : "Duplicar"}
          </button>
          <button onClick={() => void save(false)} disabled={saving} className="studio-btn-primary" style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
            {saving ? "Guardando..." : "Guardar borrador"}
          </button>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--muted)", margin: "-8px 0 0", textAlign: "right" }}>
        Guarda sola tras 5s de inactividad · <kbd style={{ padding: "1px 5px", borderRadius: 4, border: "1px solid var(--card-border)", backgroundColor: "var(--card-bg)", fontSize: 11, fontFamily: "monospace" }}>Cmd+S</kbd> para guardar ahora
      </p>

      {/* ── Two columns ── */}
      <div className="studio-editor-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 20, alignItems: "start" }}>

        {/* Left: Content */}
        <div style={{ borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: "0 0 16px" }}>Contenido</h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={label}>Título <span style={{ color: "#ef4444" }}>*</span></label>
              <input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Título de la historia" className="studio-input" style={fieldStyle("title")} aria-invalid={!!errors.title} aria-describedby={errors.title ? "err-title" : undefined} />
              {renderError("title")}
            </div>
            <div>
              <label style={label}>Sinopsis</label>
              <textarea value={form.synopsis} onChange={(e) => update("synopsis", e.target.value)} placeholder="Breve sinopsis..." rows={3} className="studio-input" style={textarea} />
            </div>
            <div>
              <label style={label}>Texto de la historia</label>
              <textarea value={form.text} onChange={(e) => update("text", e.target.value)} placeholder="Texto completo..." rows={18} className="studio-input" style={textarea} />
            </div>
            <div>
              <label style={label}>Vocabulario</label>
              <textarea value={form.vocabRaw} onChange={(e) => update("vocabRaw", e.target.value)} placeholder="JSON o texto de vocabulario..." rows={8} className="studio-input" style={textarea} />
            </div>
            <div>
              <label style={label}>Slug <span style={{ color: "#ef4444" }}>*</span></label>
              <input value={form.slug} onChange={(e) => update("slug", e.target.value)} placeholder="historia-slug" className="studio-input" style={{ ...fieldStyle("slug"), fontFamily: "monospace" }} aria-invalid={!!errors.slug} />
              {renderError("slug")}
            </div>
          </div>
        </div>

        {/* Right: Metadata */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: "0 0 16px" }}>Metadatos del Journey</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={label}>Idioma</label>
                <select value={form.language} onChange={(e) => update("language", e.target.value)} className="studio-input" style={field}>
                  <option value="spanish">Spanish</option><option value="english">English</option>
                  <option value="portuguese">Portuguese</option><option value="french">French</option>
                  <option value="italian">Italian</option><option value="german">German</option>
                </select>
              </div>
              <div>
                <label style={label}>Variante <span style={{ color: "#ef4444" }}>*</span></label>
                <input value={form.variant} onChange={(e) => update("variant", e.target.value)} placeholder="Variante" className="studio-input" style={fieldStyle("variant")} aria-invalid={!!errors.variant} />
                {renderError("variant")}
              </div>
              <div>
                <label style={label}>Región</label>
                <input value={form.region} onChange={(e) => update("region", e.target.value)} placeholder="Región" className="studio-input" style={field} />
              </div>
              <div>
                <label style={label}>Nivel CEFR</label>
                <select value={form.cefrLevel} onChange={(e) => update("cefrLevel", e.target.value)} className="studio-input" style={field}>
                  <option value="a1">A1</option><option value="a2">A2</option>
                  <option value="b1">B1</option><option value="b2">B2</option>
                  <option value="c1">C1</option><option value="c2">C2</option>
                </select>
              </div>
              <div>
                <label style={label}>Topic</label>
                <input value={form.topic} onChange={(e) => update("topic", e.target.value)} placeholder="Topic" className="studio-input" style={field} />
              </div>
              <div>
                <label style={label}>Focus lingüístico</label>
                <select value={form.languageFocus} onChange={(e) => update("languageFocus", e.target.value)} className="studio-input" style={field}>
                  <option value="mixed">Mixto</option><option value="verbs">Verbos</option>
                  <option value="nouns">Sustantivos</option><option value="adjectives">Adjetivos</option>
                  <option value="expressions">Expresiones</option>
                </select>
              </div>
              <div>
                <label style={label}>Topic del journey <span style={{ color: "#ef4444" }}>*</span></label>
                <input value={form.journeyTopic} onChange={(e) => update("journeyTopic", e.target.value)} placeholder="Topic del journey" className="studio-input" style={fieldStyle("journeyTopic")} aria-invalid={!!errors.journeyTopic} />
                {renderError("journeyTopic")}
              </div>
              <div>
                <label style={label}>Orden en el journey</label>
                <input value={form.journeyOrder ?? ""} onChange={(e) => update("journeyOrder", e.target.value ? Number(e.target.value) : null)} type="number" placeholder="Orden" className="studio-input" style={field} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={label}>Focus del journey</label>
                <select value={form.journeyFocus} onChange={(e) => update("journeyFocus", e.target.value)} className="studio-input" style={field}>
                  <option value="General">General</option>
                  <option value="Travel & Local Life">Travel & Local Life</option>
                  <option value="Work & Career">Work & Career</option>
                  <option value="Culture & Belonging">Culture & Belonging</option>
                </select>
              </div>
            </div>

            {/* Toggles */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--card-border)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--foreground)", cursor: "pointer" }}>
                <input type="checkbox" checked={form.journeyEligible} onChange={(e) => update("journeyEligible", e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--primary)" }} />
                Mostrar en Journey
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "var(--foreground)", cursor: "pointer" }}>
                <input type="checkbox" checked={form.published} onChange={(e) => update("published", e.target.checked)} style={{ width: 18, height: 18, accentColor: "#10b981" }} />
                Publicada en la app
              </label>
            </div>
          </div>

          <div style={{ borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: "0 0 16px" }}>Media</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={label}>URL de cover</label>
                <input value={form.coverUrl} onChange={(e) => update("coverUrl", e.target.value)} placeholder="https://..." className="studio-input" style={field} />
              </div>
              {form.coverUrl.trim() ? (
                <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--card-border)", backgroundColor: "var(--background)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.coverUrl} alt={form.title || "Cover"} style={{ display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }} />
                </div>
              ) : null}
              <div>
                <label style={label}>URL de audio</label>
                <input value={form.audioUrl} onChange={(e) => update("audioUrl", e.target.value)} placeholder="https://..." className="studio-input" style={field} />
              </div>
              {form.audioUrl.trim() ? (
                <a href={form.audioUrl} target="_blank" rel="noreferrer" style={{ ...btn, width: "fit-content" }}>
                  Abrir audio
                </a>
              ) : null}
            </div>
          </div>

          <div style={{ borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: "0 0 12px" }}>QA</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <span style={qaPill}>Audio: {form.audioQaStatus || "Sin revisar"}</span>
              <span style={qaPill}>Score audio: {form.audioQaScore ?? "—"}</span>
              <span style={qaPill}>Entrega audio: {form.audioDeliveryQaStatus || "Sin revisar"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={label}>Reporte de vocabulario de la historia</label>
                <textarea value={form.storyVocabQualityRaw} readOnly rows={4} className="studio-input" style={{ ...textarea, opacity: 0.8 }} />
              </div>
              <div>
                <label style={label}>Validación de vocabulario</label>
                <textarea value={form.vocabValidationRaw} readOnly rows={4} className="studio-input" style={{ ...textarea, opacity: 0.8 }} />
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div style={{ borderRadius: 10, backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)", padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", margin: "0 0 12px" }}>Atajos</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <StudioActionLink
                href={`/studio/journey-builder/${encodeURIComponent(form.language ? form.language.charAt(0).toUpperCase() + form.language.slice(1) : "Spanish")}/${encodeURIComponent(form.variant)}?level=${encodeURIComponent(form.cefrLevel)}&topic=${encodeURIComponent(form.journeyTopic)}&slot=${form.journeyOrder ?? 1}&focus=${encodeURIComponent(form.journeyFocus || "General")}`}
                className="studio-btn-ghost"
                style={btn}
                pendingLabel="Abriendo creador..."
              >
                Abrir hueco en el creador
              </StudioActionLink>
              {publishedStoryHref ? (
                <StudioActionLink href={publishedStoryHref} className="studio-btn-ghost" style={btn} pendingLabel="Abriendo historia...">
                  Abrir historia publicada
                </StudioActionLink>
              ) : null}
              <StudioActionLink href={legacyStoryHref(form)} className="studio-btn-ghost" style={btn} pendingLabel="Abriendo Sanity...">Abrir en Sanity</StudioActionLink>
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10, fontFamily: "monospace" }}>
              ID: {form.documentId}
            </p>
          </div>
        </div>
      </div>

      <StudioToast />
    </div>
  );
}
