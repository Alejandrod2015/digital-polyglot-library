/** Que lemas estan libres para el A2 latam, y como reparte un candidato sus
 *  pastillas por BLOQUE RENDERIZADO (que es lo que mira el validador). */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { renderedParagraphs } from "../src/lib/readerParagraphs";
import * as fs from "fs";
const J = "cmtgelq560007j84n3ujx9bpd";
const p = new PrismaClient();
const PORT = new Set(["verb","adjective","adverb","expression"]);

(async () => {
  const cand = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[];
  const enTanda = new Set(cand.map((s) => `${s.topic}#${s.slotIndex}`));
  const mio = await p.journey.findUnique({ where: { id: J }, select: { language: true, typeSlug: true } });

  const duro = new Set<string>(); const blando = new Set<string>();
  const otras = await p.journeyStory.findMany({
    where: { journey: { language: mio!.language, status: { not: "archived" } }, journeyId: { not: J } },
    select: { vocab: true, journey: { select: { typeSlug: true, levels: true } } },
  });
  for (const r of otras) for (const v of ((r.vocab as any[]) ?? [])) {
    if (!v?.word) continue;
    if (PORT.has(String(v.type ?? "").toLowerCase())) continue;
    const mismoTipo = r.journey?.typeSlug === mio!.typeSlug;
    const mismoNivel = (r.journey?.levels ?? []).some((l: any) => String(l).toLowerCase() === "a2");
    if (mismoTipo && !mismoNivel) continue;
    (mismoTipo ? duro : blando).add(String(v.word));
  }
  const propias = await p.journeyStory.findMany({ where: { journeyId: J }, select: { topic: true, slotIndex: true, slug: true, vocab: true } });
  const quienEnsena = new Map<string, string>();
  for (const r of propias) {
    if (enTanda.has(`${r.topic}#${r.slotIndex}`)) continue;
    for (const v of ((r.vocab as any[]) ?? [])) if (v?.word) { duro.add(String(v.word)); quienEnsena.set(String(v.word), r.slug || ""); }
  }

  for (const s of cand) {
    const bloques = renderedParagraphs(s.text);
    const cuenta = bloques.map((b: string) => s.vocab.filter((v: any) => b.includes(v.surface)).length);
    const choque = s.vocab.filter((v: any) => duro.has(v.word)).map((v: any) => `${v.word}(${quienEnsena.get(v.word) ?? "otro journey"})`);
    const fuera = s.vocab.filter((v: any) => blando.has(v.word)).map((v: any) => v.word);
    console.log(`\n${s.slotIndex} ${s.title} · ${s.text.split(/\s+/).length} pal · ${bloques.length} bloques`);
    console.log(`  pastillas/bloque: [${cuenta.join(", ")}]  tope ${Math.floor(0.3*s.vocab.length)}  vacios: ${cuenta.filter((c:number)=>c===0).length}`);
    if (choque.length) console.log(`  DURO (tope 0): ${choque.join(", ")}`);
    if (fuera.length) console.log(`  blando (tope 2): ${fuera.join(", ")}`);
  }
  await p.$disconnect();
})();
