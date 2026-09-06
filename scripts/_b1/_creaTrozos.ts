/** Crea entradas de capa que el vocab necesita y que no existen: la clave es
 *  el lema o la expresion, la glosa sale del mapa global o del propio vocab, y
 *  la frase se escribe a mano. Comprueba que el trozo salga tal cual del texto. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "node:fs";
const N = (t: string) => t.normalize("NFC").toLowerCase().replace(/[“”"«»().,;:¡!¿?]/g, "").replace(/\s+/g, " ").trim();
(async () => {
  const p = new PrismaClient();
  const B = "spanish-traveler-spain-b1";
  const datos: Record<string, Record<string, { es: string; en: string }>> = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  const global = filas.find((f) => f.slug === "")!.glosses as Record<string, any>;
  const hs = await p.journeyStory.findMany({ where: { slug: { in: Object.keys(datos) } }, select: { slug: true, title: true, text: true, vocab: true } });
  let n = 0, mal = 0;
  for (const h of hs) {
    const fila = filas.find((f) => f.slug === h.slug); if (!fila) continue;
    const g = fila.glosses as Record<string, any>;
    const cuerpo = N(`${h.title}. ${h.text}`);
    const voc = new Map(((h.vocab ?? []) as any[]).map((v) => [String(v.word).toLowerCase(), v]));
    for (const [w, c] of Object.entries(datos[h.slug!] ?? {})) {
      if (!cuerpo.includes(N(c.es))) { console.log(`  NO SALE ${h.slug}·${w}: "${c.es}"`); mal++; continue; }
      const v = voc.get(w.toLowerCase());
      const base = global[w] ?? {};
      g[w] = {
        g: base.g ?? (v?.definition ? String(v.definition).split(";")[0] : w),
        t: base.t ?? v?.type ?? "expression",
        ...(base.f ? { f: base.f } : {}),
        c: { es: c.es, en: c.en },
        rev: true,
      };
      n++;
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: h.slug! } }, data: { glosses: g } });
  }
  console.log(`entradas creadas ${n}${mal ? ` · rechazadas ${mal}` : ""}`);
  await p.$disconnect();
})();
