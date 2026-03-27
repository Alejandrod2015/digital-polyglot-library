"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { JourneyCoverageGap, StudioJourneyStory } from "@/lib/studioJourneyStories";
import StudioActionLink from "@/components/studio/StudioActionLink";

type Props = {
  initialStories: StudioJourneyStory[];
  initialGaps: JourneyCoverageGap[];
};

function legacyStoryHref(story: Pick<StudioJourneyStory, "draftId" | "documentId" | "hasDraft">) {
  const documentId = story.hasDraft ? story.draftId : story.documentId;
  return `/studio/sanity/intent/edit/id=${encodeURIComponent(documentId)};type=standaloneStory`;
}

/* ── Shared styles ── */
const INPUT_CLASS = "studio-input";
const input: React.CSSProperties = {
  height: 38,
  borderRadius: 8,
  border: "1px solid var(--card-border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  padding: "0 12px",
  fontSize: 14,
  outline: "none",
  width: "100%",
};

const BTN_PRIMARY_CLASS = "studio-btn-primary";
const btnPrimary: React.CSSProperties = {
  height: 38,
  borderRadius: 8,
  border: "none",
  backgroundColor: "var(--primary)",
  color: "#fff",
  padding: "0 16px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const BTN_GHOST_CLASS = "studio-btn-ghost";
const btnGhost: React.CSSProperties = {
  height: 30,
  borderRadius: 6,
  border: "1px solid var(--card-border)",
  backgroundColor: "transparent",
  color: "var(--muted)",
  padding: "0 10px",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  whiteSpace: "nowrap",
};

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: `${color}20`,
        color,
      }}
    >
      {children}
    </span>
  );
}

