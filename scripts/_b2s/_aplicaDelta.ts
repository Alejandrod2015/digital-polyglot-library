/** Trozos de las claves de LEMA del delta + poda: se queda lo tocable del texto nuevo y toda clave del vocab. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { readFileSync } from "fs";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
(async () => {
  const lemas = JSON.parse(readFileSync("scripts/_b2s/piloto/delta-lemas.json", "utf8")) as Record<string, Record<string, { es: string; en: string }>>;
  for (const slug of ["el-cafe-lo-pones-tu", "la-bolsa-como-prueba", "la-sobremesa-se-estira"]) {
    const h = await p.journeyStory.findFirst({ where: { slug, journeyId: "cmtplpfum0007j8c6piegwt31" }, select: { title: true, text: true, vocab: true } });
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = { ...(fila!.glosses as Record<string, any>) };
    for (const [k, c] of Object.entries(lemas[slug] ?? {})) { if (!g[k]) throw new Error(`${slug}/${k}: la clave de lema no existe`); g[k] = { ...g[k], c }; }
    const tokens = new Set((`${h!.title} ${h!.text}`.match(/\p{L}[\p{L}\p{M}'-]*/gu) ?? []).map((w) => w.toLowerCase()));
    const vocab = new Set(((h!.vocab as any[]) ?? []).flatMap((v) => [String(v.word).toLowerCase(), String(v.surface ?? "").toLowerCase()]).filter(Boolean));
    const fuera = Object.keys(g).filter((k) => !tokens.has(k) && !vocab.has(k));
    for (const k of fuera) delete g[k];
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
    console.log(`${slug}: lemas ${Object.keys(lemas[slug] ?? {}).join(", ")} · podadas ${fuera.length}: ${fuera.join(", ")}`);
  }
  await p.$disconnect();
})();
