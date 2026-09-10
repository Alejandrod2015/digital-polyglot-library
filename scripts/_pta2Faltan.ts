/** Que trozos le faltan a cada fichero de traduccion tras apretar el
 *  troceador. Solo lee; no escribe nada. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { trozosDe } from "./_pta2Trozos";

const B = "portuguese-traveler-brazil-a2";
const TOCABLE = /\p{L}[\p{L}\p{M}'-]*/gu;
const DIR = "scripts/_pta2ctx";
const p = new PrismaClient();

(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, slugs: true, glosses: true } });
  const global = (filas.find((f) => !f.slug)?.glosses ?? {}) as Record<string, unknown>;
  const slugs = (filas.find((f) => !f.slug)?.slugs ?? []) as string[];
  const historias = await p.journeyStory.findMany({
    where: { slug: { in: slugs } }, select: { slug: true, title: true, text: true },
  });
  let total = 0;
  for (const h of historias) {
    const fichero = `${DIR}/${h.slug}.json`;
    if (!fs.existsSync(fichero)) { console.log(`${h.slug}: SIN FICHERO`); continue; }
    const EN = JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, string>;
    const vistas = new Set<string>();
    const faltan: string[] = [];
    for (const t of trozosDe(`${h.title}. ${h.text}`)) {
      const dentro = [...new Set((t.toLowerCase().match(TOCABLE) ?? []))]
        .filter((w) => global[w] && !vistas.has(w));
      if (!dentro.length) continue;
      if (EN[t]) { dentro.forEach((w) => vistas.add(w)); continue; }
      faltan.push(t);
    }
    if (!faltan.length) continue;
    total += faltan.length;
    console.log(`\n── ${h.slug}`);
    for (const t of faltan) console.log(`  "${t}": "",`);
  }
  console.log(`\nTOTAL trozos por traducir: ${total}`);
  await p.$disconnect();
})();
