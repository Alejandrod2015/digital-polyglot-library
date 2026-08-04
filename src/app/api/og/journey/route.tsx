// Imagen social de un journey, renderizada al vuelo con next/og.
//
// No es una imagen generada por IA ni gasta créditos: es HTML pintado a PNG por
// el runtime. Existe porque el enlace de un journey ya funcionaba (la URL con
// ?variant= renderiza el journey entero a cualquiera) pero al pegarlo en una
// red social se veía sin imagen y con el mismo título genérico para todos.
//
// La ruta vive fuera de la convención de archivo `opengraph-image` a propósito:
// esa convención solo recibe `params`, y aquí el journey viaja en la query.

import { ImageResponse } from "next/og";
import { getJourneyShareMeta } from "@/app/journey/journeyMeta";

export const runtime = "nodejs";

const BG = "#0b1c33";
const INK = "#f4f8ff";
const MUTED = "#9cb0c9";
const ACCENT = "#f8c15c";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const meta = await getJourneyShareMeta(searchParams.get("variant") ?? undefined);

  const heading = meta?.name ?? "Journey";
  const subtitle = meta
    ? [meta.language, meta.level].filter(Boolean).join(" ")
    : "Digital Polyglot";
  const place = meta?.variantLabel ?? "";
  const counts = meta
    ? `${meta.topicCount} topics · ${meta.storyCount} stories`
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: ACCENT,
            }}
          >
            {subtitle}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: heading.length > 22 ? 84 : 104,
              fontWeight: 800,
              color: INK,
              lineHeight: 1.05,
            }}
          >
            {heading}
          </div>
          {place ? (
            <div style={{ display: "flex", fontSize: 38, color: MUTED }}>{place}</div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 30,
            color: MUTED,
          }}
        >
          <div style={{ display: "flex" }}>{counts}</div>
          <div style={{ display: "flex", color: INK, fontWeight: 700 }}>
            Digital Polyglot
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
