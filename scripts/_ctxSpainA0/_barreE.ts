/** ¿"e" pegada a historias que no la contienen sale en más bundles?
 *
 *  En spanish-friends-spain-a0 aparecía en trece historias de veintiuna, y eso
 *  no es un descuido suelto. Esto lo mide en TODOS los bundles, y de paso
 *  cuenta las demás huérfanas, con la frontera de letra ya arreglada. Solo
 *  lee; no borra nada. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const p = new PrismaClient();
const TOCABLE = /\p{L}[\p{L}\p{M}'-]*/gu;

const saleLiteral = (texto: string, clave: string) =>
  new RegExp(`(?<![\\p{L}\\p{M}])${clave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{M}])`, "u").test(texto);

(async () => {
  const filas = await p.tapGlossSet.findMany({ select: { bundle: true, slug: true, glosses: true } });
  const hs = await p.journeyStory.findMany({ select: { slug: true, title: true, text: true } });
  const texto = new Map(hs.map((h) => [h.slug, `${h.title}. ${h.text}`.toLowerCase()]));

  const porBundle = new Map<string, { total: number; conteo: Map<string, number> }>();
  for (const f of filas) {
    if (!f.slug) continue;
    const t = texto.get(f.slug);
    if (!t) continue;
    const enTexto = new Set([...t.matchAll(TOCABLE)].map((m) => m[0]));
    for (const w of Object.keys(f.glosses as object)) {
      if (enTexto.has(w) || saleLiteral(t, w)) continue;
      const b = porBundle.get(f.bundle) ?? { total: 0, conteo: new Map() };
      b.total++; b.conteo.set(w, (b.conteo.get(w) ?? 0) + 1);
      porBundle.set(f.bundle, b);
    }
  }

  let total = 0;
  const orden = [...porBundle.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [bundle, b] of orden) {
    total += b.total;
    const top = [...b.conteo.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6)
      .map(([w, n]) => `${w} x${n}`).join(", ");
    console.log(`${String(b.total).padStart(4)}  ${bundle}\n      ${top}`);
  }
  console.log(`\nhuerfanas en el catalogo: ${total} en ${porBundle.size} bundles`);
  await p.$disconnect();
})();
