/** Sube a la fila global la glosa CORREGIDA en la capa cuando todas las
 *  historias donde cae la palabra coinciden en el mismo sentido. La global es
 *  lo que ve VocabPanel y el repaso, no solo el lector. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const bundle = process.argv[2]; const escribir = process.argv.includes("--fix");
  const filas = await p.tapGlossSet.findMany({ where: { bundle } });
  const global = filas.find((f) => f.slug === "")!;
  const g = global.glosses as Record<string, any>;
  const porPalabra = new Map<string, Set<string>>();
  const tipos = new Map<string, Set<string>>();
  for (const f of filas.filter((f) => f.slug !== "")) {
    for (const [w, e] of Object.entries(f.glosses as Record<string, any>)) {
      if (!porPalabra.has(w)) { porPalabra.set(w, new Set()); tipos.set(w, new Set()); }
      porPalabra.get(w)!.add(e.g); tipos.get(w)!.add(e.t);
    }
  }
  let n = 0;
  for (const [w, sentidos] of porPalabra) {
    if (sentidos.size !== 1) continue;
    const nuevo = [...sentidos][0]; const t = [...tipos.get(w)!][0];
    if (!g[w] || g[w].g === nuevo) continue;
    console.log(`${w}: "${g[w].g}" -> "${nuevo}"`);
    g[w].g = nuevo; if (tipos.get(w)!.size === 1) g[w].t = t;
    n++;
  }
  console.log(`\n${n} glosas globales corregidas desde la capa`);
  if (escribir) {
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: "" } }, data: { glosses: g as never } });
    console.log("escrito");
  }
  await p.$disconnect();
})();
