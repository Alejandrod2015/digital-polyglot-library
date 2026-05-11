"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { StudioStandaloneStory } from "@/lib/studioStandaloneStories";

const input: React.CSSProperties = {
  background: "var(--card-background)",
  border: "1px solid var(--card-border)",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
  color: "var(--foreground)",
  minWidth: 140,
};

const btnPrimary: React.CSSProperties = {
  background: "#14b8a6",
  color: "white",
  border: "none",
  borderRadius: 6,
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--muted)",
  borderBottom: "1px solid var(--card-border)",
};

const td: React.CSSProperties = {
  padding: "10px 10px",
  fontSize: 13,
  borderBottom: "1px solid var(--card-border)",
};

const badge = (color: string, soft: string): React.CSSProperties => ({
  display: "inline-block",
  fontSize: 11,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 4,
  background: soft,
  color,
});

export default function StandaloneStoriesPageClient() {
  const [stories, setStories] = useState<StudioStandaloneStory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [cefr, setCefr] = useState("");
  const [published, setPublished] = useState<"" | "true" | "false">("");

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch("/api/studio/standalone-stories", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        return r.json();
      })
      .then((data: { stories: StudioStandaloneStory[] }) => {
        if (!cancelled) setStories(data.stories);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!stories) return null;
    return stories.filter((s) => {
      if (language && (s.language ?? "") !== language) return false;
      if (cefr && (s.cefrLevel ?? "") !== cefr) return false;
      if (published === "true" && !s.published) return false;
      if (published === "false" && s.published) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const hay = [s.title, s.slug, s.topic ?? ""].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [stories, language, cefr, published, query]);

  const languages = useMemo(
    () => Array.from(new Set((stories ?? []).map((s) => s.language).filter(Boolean))) as string[],
    [stories]
  );
  const cefrLevels = useMemo(
    () => Array.from(new Set((stories ?? []).map((s) => s.cefrLevel).filter(Boolean))) as string[],
    [stories]
  );

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <input
          placeholder="Buscar por título, slug o tema"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...input, minWidth: 280, flex: 1 }}
        />
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={input}>
          <option value="">Cualquier idioma</option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select value={cefr} onChange={(e) => setCefr(e.target.value)} style={input}>
          <option value="">Cualquier CEFR</option>
          {cefrLevels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={published}
          onChange={(e) => setPublished(e.target.value as "" | "true" | "false")}
          style={input}
        >
          <option value="">Publicación: todas</option>
          <option value="true">Publicadas</option>
          <option value="false">Sin publicar</option>
        </select>
        <Link href="/studio/standalone-stories/new" style={{ ...btnPrimary, textDecoration: "none" }}>
          + Nueva historia
        </Link>
      </div>

      {error && (
        <div style={{ padding: 12, background: "rgba(239, 68, 68, 0.1)", borderRadius: 6, color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {!stories && !error && (
        <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Cargando…</div>
      )}

      {filtered && (
        <>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
            {filtered.length} historia{filtered.length === 1 ? "" : "s"}
            {filtered.length !== stories!.length ? ` (de ${stories!.length})` : ""}
          </p>
          <div
            style={{
              border: "1px solid var(--card-border)",
              borderRadius: 8,
              overflow: "hidden",
              background: "var(--card-background)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Título</th>
                  <th style={th}>Slug</th>
                  <th style={th}>Idioma</th>
                  <th style={th}>CEFR</th>
                  <th style={th}>Origen</th>
                  <th style={th}>Estado</th>
                  <th style={th}>Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td style={td}>
                      <Link
                        href={`/studio/standalone-stories/${encodeURIComponent(s.id)}`}
                        style={{ color: "#14b8a6", textDecoration: "none", fontWeight: 500 }}
                      >
                        {s.title}
                      </Link>
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>{s.slug}</td>
                    <td style={td}>{s.language ?? "—"}</td>
                    <td style={td}>{s.cefrLevel?.toUpperCase() ?? "—"}</td>
                    <td style={td}>
                      <span style={badge("#a78bfa", "rgba(167, 139, 250, 0.15)")}>{s.sourceType}</span>
                    </td>
                    <td style={td}>
                      {s.published ? (
                        <span style={badge("#10b981", "rgba(16, 185, 129, 0.15)")}>Publicada</span>
                      ) : (
                        <span style={badge("#a3a3a3", "rgba(163, 163, 163, 0.15)")}>Borrador</span>
                      )}
                    </td>
                    <td style={{ ...td, fontSize: 11, color: "var(--muted)" }}>
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
