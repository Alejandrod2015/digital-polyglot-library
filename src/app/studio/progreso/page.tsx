import StudioShell from "@/components/studio/StudioShell";
import { requireStudioUser } from "@/lib/requireStudioUser";
import {
  ASSET_ROADMAP,
  movidaProgress,
  pieceWeight,
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
const TEXT_MUTED = "var(--muted)";

function colorForProgress(pct: number): string {
  if (pct >= 100) return "#10b981";
  if (pct >= 50) return ACCENT;
  if (pct > 0) return "#f59e0b";
  return "#475569";
}

function ProgressBar({ value, height = 8 }: { value: number; height?: number }) {
  const pct = Math.round(value * 100);
  const color = colorForProgress(pct);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
      <div
        style={{
          flex: 1,
          height,
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
          fontSize: 13,
          fontWeight: 700,
          color,
          minWidth: 42,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {pct}%
      </span>
    </div>
  );
}

function StatusDot({ piece }: { piece: RoadmapPiece }) {
  const { fg } = statusColor(piece.status);
  return (
    <span
      title={statusLabel(piece.status)}
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: 999,
        background: fg,
        flexShrink: 0,
      }}
    />
  );
}

function MovidaCard({ movida }: { movida: Movida }) {
  const progress = movidaProgress(movida);
  const deployedCount = movida.pieces.filter((p) => p.status === "deployed").length;
  const totalCount = movida.pieces.length;

  return (
    <details
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 12,
        padding: "14px 18px",
      }}
    >
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: ACCENT,
              background: ACCENT_SOFT,
              padding: "2px 7px",
              borderRadius: 5,
            }}
          >
            MOVIDA {movida.id}
          </span>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "var(--foreground)", flex: 1 }}>
            {movida.title}
          </h3>
          <span style={{ fontSize: 12, color: TEXT_MUTED, fontVariantNumeric: "tabular-nums" }}>
            {deployedCount}/{totalCount}
          </span>
        </div>
        <ProgressBar value={progress} />
      </summary>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {movida.pieces.map((piece, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              paddingTop: i === 0 ? 0 : 10,
              borderTop: i === 0 ? "none" : `1px solid ${CARD_BORDER}`,
            }}
          >
            <span style={{ marginTop: 5 }}>
              <StatusDot piece={piece} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.4 }}>
                {piece.title}
              </div>
              {piece.note && (
                <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 3, lineHeight: 1.5, opacity: 0.85 }}>
                  {piece.note}
                </div>
              )}
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: statusColor(piece.status).fg,
                background: statusColor(piece.status).bg,
                padding: "2px 8px",
                borderRadius: 4,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {statusLabel(piece.status)}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

