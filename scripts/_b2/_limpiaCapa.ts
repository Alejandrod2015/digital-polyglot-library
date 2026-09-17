/** Tras reescribir un tema (pasar a pasado, 2026-09-10): borra de la fila de glosas
 *  de cada historia las claves de CONTEXTO cuyo trozo ya no esta en el cuerpo ni en
 *  el titulo. Son las superficies viejas ("presume", "truena"): se quedaban en la
 *  fila con su frase antigua y el lector ofrecia una traduccion de algo que ya no
 *  se lee. Solo toca claves con `c`; las glosas de toque sin contexto no se miran.
 *    npx tsx scripts/_b2/_limpiaCapa.ts <slug> [<slug> ...] [--dry] */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const B = "spanish-traveler-latam-b2";
const norm = (x: string) => x.toLowerCase().replace(/[“”"]/g, "").replace(/\s+/g, " ").trim();

(async () => {
  const p = new PrismaClient();
  const dry = process.argv.includes("--dry");
  const slugs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  for (const slug of slugs) {
    const h = await p.journeyStory.findFirst({ where: { slug, journeyId: "cmtpls1l20007j8epwgcs6e1h" }, select: { title: true, text: true } });
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    if (!h || !fila) { console.log(`${slug}: sin historia o sin fila`); continue; }
    const cuerpo = norm(`${h.title}\n${h.text}`);
    const g = { ...(fila.glosses as Record<string, { c?: { es?: string } }>) };
    const fuera = Object.entries(g).filter(([, v]) => v?.c?.es && !cuerpo.includes(norm(v.c.es))).map(([k]) => k);
    console.log(`${slug}: ${fuera.length} clave(s) con trozo muerto${fuera.length ? `: ${fuera.join(", ")}` : ""}`);
    if (!dry && fuera.length) {
      for (const k of fuera) delete g[k];
      await p.tapGlossSet.update({ where: { id: fila.id }, data: { glosses: g as never } });
    }
  }
  await p.$disconnect();
})();
