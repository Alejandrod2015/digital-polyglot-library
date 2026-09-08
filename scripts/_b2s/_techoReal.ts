/** Techo defendible: candidatas del cuerpo por encima de A1/A2, SIN nombres propios y SIN
 *  formas conjugadas de verbos ya A1/A2; unicidad global; separadas por via de nivel. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
import { esHuecoDelLexico } from "../../src/lib/cefr/spanishLexiconGaps";
const p = new PrismaClient();
const de = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const RAICES = ["ar","er","ir","arse","erse","irse"];
/** ¿el token es forma de un verbo/lema que ya es A1-A2? */
const esFormaBasica = (t: string): boolean => {
  for (let corte = 1; corte <= 5 && corte < t.length - 2; corte++) {
    const r = t.slice(0, t.length - corte);
    for (const suf of RAICES) if (isSpanishUpToLevel(r + suf, "a2")) return true;
    if (isSpanishUpToLevel(r, "a2") || isSpanishUpToLevel(r + "o", "a2") || isSpanishUpToLevel(r + "e", "a2")) return true;
  }
  return isSpanishUpToLevel(t.replace(/(los|las|le|les|lo|la|me|te|se|nos)$/, ""), "a2");
};
(async () => {
  for (const [JID, NIVEL, tag] of [["cmt5x67ze000l320cpgunu5vi","b1","B1"],["cmtplpfum0007j8c6piegwt31","b2","B2"]] as [string,"b1"|"b2",string][]) {
    const j = await p.journey.findUnique({ where: { id: JID }, select: { typeSlug: true } });
    const mismos = new Set((await p.journey.findMany({ where: { language: "spanish", typeSlug: j!.typeSlug }, select: { id: true } })).map((x) => x.id));
    const tipo = new Set<string>();
    for (const o of await p.journey.findMany({ where: { language: "spanish" }, select: { id: true } }))
      if (mismos.has(o.id) && o.id !== JID)
        for (const s of await p.journeyStory.findMany({ where: { journeyId: o.id }, select: { vocab: true } }))
          for (const v of ((s.vocab as any[]) ?? [])) tipo.add(de(String(v.word)));
    const st = await p.journeyStory.findMany({ where: { journeyId: JID }, orderBy: [{ topic: "asc" },{ slotIndex: "asc" }], select: { slug: true, text: true, title: true, vocab: true } });
    const ya = new Set<string>();
    for (const s of st) for (const v of ((s.vocab as any[]) ?? [])) { ya.add(de(String(v.word))); ya.add(de(String(v.surface ?? ""))); }
    let tot = 0, alto = 0; const filas: {slug:string;huecos:number;L:string[];C:string[];X:string[]}[] = [];
    for (const s of st) {
      const v = (s.vocab as any[]) ?? [];
      const altas = v.filter((x) => !isSpanishUpToLevel(String(x.word), "a2")).length;
      tot += v.length; alto += altas;
      const texto = `${s.title} ${s.text}`;
      const propios = new Set((texto.match(/(?<![.!?¡¿]\s)(?<!^)\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}/gu) ?? []).map(de));
      const toks = [...new Set(de(texto).match(/[a-z]{4,}/g) ?? [])]
        .filter((w) => !isSpanishUpToLevel(w, "a2") && !ya.has(w) && !tipo.has(w) && !propios.has(w) && !esFormaBasica(w));
      filas.push({ slug: s.slug!, huecos: v.length - altas,
        L: toks.filter((w) => isSpanishUpToLevel(w, NIVEL)),
        C: toks.filter((w) => !isSpanishUpToLevel(w, NIVEL) && esHuecoDelLexico(w)),
        X: toks.filter((w) => !isSpanishUpToLevel(w, NIVEL) && !esHuecoDelLexico(w)) });
    }
    const usada = new Set<string>(); let gL = 0, gLC = 0, gLCX = 0;
    const reparte = (clases: (f: typeof filas[0]) => string[]) => {
      usada.clear(); let n = 0;
      for (const f of [...filas].sort((a, b) => clases(a).length - clases(b).length)) {
        let k = 0;
        for (const w of clases(f)) { if (usada.has(w) || k >= f.huecos) continue; usada.add(w); k++; }
        n += k;
      } return n;
    };
    gL = reparte((f) => f.L); gLC = reparte((f) => [...f.L, ...f.C]); gLCX = reparte((f) => [...f.L, ...f.C, ...f.X]);
    console.log(`### ${tag}: ahora ${alto}/${tot} ${Math.round(100*alto/tot)}% · objetivo 60% (${Math.ceil(0.6*tot)}) · faltan ${Math.ceil(0.6*tot)-alto}`);
    console.log(`    techo solo lista .............. ${alto+gL}/${tot} ${Math.round(100*(alto+gL)/tot)}%`);
    console.log(`    + huecos de lexico corriente .. ${alto+gLC}/${tot} ${Math.round(100*(alto+gLC)/tot)}%`);
    console.log(`    + altas/exenciones a mano ..... ${alto+gLCX}/${tot} ${Math.round(100*(alto+gLCX)/tot)}%`);
    console.log(`    ejemplos [X] (exigen alta documentada o registro): ${[...new Set(filas.flatMap((f) => f.X))].slice(0, 22).join(", ")}`);
  }
  await p.$disconnect();
})();