function WorkLogRow({ entry }: { entry: WorkLogEntry }) {
  return (
    <details
      style={{
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 8,
        padding: "10px 14px",
      }}
    >
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontFamily: "ui-monospace, monospace",
            color: TEXT_MUTED,
            opacity: 0.7,
            minWidth: 80,
          }}
        >
          {entry.date}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: ACCENT,
            background: ACCENT_SOFT,
            padding: "2px 6px",
            borderRadius: 4,
            whiteSpace: "nowrap",
          }}
        >
          {entry.scope}
        </span>
        <span style={{ fontSize: 13, color: "var(--foreground)", flex: 1, minWidth: 0 }}>
          {entry.title}
        </span>
      </summary>
      <div style={{ marginTop: 8, paddingLeft: 92 }}>
        <p style={{ fontSize: 12, color: TEXT_MUTED, margin: "0 0 6px", lineHeight: 1.55 }}>
          {entry.summary}
        </p>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: TEXT_MUTED, lineHeight: 1.6, opacity: 0.85 }}>
          {entry.highlights.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export default async function StudioProgresoPage() {
  await requireStudioUser("/studio/progreso");

  const overall =
    ASSET_ROADMAP.movidas.reduce((sum, m) => sum + movidaProgress(m), 0) /
    Math.max(ASSET_ROADMAP.movidas.length, 1);
  const totalPieces = ASSET_ROADMAP.movidas.reduce((sum, m) => sum + m.pieces.length, 0);
  const deployedPieces = ASSET_ROADMAP.movidas.reduce(
    (sum, m) => sum + m.pieces.filter((p) => p.status === "deployed").length,
    0
  );

  return (
    <StudioShell
      title="Progreso del proyecto"
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Progreso" }]}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Top: global progress */}
        <section
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 12,
            padding: "18px 22px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: colorForProgress(Math.round(overall * 100)),
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                {Math.round(overall * 100)}%
              </span>
              <span style={{ fontSize: 13, color: TEXT_MUTED }}>
                {deployedPieces} de {totalPieces} piezas en producción
              </span>
            </div>
            <span style={{ fontSize: 11, color: TEXT_MUTED, opacity: 0.7 }}>
              Última actualización · {ASSET_ROADMAP.lastUpdated}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ASSET_ROADMAP.movidas.map((m) => {
              const pct = Math.round(movidaProgress(m) * 100);
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: TEXT_MUTED, minWidth: 70, opacity: 0.7 }}>
                    Movida {m.id}
                  </span>
                  <div style={{ flex: 1 }}>
                    <ProgressBar value={movidaProgress(m)} height={6} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Movidas (each expandable) */}
        <section>
          <h2
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: TEXT_MUTED,
              margin: "0 0 10px",
            }}
          >
            Movidas
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ASSET_ROADMAP.movidas.map((movida) => (
              <MovidaCard key={movida.id} movida={movida} />
            ))}
          </div>
        </section>

        {/* Bitácora (each row expandable) */}
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              margin: "0 0 10px",
            }}
          >
            <h2
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: TEXT_MUTED,
                margin: 0,
              }}
            >
              Bitácora
            </h2>
            <span style={{ fontSize: 11, color: TEXT_MUTED, opacity: 0.7 }}>
              {ASSET_ROADMAP.workLog.length} entradas
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ASSET_ROADMAP.workLog.map((entry, i) => (
              <WorkLogRow key={`${entry.date}-${i}`} entry={entry} />
            ))}
          </div>
        </section>

        {/* Contexto (collapsed by default) */}
        <details
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 12,
            padding: "12px 18px",
          }}
        >
          <summary
            style={{
              listStyle: "none",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: TEXT_MUTED,
            }}
          >
            Contexto estratégico ▾
          </summary>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 4px", color: "var(--foreground)" }}>
                {ASSET_ROADMAP.thesisHeadline}
              </h3>
              <p style={{ fontSize: 12, color: TEXT_MUTED, margin: 0, lineHeight: 1.55 }}>
                {ASSET_ROADMAP.thesisSummary}
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 8,
              }}
            >
              {ASSET_ROADMAP.assets.map((asset) => (
                <div
                  key={asset.id}
                  style={{
                    background: "rgba(255, 255, 255, 0.02)",
                    border: `1px solid ${CARD_BORDER}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: ACCENT,
                        background: ACCENT_SOFT,
                        padding: "1px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {asset.id}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>
                      {asset.title}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: TEXT_MUTED, margin: 0, lineHeight: 1.45 }}>
                    {asset.description}
                  </p>
                  <p style={{ fontSize: 10, color: TEXT_MUTED, margin: "6px 0 0", opacity: 0.7 }}>
                    {asset.buyers}
                  </p>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
              <div style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.55 }}>
                <strong style={{ color: ACCENT, fontSize: 10, letterSpacing: "0.05em" }}>CUÑA · </strong>
                {ASSET_ROADMAP.wedge}
              </div>
              <div style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.55 }}>
                <strong style={{ color: ACCENT, fontSize: 10, letterSpacing: "0.05em" }}>POR QUÉ AHORA · </strong>
                {ASSET_ROADMAP.whyNow}
              </div>
            </div>
          </div>
        </details>
      </div>
    </StudioShell>
  );
}
