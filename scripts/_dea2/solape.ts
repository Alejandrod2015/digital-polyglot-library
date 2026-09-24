/** Solape de vocab entre el Friends DE A2 y los Friends DE A0/A1 publicados.
 *  El cero se exige al vocab ANCLADO; la capa portable (verbo, adjetivo,
 *  adverbio, expresion) se reabre entre niveles del mismo tipo. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const norm = (s: string) => s.toLowerCase().replace(/^(der|die|das)\s+/, "").trim();
const PORTABLE = new Set(["verb", "adjective", "adverb", "expression"]);
(async () => {
  const js = await p.journey.findMany({ where: { language: "german", variant: "germany", typeSlug: "relationships" },
    select: { id:true, levels:true, status:true, stories: { select: { slug:true, vocab:true } } } });
  const porNivel = new Map<string, Map<string, { tipo: string; slug: string }>>();
  for (const j of js) {
    const nivel = (j.levels ?? []).join("+");
    const m = porNivel.get(nivel) ?? new Map(); porNivel.set(nivel, m);
    for (const s of j.stories) for (const v of ((s.vocab as any[]) ?? []))
      if (v?.word) m.set(norm(String(v.word)), { tipo: String(v.type ?? "?"), slug: s.slug! });
    console.log(`${nivel.padEnd(6)} ${j.status.padEnd(8)} ${j.id} · ${j.stories.length} historias`);
  }
  const a2 = porNivel.get("a2")!;
  for (const nivel of ["a0", "a1"]) {
    const otro = porNivel.get(nivel); if (!otro) { console.log(`\n${nivel}: no hay journey`); continue; }
    const comun = [...a2.keys()].filter((w) => otro.has(w));
    const anclado = comun.filter((w) => !PORTABLE.has(a2.get(w)!.tipo));
    console.log(`\nA2 vs ${nivel.toUpperCase()}: ${comun.length} palabras compartidas de ${a2.size}; ANCLADAS (cero exigido): ${anclado.length}`);
    for (const w of anclado) console.log(`   ${w} [${a2.get(w)!.tipo}] ${a2.get(w)!.slug}`);
    const port = comun.filter((w) => PORTABLE.has(a2.get(w)!.tipo));
    if (port.length) console.log(`   portables reabiertas: ${port.join(", ")}`);
  }
  await p.$disconnect();
})();
