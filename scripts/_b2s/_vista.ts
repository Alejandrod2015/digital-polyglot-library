/** Vista de decision: plazas A1/A2 que pueden salir, y candidatas del cuerpo por encima de A1/A2
 *  clasificadas: [L]=ya en lista del nivel, [C]=hueco de lexico corriente, [X]=el juez la manda a C2. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
import { esHuecoDelLexico } from "../../src/lib/cefr/spanishLexiconGaps";
const p = new PrismaClient();
const de = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const JID = process.argv[2], NIVEL = process.argv[3] as "b1" | "b2";
(async () => {
  const j = await p.journey.findUnique({ where: { id: JID }, select: { typeSlug: true } });
  const mismos = new Set((await p.journey.findMany({ where: { language: "spanish", typeSlug: j!.typeSlug }, select: { id: true } })).map((x) => x.id));
  const tipo = new Set<string>(), todo = new Set<string>();
  for (const o of await p.journey.findMany({ where: { language: "spanish" }, select: { id: true } }))
    for (const s of await p.journeyStory.findMany({ where: { journeyId: o.id }, select: { vocab: true } }))
      for (const v of ((s.vocab as any[]) ?? [])) { todo.add(de(String(v.word))); if (mismos.has(o.id) && o.id !== JID) tipo.add(de(String(v.word))); }
  const st = await p.journeyStory.findMany({ where: { journeyId: JID }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { slug: true, topic: true, slotIndex: true, text: true, title: true, vocab: true } });
  const ya = new Set<string>();
  for (const s of st) for (const v of ((s.vocab as any[]) ?? [])) { ya.add(de(String(v.word))); ya.add(de(String(v.surface ?? ""))); }
  for (const s of st) {
    const v = (s.vocab as any[]) ?? [];
    const bajas = v.filter((x) => isSpanishUpToLevel(String(x.word), "a2"));
    const toks = [...new Set(de(`${s.title} ${s.text}`).match(/[a-z]{4,}/g) ?? [])];
    const cand = toks.filter((w) => !isSpanishUpToLevel(w, "a2") && !ya.has(w) && !tipo.has(w))
      .map((w) => `${w}${isSpanishUpToLevel(w, NIVEL) ? "[L]" : esHuecoDelLexico(w) ? "[C]" : "[X]"}${todo.has(w) ? "*" : ""}`);
    console.log(`\n## ${s.slug} · faltan_altas=${bajas.length}`);
    console.log(`   SALEN: ${bajas.map((x) => x.word).join(", ")}`);
    console.log(`   ENTRAN: ${cand.join(" ")}`);
  }
  await p.$disconnect();
})();
