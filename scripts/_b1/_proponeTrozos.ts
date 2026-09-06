/** Para cada trozo que no sale tal cual del texto, propone el minimo literal:
 *  una ventana de la propia oracion que contiene la palabra, de 5 palabras o
 *  menos. El ingles no se inventa: se deja vacio para escribirlo a mano. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "node:fs";
const N = (t: string) => t.normalize("NFC").toLowerCase().replace(/[“”"«»().,;:¡!¿?]/g, "").replace(/\s+/g, " ").trim();
(async () => {
  const p = new PrismaClient();
  const B = "spanish-traveler-spain-b1";
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  const g = filas.find((f) => f.slug === "")!;
  const ss = await p.journeyStory.findMany({ where: { slug: { in: g.slugs } }, select: { slug: true, title: true, text: true } });
  const texto = new Map(ss.map((s) => [s.slug!, `${s.title}. ${s.text}`]));
  const out: Record<string, Record<string, { antes: string; propuesta: string; en: string }>> = {};
  let n = 0;
  for (const f of filas) {
    if (!f.slug) continue;
    const crudas = (texto.get(f.slug) ?? "").split(/(?<=[.?!”])\s+/);
    for (const [w, v] of Object.entries(f.glosses as Record<string, any>)) {
      const c = v?.c; if (!c?.es) continue;
      if (crudas.some((o) => N(o).includes(N(c.es)))) continue;
      // la oracion donde de verdad sale la palabra
      const ora = crudas.find((o) => N(o).includes(N(w))) ?? crudas[0] ?? "";
      const pal = N(ora).split(" ");
      const i = pal.findIndex((x) => x === N(w) || x.startsWith(N(w)));
      if (i < 0) continue;
      // POR CLAUSULA, no por ventana. Una ventana de dos palabras a cada lado
      // corta por donde no hay junta ("del tercero ha vuelto a"), que es
      // exactamente lo que la regla prohibe. La clausula entre comas o comillas
      // si es un constituyente; si pasa de 5 se recorta desde la palabra hasta
      // el borde mas cercano.
      const clausulas = ora.split(/[,:;“”]/).map((x) => N(x)).filter(Boolean);
      const cl = clausulas.find((x) => x.split(" ").some((y) => y === N(w) || y.startsWith(N(w)))) ?? "";
      let propuesta = cl;
      if (cl.split(" ").length > 5) {
        const t = cl.split(" ");
        const j = t.findIndex((x) => x === N(w) || x.startsWith(N(w)));
        const a = Math.max(0, Math.min(j - 2, t.length - 5));
        propuesta = t.slice(a, a + 5).join(" ");
      }
      if (!propuesta) continue;
      (out[f.slug] ??= {})[w] = { antes: c.es, propuesta, en: "" };
      n++;
    }
  }
  fs.writeFileSync("scripts/_b1/_trozos-propuestos.json", JSON.stringify(out, null, 1));
  const distintas = new Set(Object.values(out).flatMap((o) => Object.values(o).map((x) => x.propuesta)));
  console.log(`entradas a rehacer ${n} · propuestas distintas ${distintas.size}`);
  await p.$disconnect();
})();