export default function JourneyStoriesManager({ initialStories, initialGaps }: Props) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [stories, setStories] = useState(initialStories);
  const [gaps, setGaps] = useState(initialGaps);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [focus, setFocus] = useState("all");
  const [status, setStatus] = useState("all");
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [tab, setTab] = useState<"stories" | "gaps">("stories");

  useEffect(() => { setStories(initialStories); }, [initialStories]);
  useEffect(() => { setGaps(initialGaps); }, [initialGaps]);

  const levelOpts = useMemo(
    () => ["all", ...Array.from(new Set(stories.map((s) => s.cefrLevel).filter(Boolean)))],
    [stories]
  );
  const focusOpts = useMemo(
    () => ["all", ...Array.from(new Set(stories.map((s) => s.journeyFocus).filter(Boolean)))],
    [stories]
  );

  const filteredStories = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stories.filter((s) => {
      if (q && !s.title.toLowerCase().includes(q) && !s.slug.toLowerCase().includes(q) && !s.journeyTopic.toLowerCase().includes(q) && !s.topic.toLowerCase().includes(q)) return false;
      if (level !== "all" && s.cefrLevel !== level) return false;
      if (focus !== "all" && s.journeyFocus !== focus) return false;
      if (status !== "all") {
        const st = s.hasDraft ? "draft" : s.published ? "published" : "pending";
        if (st !== status) return false;
      }
      return true;
    });
  }, [focus, level, query, status, stories]);

  const filteredGaps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return gaps.filter((g) => {
      if (q && !g.topic.toLowerCase().includes(q) && !g.topicSlug.toLowerCase().includes(q) && !g.label.toLowerCase().includes(q) && !g.variant.toLowerCase().includes(q)) return false;
      if (level !== "all" && g.level !== level) return false;
      if (focus !== "all" && g.focus !== focus) return false;
      if (status !== "all" && status !== "pending") return false;
      return true;
    });
  }, [focus, gaps, level, query, status]);

  async function handleCreate() {
    setLoadingCreate(true);
    try {
      const res = await fetch("/api/studio/journey-stories", { method: "POST" });
      if (res.status === 401) {
        router.push("/sign-in?redirect_url=/studio/journey-stories");
        return;
      }
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = (await res.json()) as { story: StudioJourneyStory };
      startTransition(() => {
        router.push(`/studio/journey-stories/${json.story.id}`);
      });
    } catch (error) {
      console.error("Failed to create Journey story", error);
      window.alert("No se pudo crear el borrador. Inténtalo otra vez.");
    } finally {
      setLoadingCreate(false);
    }
  }

  async function handleCreateFromGap(gap: JourneyCoverageGap) {
    setLoadingCreate(true);
    try {
      const titlePrefix = gap.focus === "General" ? "Historia del Journey" : gap.focus;
      const res = await fetch("/api/studio/journey-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${titlePrefix}: ${gap.topic}`,
          language: gap.language.toLowerCase(),
          variant: gap.variant,
          region: gap.variant === "latam" ? "colombia" : gap.variant,
          cefrLevel: gap.level,
          topic: gap.topic,
          journeyTopic: gap.topicSlug,
          journeyOrder: gap.slotOrder,
          journeyFocus: gap.focus,
          journeyEligible: true,
          published: false,
        }),
      });
      if (res.status === 401) {
        router.push("/sign-in?redirect_url=/studio/journey-stories");
        return;
      }
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = (await res.json()) as { story: StudioJourneyStory };
      startTransition(() => {
        router.push(`/studio/journey-stories/${json.story.id}`);
      });
    } catch (error) {
      console.error("Failed to create Journey story from gap", error);
      window.alert("No se pudo crear el borrador. Inténtalo otra vez.");
    } finally {
      setLoadingCreate(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Filters ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: 12,
          padding: 16,
          borderRadius: 10,
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
      >
        <div style={{ flex: "1 1 200px" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Buscar</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Título, slug, topic..." className={INPUT_CLASS} style={input} />
        </div>
        <div style={{ flex: "0 0 120px" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Nivel</label>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className={INPUT_CLASS} style={input}>
            {levelOpts.map((o) => <option key={o} value={o}>{o === "all" ? "Todos" : o.toUpperCase()}</option>)}
          </select>
        </div>
        <div style={{ flex: "0 0 160px" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Focus</label>
          <select value={focus} onChange={(e) => setFocus(e.target.value)} className={INPUT_CLASS} style={input}>
            {focusOpts.map((o) => <option key={o} value={o}>{o === "all" ? "Todos" : o}</option>)}
          </select>
        </div>
        <div style={{ flex: "0 0 140px" }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Estado</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={INPUT_CLASS} style={input}>
            <option value="all">Todos</option>
            <option value="draft">Con borrador</option>
            <option value="published">Publicada</option>
            <option value="pending">Falta borrador</option>
          </select>
        </div>
        <button onClick={() => void handleCreate()} disabled={loadingCreate || isNavigating} className={BTN_PRIMARY_CLASS} style={{ ...btnPrimary, opacity: loadingCreate || isNavigating ? 0.6 : 1 }}>
          + {loadingCreate ? "Creando..." : isNavigating ? "Abriendo..." : "Nueva historia"}
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 4, backgroundColor: "var(--card-bg)", borderRadius: 10, padding: 4, border: "1px solid var(--card-border)" }}>
        {(["stories", "gaps"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 8,
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              backgroundColor: tab === t ? "var(--primary)" : "transparent",
              color: tab === t ? "#fff" : "var(--muted)",
              transition: "all 0.15s",
            }}
          >
            {t === "stories" ? `Historias (${filteredStories.length})` : `Huecos (${filteredGaps.length})`}
          </button>
        ))}
      </div>

      {/* ── Gaps ── */}
      {tab === "gaps" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredGaps.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>&#9989;</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: "0 0 6px" }}>No hay huecos</p>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>Todos los huecos del Journey están cubiertos o no coinciden con los filtros actuales.</p>
            </div>
          ) : filteredGaps.map((gap) => (
            <div
              key={gap.key}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "12px 16px",
                borderRadius: 10,
                backgroundColor: "var(--card-bg)",
                border: "1px solid var(--card-border)",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <Badge color={gap.type === "core-gap" ? "#ef4444" : "#0ea5e9"}>
                  {gap.type === "core-gap" ? "Hueco core" : "Oportunidad"}
                </Badge>
                <Badge color="#6b7280">{gap.level.toUpperCase()}</Badge>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{gap.topic}</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{gap.language}/{gap.variant.toUpperCase()}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>Hueco {gap.slotOrder}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => void handleCreateFromGap(gap)} disabled={loadingCreate || isNavigating} className={BTN_PRIMARY_CLASS} style={{ ...btnPrimary, height: 30, fontSize: 12, padding: "0 12px", opacity: loadingCreate || isNavigating ? 0.6 : 1 }}>
                  {loadingCreate ? "Creando..." : isNavigating ? "Abriendo..." : "Crear borrador"}
                </button>
                <StudioActionLink href={`/studio/journey-builder/${encodeURIComponent(gap.language)}/${encodeURIComponent(gap.variant)}?level=${encodeURIComponent(gap.level)}&topic=${encodeURIComponent(gap.topicSlug)}&slot=${gap.slotOrder}&focus=${encodeURIComponent(gap.focus)}`} className={BTN_GHOST_CLASS} style={btnGhost} pendingLabel="Abriendo creador...">
                  Abrir en creador
                </StudioActionLink>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Stories table ── */}
      {tab === "stories" && (
        filteredStories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>&#128214;</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: "0 0 6px" }}>
              {stories.length === 0 ? "Aún no hay historias" : "Ninguna historia coincide con estos filtros"}
            </p>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
              {stories.length === 0
                ? "Crea tu primera historia del Journey para empezar."
                : "Prueba ajustando la búsqueda, el nivel, el focus o el estado."}
            </p>
            {stories.length === 0 && (
              <button onClick={() => void handleCreate()} disabled={loadingCreate} className={BTN_PRIMARY_CLASS} style={{ ...btnPrimary, opacity: loadingCreate ? 0.6 : 1 }}>
                {loadingCreate ? "Creando..." : "+ Crear primera historia"}
              </button>
            )}
          </div>
        ) : (
          <div style={{ borderRadius: 10, border: "1px solid var(--card-border)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--card-bg)" }}>
                    {["Historia", "Nivel", "Topic / Orden", "Focus", "Estado", "Actualizada", "Acciones"].map((h) => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--muted)", borderBottom: "1px solid var(--card-border)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStories.map((story) => {
                    const st = story.hasDraft ? "Borrador" : story.published ? "Publicada" : "Falta borrador";
                    const stColor = story.hasDraft ? "#f59e0b" : story.published ? "#10b981" : "#6b7280";
                    return (
                      <tr
                        key={story.id}
                        style={{ borderBottom: "1px solid var(--card-border)" }}
                        className="studio-table-row"
                      >
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{story.title || "Sin título"}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "monospace" }}>{story.slug || "sin-slug"}</div>
                        </td>
                        <td style={{ padding: "10px 14px" }}><Badge color="#3b82f6">{story.cefrLevel.toUpperCase()}</Badge></td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontSize: 13, color: "var(--foreground)" }}>{story.journeyTopic || "—"}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>Orden {story.journeyOrder ?? "—"}</div>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--muted)" }}>{story.journeyFocus}</td>
                        <td style={{ padding: "10px 14px" }}><Badge color={stColor}>{st}</Badge></td>
                        <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--muted)" }}>
                          {story.updatedAt ? new Date(story.updatedAt).toLocaleDateString() : "—"}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <StudioActionLink href={`/studio/journey-stories/${story.id}`} className={BTN_GHOST_CLASS} style={btnGhost} pendingLabel="Abriendo historia...">Editar</StudioActionLink>
                            <StudioActionLink
                              href={`/studio/journey-builder/${encodeURIComponent(story.language ? story.language.charAt(0).toUpperCase() + story.language.slice(1) : "Spanish")}/${encodeURIComponent(story.variant)}?level=${encodeURIComponent(story.cefrLevel)}&topic=${encodeURIComponent(story.journeyTopic)}&slot=${story.journeyOrder ?? 1}&focus=${encodeURIComponent(story.journeyFocus || "General")}`}
                              className={BTN_GHOST_CLASS}
                              style={btnGhost}
                              pendingLabel="Abriendo creador..."
                            >
                              Hueco
                            </StudioActionLink>
                            <StudioActionLink href={legacyStoryHref(story)} className={BTN_GHOST_CLASS} style={btnGhost} pendingLabel="Abriendo Sanity...">Sanity</StudioActionLink>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
