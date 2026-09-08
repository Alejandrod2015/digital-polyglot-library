/** Pool MAXIMO absoluto: palabras del cuerpo por encima de A1/A2, no enseñadas por el mismo
 *  tipo, no usadas ya en el journey, SIN filtrar por lista (incluye las que el juez mandaria
 *  a C2 y que solo pasarian con exencion de registro). Unicidad global. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
const p = new PrismaClient();
const de = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
(async () => {
  for (const [JID, tag] of [["cmt5x67ze000l320cpgunu5vi", "B1"], ["cmtplpfum0007j8c6piegwt31", "B2"]] as [string, string][]) {
    const j = await p.journey.findUnique({ where: { id: JID }, select: { typeSlug: true } });
    const mismos = new Set((await p.journey.findMany({ where: { language: "spanish", typeSlug: j!.typeSlug }, select: { id: true } })).map((x) => x.id));
    const tipo = new Set<string>();
    for (const o of await p.journey.findMany({ where: { language: "spanish" }, select: { id: true } }))
      if (mismos.has(o.id) && o.id !== JID)
        for (const s of await p.journeyStory.findMany({ where: { journeyId: o.id }, select: { vocab: true } }))
          for (const v of ((s.vocab as any[]) ?? [])) tipo.add(de(String(v.word)));
    const st = await p.journeyStory.findMany({ where: { journeyId: JID }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { slug: true, text: true, title: true, vocab: true } });
    const ya = new Set<string>();
    for (const s of st) for (const v of ((s.vocab as any[]) ?? [])) { ya.add(de(String(v.word))); ya.add(de(String(v.surface ?? ""))); }
    let tot = 0, alto = 0; const usada = new Set<string>(); const filas: {slug:string;huecos:number;cand:string[]}[] = [];
    for (const s of st) {
      const v = (s.vocab as any[]) ?? [];
      const altas = v.filter((x) => !isSpanishUpToLevel(String(x.word), "a2")).length;
      tot += v.length; alto += altas;
      const toks = [...new Set(de(`${s.title} ${s.text}`).match(/[a-z]{4,}/g) ?? [])];
      const cand = toks.filter((w) => !isSpanishUpToLevel(w, "a2") && !ya.has(w) && !tipo.has(w));
      filas.push({ slug: s.slug!, huecos: v.length - altas, cand });
    }
    let g = 0;
    for (const h of [...filas].sort((a, b) => a.cand.length - b.cand.length)) {
      let n = 0;
      for (const w of h.cand) { if (usada.has(w) || n >= h.huecos) continue; usada.add(w); n++; }
      g += n;
    }
    console.log(`### ${tag}: ahora ${alto}/${tot} ${Math.round(100*alto/tot)}% · POOL MAXIMO ${alto+g}/${tot} = ${Math.round(100*(alto+g)/tot)}% (sin filtrar por lista; incluye las que exigirian exencion de registro)`);
  }
  await p.$disconnect();
})();
