import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import {
  ASSET_ROADMAP,
  movidaProgress,
  statusColor,
  statusLabel,
  type Movida,
  type RoadmapPiece,
  type WorkLogEntry,
} from "@/lib/assetRoadmap";

const ACCENT = "#14b8a6";
const ACCENT_SOFT = "rgba(20, 184, 166, 0.12)";
const CARD_BG = "rgba(255, 255, 255, 0.02)";
const CARD_BORDER = "rgba(255, 255, 255, 0.08)";

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 100 ? "#10b981" : pct >= 50 ? ACCENT : pct > 0 ? "#f59e0b" : "#475569";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
      <div
        style={{
          flex: 1,
          height: 8,
          background: "rgba(255, 255, 255, 0.06)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color,
          minWidth: 36,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

function StatusBadge({ piece }: { piece: RoadmapPiece }) {
  const { bg, fg } = statusColor(piece.status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {statusLabel(piece.status)}
      {piece.commit && (
        <span style={{ opacity: 0.7, fontWeight: 500, fontFamily: "ui-monospace, monospace" }}>
          {piece.commit}
        </span>
      )}
    </span>
  );
}

function PieceRow({ piece }: { piece: RoadmapPiece }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        padding: "14px 0",
        borderTop: `1px solid ${CARD_BORDER}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", marginBottom: 4 }}>
          {piece.title}
        </div>
        {piece.note && (
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
            {piece.note}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        <StatusBadge piece={piece} />
      </div>
    </div>
  );
}

function WorkLogCard({ entry }: { entry: WorkLogEntry }) {
  return (
    <article
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 10,
        padding: "16px 20px",
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--muted)",
            fontVariantNumeric: "tabular-nums",
            opacity: 0.85,
          }}
        >
          {entry.date}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: ACCENT,
            background: ACCENT_SOFT,
            padding: "2px 8px",
            borderRadius: 5,
          }}
        >
          {entry.scope}
        </span>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "var(--foreground)", flex: 1 }}>
          {entry.title}
        </h3>
        {entry.commits && entry.commits.length > 0 && (
          <span
            style={{
              fontSize: 11,
              fontFamily: "ui-monospace, monospace",
              color: "var(--muted)",
              opacity: 0.7,
            }}
          >
            {entry.commits.join(" · ")}
          </span>
        )}
      </header>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 10px", lineHeight: 1.55 }}>
        {entry.summary}
      </p>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          fontSize: 12,
          color: "var(--muted)",
          lineHeight: 1.65,
          opacity: 0.92,
        }}
      >
        {entry.highlights.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </article>
  );
}

function MovidaCard({ movida }: { movida: Movida }) {
  const progress = movidaProgress(movida);
  const deployedCount = movida.pieces.filter((p) => p.status === "deployed").length;
  const totalCount = movida.pieces.length;

  return (
    <section
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
        padding: "20px 24px",
      }}
    >
      <header style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: ACCENT,
              background: ACCENT_SOFT,
              padding: "3px 8px",
              borderRadius: 6,
            }}
          >
            MOVIDA {movida.id}
          </span>
          <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0, color: "var(--foreground)" }}>
            {movida.title}
          </h3>
          <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
            {deployedCount} / {totalCount} en producción
          </span>
        </div>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
          {movida.goal}
        </p>
        <ProgressBar value={progress} />
      </header>
      <div>
        {movida.pieces.map((piece, i) => (
          <PieceRow key={i} piece={piece} />
        ))}
      </div>
    </section>
  );
}

export default async function StudioProgresoPage() {
  await requireStudioUser("/studio/progreso");

  return (
    <StudioShell
      title="Progreso del proyecto"
      description="Visualización del avance de la asset thesis y las movidas. Datos en src/lib/assetRoadmap.ts; doc espejo en docs/asset-roadmap.md."
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Progreso" }]}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Last updated */}
        <div
          style={{
            fontSize: 12,
            color: "var(--muted)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Última actualización: {ASSET_ROADMAP.lastUpdated}</span>
          <span style={{ opacity: 0.7 }}>
            Para actualizar: editar <code style={{ fontFamily: "ui-monospace, monospace" }}>src/lib/assetRoadmap.ts</code>
          </span>
        </div>

        {/* Thesis card */}
        <section
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 12,
            padding: "20px 24px",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px", color: "var(--foreground)" }}>
            {ASSET_ROADMAP.thesisHeadline}
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
            {ASSET_ROADMAP.thesisSummary}
          </p>
        </section>

        {/* Three assets */}
        <section>
          <h2
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--muted)",
              margin: "0 0 12px",
            }}
          >
            Los tres corpora
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {ASSET_ROADMAP.assets.map((asset) => (
              <div
                key={asset.id}
                style={{
                  background: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 10,
                  padding: "16px 18px",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: ACCENT,
                      background: ACCENT_SOFT,
                      padding: "2px 7px",
                      borderRadius: 5,
                      letterSpacing: "0.05em",
                    }}
                  >
                    ASSET {asset.id}
                  </span>
                  <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "var(--foreground)" }}>
                    {asset.title}
                  </h3>
                </div>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 10px", lineHeight: 1.5 }}>
                  {asset.description}
                </p>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    opacity: 0.8,
                    paddingTop: 8,
                    borderTop: `1px solid ${CARD_BORDER}`,
                  }}
                >
                  <span style={{ fontWeight: 600, color: "var(--foreground)", opacity: 0.85 }}>Compradores:</span>{" "}
                  {asset.buyers}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Wedge + Why now */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 10,
              padding: "14px 18px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6, letterSpacing: "0.05em" }}>
              CUÑA INICIAL
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.55 }}>
              {ASSET_ROADMAP.wedge}
            </p>
          </div>
          <div
            style={{
              background: CARD_BG,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 10,
              padding: "14px 18px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 6, letterSpacing: "0.05em" }}>
              POR QUÉ AHORA
            </div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.55 }}>
              {ASSET_ROADMAP.whyNow}
            </p>
          </div>
        </section>

        {/* Movidas */}
        <section>
          <h2
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--muted)",
              margin: "8px 0 12px",
            }}
          >
            Movidas
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {ASSET_ROADMAP.movidas.map((movida) => (
              <MovidaCard key={movida.id} movida={movida} />
            ))}
          </div>
        </section>

        {/* Bitácora — chronological log of every block of work, most recent first. */}
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              margin: "8px 0 12px",
            }}
          >
            <h2
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--muted)",
                margin: 0,
              }}
            >
              Bitácora
            </h2>
            <span style={{ fontSize: 11, color: "var(--muted)", opacity: 0.7 }}>
              {ASSET_ROADMAP.workLog.length} entradas, más reciente arriba
            </span>
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--muted)",
              opacity: 0.8,
              margin: "0 0 14px",
              lineHeight: 1.55,
            }}
          >
            Cada bloque de trabajo queda acá en lenguaje claro. Editado en{" "}
            <code style={{ fontFamily: "ui-monospace, monospace" }}>src/lib/assetRoadmap.ts</code>
            {" "}cuando avanza algo nuevo, aparece automáticamente al rebuildar.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ASSET_ROADMAP.workLog.map((entry, i) => (
              <WorkLogCard key={`${entry.date}-${i}`} entry={entry} />
            ))}
          </div>
        </section>
      </div>
    </StudioShell>
  );
}
