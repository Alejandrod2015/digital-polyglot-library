// Sirve los glosses "quick lookup" del piloto tap-any-word a la app mobile.
// En el reader WEB los glosses se leen por SSR (`getTapGlossesForSlug`, que
// consulta la tabla dp_tap_glosses_v1); la
// app no tiene ese acceso directo, así que los pide por HTTP al abrir una
// historia (por slug). Devuelve `{ glosses: {} }` cuando el journey de esa
// historia todavía no tiene bundle, para que el reader degrade a solo
// story-vocab (las pills curadas) sin romperse.
//
// Los glosses son palabra -> { g: gloss EN, t: tipo gramatical, r?: register,
// c?: trozo traducido, gm?: marca de genero, f?: formas y modo }. Se devuelve
// el mapa ENTERO tal como sale de la base: recortar campos aqui, o declararlos
// cortos en el lector de RN, es lo que dejo la capa de contexto fuera de las
// apps en agosto de 2026.
// la key es la palabra en minúsculas sin puntuación (mismo `tokenFromText`
// que usa TapGlossLayer en web), para que el reader mobile normalice cada
// token de la misma forma y matchee.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { getActiveMobileSession } from "@/lib/mobileSession";
import { getTapGlossesForSlug } from "@/lib/tapGlosses";

export async function GET(req: NextRequest): Promise<Response> {
  const session = await getActiveMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "slug query param required" }, { status: 400 });
  }

  const glosses = await getTapGlossesForSlug(slug);
  return NextResponse.json({ slug, glosses: glosses ?? {} });
}
