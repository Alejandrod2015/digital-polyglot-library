/** Acorta trozos de contexto largos. Escribe SOLO la palabra nombrada, y solo
 *  si su trozo actual pasa del tope: no toca lo que ya estaba bien. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const TOPE = 8;
(async () => {
  const [bundle, fichero] = process.argv.slice(2);
  // Dos formas: {palabra: trozo} para todo el bundle, o {slug: {palabra: trozo}}
  // cuando la misma palabra necesita un trozo distinto en cada historia.
  const crudo = JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, unknown>;
  const porSlug = Object.values(crudo).every((v) => v && typeof v === "object" && !("es" in (v as object)));
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle, NOT: { slug: "" } } });
  let n = 0, saltadas = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    let toco = false;
    const nuevos = (porSlug ? (crudo[f.slug] ?? {}) : crudo) as Record<string, { es: string; en: string }>;
    for (const [w, c] of Object.entries(nuevos)) {
      const e = g[w];
      if (!e?.c || String(e.c.es).trim().split(/\s+/).length <= TOPE) continue;
      if (String(c.es).trim().split(/\s+/).length > TOPE) { saltadas++; continue; }
      e.c = { es: c.es, en: c.en }; n++; toco = true;
    }
    if (toco) await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: f.slug } }, data: { glosses: g } });
  }
  console.log(`${bundle}: ${n} trozos acortados${saltadas ? ` · ${saltadas} rechazados por seguir pasando del tope` : ""}`);
  await p.$disconnect();
})();
