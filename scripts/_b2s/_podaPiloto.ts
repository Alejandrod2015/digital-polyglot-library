/** Poda de la capa de las 3 historias del piloto: fuera lo que solo vivia en el texto viejo.
 *  Se QUEDA toda clave que sea (a) palabra tocable del titulo+cuerpo nuevo, (b) lema o forma de una
 *  plaza de vocab de esa historia (el limpiador de e46c2a95 rompio 90 plazas por no mirar esto),
 *  o (c) clave escrita hoy en su capa. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { readFileSync } from "fs";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
(async () => {
  for (const slug of ["el-cafe-lo-pones-tu", "la-bolsa-como-prueba", "la-sobremesa-se-estira"]) {
    const h = await p.journeyStory.findFirst({ where: { slug, journeyId: "cmtplpfum0007j8c6piegwt31" }, select: { title: true, text: true, vocab: true } });
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = { ...(fila!.glosses as Record<string, unknown>) };
    const tokens = new Set((`${h!.title} ${h!.text}`.match(/\p{L}[\p{L}\p{M}'-]*/gu) ?? []).map((w) => w.toLowerCase()));
    const vocab = new Set(((h!.vocab as any[]) ?? []).flatMap((v) => [String(v.word).toLowerCase(), String(v.surface ?? "").toLowerCase()]).filter(Boolean));
    const capa = new Set(Object.keys(JSON.parse(readFileSync(`scripts/_b2s/piloto/capa-${slug}.json`, "utf8"))));
    const fuera = Object.keys(g).filter((k) => !tokens.has(k) && !vocab.has(k) && !capa.has(k));
    for (const k of fuera) delete g[k];
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g as any } });
    console.log(`${slug}: ${Object.keys(g).length} quedan · podadas ${fuera.length}: ${fuera.join(", ")}`);
  }
  await p.$disconnect();
})();
