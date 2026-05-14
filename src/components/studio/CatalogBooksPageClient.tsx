"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { StudioCatalogBook } from "@/lib/studioCatalogBooks";

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

export default function CatalogBooksPageClient() {
  const [books, setBooks] = useState<StudioCatalogBook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [level, setLevel] = useState("");
  const [published, setPublished] = useState<"" | "true" | "false">("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/studio/catalog-books", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        return r.json();
      })
      .then((data: { books: StudioCatalogBook[] }) => {
        if (!cancelled) setBooks(data.books);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!books) return null;
    return books.filter((b) => {
      if (language && b.language !== language) return false;
      if (level && b.level !== level) return false;
      if (published === "true" && !b.published) return false;
      if (published === "false" && b.published) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const hay = [b.title, b.slug, b.topic ?? ""].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [books, language, level, published, query]);

  const languages = useMemo(
    () => Array.from(new Set((books ?? []).map((b) => b.language).filter(Boolean))),
    [books]
  );
  const levels = useMemo(
    () => Array.from(new Set((books ?? []).map((b) => b.level).filter(Boolean))),
    [books]
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
        <select value={level} onChange={(e) => setLevel(e.target.value)} style={input}>
          <option value="">Cualquier nivel</option>
          {levels.map((l) => (
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
          <option value="true">Publicados</option>
          <option value="false">Sin publicar</option>
        </select>
        <Link href="/studio/catalog-books/new" style={{ ...btnPrimary, textDecoration: "none" }}>
          + Nuevo libro
        </Link>
      </div>

      {error && (
        <div style={{ padding: 12, background: "rgba(239, 68, 68, 0.1)", borderRadius: 6, color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {!books && !error && (
        <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Cargando…</div>
      )}

      {filtered && (
        <>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
            {filtered.length} libro{filtered.length === 1 ? "" : "s"}
            {filtered.length !== books!.length ? ` (de ${books!.length})` : ""}
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
                  <th style={th}>Nivel</th>
                  <th style={th}>Historias</th>
                  <th style={th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id}>
                    <td style={td}>
                      <Link
                        href={`/studio/catalog-books/${encodeURIComponent(b.id)}`}
                        style={{ color: "#14b8a6", textDecoration: "none", fontWeight: 500 }}
                      >
                        {b.title}
                      </Link>
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>{b.slug}</td>
                    <td style={td}>{b.language}</td>
                    <td style={td}>{b.level}</td>
                    <td style={td}>{b.storyCount ?? "—"}</td>
                    <td style={td}>
                      {b.published ? (
                        <span style={badge("#10b981", "rgba(16, 185, 129, 0.15)")}>Publicado</span>
                      ) : (
                        <span style={badge("#a3a3a3", "rgba(163, 163, 163, 0.15)")}>Borrador</span>
                      )}
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
