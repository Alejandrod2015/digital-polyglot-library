/** Busca, tras el retitulado: (a) trozos de contexto c.es que ya no son
 *  subcadena de titulo+cuerpo de su historia; (b) claves de glosa que ya no
 *  aparecen en ningun titulo+cuerpo del bundle (solo vivian en un titulo viejo). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-latam-b2";
const norm = (s: string) => s.toLowerCase().normalize("NFC");
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  const historias = await p.journeyStory.findMany({
    where: { journeyId: "cmtpls1l20007j8epwgcs6e1h" },
    select: { slug: true, title: true, text: true },
  });
  const porSlug = new Map(historias.map((h) => [h.slug, norm(h.title + "\n" + h.text)]));
  const todo = historias.map((h) => norm(h.title + "\n" + h.text)).join("\n");
  const palabras = new Set(todo.match(/[a-záéíóúñü]+/g) ?? []);
  let a = 0, b = 0;
  for (const f of filas) {
    const g = (f.glosses ?? {}) as Record<string, { c?: { es?: string } }>;
    const texto = f.slug ? porSlug.get(f.slug) : todo;
    if (f.slug && !texto) { console.log(`FILA SIN HISTORIA: ${f.slug}`); continue; }
    for (const [k, v] of Object.entries(g)) {
      if (v?.c?.es && texto && !texto.includes(norm(v.c.es))) {
        console.log(`(a) trozo huérfano en ${f.slug || "GLOBAL"} · ${k}: "${v.c.es}"`); a++;
      }
      const kn = norm(k);
      const presente = kn.includes(" ") ? todo.includes(kn) : palabras.has(kn);
      if (!presente) { console.log(`(b) clave sin texto en ${f.slug || "GLOBAL"} · "${k}"`); b++; }
    }
  }
  console.log(`huérfanos: ${a} trozo(s), ${b} clave(s)`);
  await p.$disconnect();
})();
