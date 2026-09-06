import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  // Corpus: todas las palabras que aparecen en alguna historia de espanol.
  const js = await p.journey.findMany({ where: { language: { equals: "spanish", mode: "insensitive" } }, select: { id: true } });
  const rows = await p.journeyStory.findMany({ where: { journeyId: { in: js.map((x) => x.id) } }, select: { text: true } });
  const corpus = new Set<string>();
  for (const r of rows) for (const w of (String(r.text ?? "").toLowerCase().match(/[\p{L}]+/gu) ?? [])) corpus.add(w);
  const filas = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" }, bundle: { startsWith: "spanish-" } }, select: { bundle: true, slug: true, glosses: true } });
  const malas: string[] = [];
  for (const f of filas) for (const [w, e] of Object.entries(f.glosses as Record<string, any>)) {
    for (const fila of (e.f?.head ?? [])) {
      const forma = String(fila[1] ?? "");
      for (const t of forma.toLowerCase().split(/\s+/)) if (t.length > 3 && !corpus.has(t)) malas.push(`${f.bundle}/${f.slug} ${w}: "${forma}" (${t})`);
    }
  }
  console.log(`formas de cabecera que no existen en ningun cuerpo: ${malas.length}`);
  for (const m of malas.slice(0, 20)) console.log("  ", m);
  await p.$disconnect();
})();
