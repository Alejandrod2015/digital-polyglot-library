/** Vuelca cada palabra sin cubrir con TODAS sus frases, para escribir la glosa
 *  mirando la oracion y no el diccionario. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { extractStoryPlainText } from "../../src/lib/storyPlainText";
import { TAPPABLE, glossKeyCandidates } from "../../src/lib/tapGlossKey";
const p = new PrismaClient();
const BUNDLE = "german-friends-a2";
function claveExigida(token: string): { exige: string; valen: string[] } {
  const cand = glossKeyCandidates(token);
  if (cand.length < 3) return { exige: cand[0] ?? "", valen: cand.slice(0, 1) };
  const [entera, cola, cabeza] = cand;
  const conCarne = cola.length >= 3 ? cola : cabeza;
  return { exige: conCarne, valen: [entera, conCarne] };
}
(async () => {
  const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: BUNDLE, slug: "" } } });
  const own = new Set(Object.keys(g!.glosses as object).map(k=>k.toLowerCase()));
  const ex = JSON.parse(fs.readFileSync("scripts/tap-gloss-exempt.json","utf8")).bundles[BUNDLE];
  const exempt = new Set([...ex.articles, ...ex.numerals, ...ex.characterNames, ...(ex.placeNames??[])].map((w:string)=>w.toLowerCase()));
  const stories = await p.journeyStory.findMany({ where: { slug: { in: g!.slugs } }, select: { slug:true, title:true, text:true } });
  const frases = new Map<string, string[]>();
  for (const s of stories) {
    const full = `${s.title}. ${extractStoryPlainText(s.text ?? "")}`;
    const sents = full.split(/(?<=[.!?”])\s+/).map(x=>x.trim()).filter(Boolean);
    for (const sent of sents) {
      for (const tok of sent.match(TAPPABLE) ?? []) {
        const { exige, valen } = claveExigida(tok);
        if (!exige) continue;
        if (valen.some(k=>own.has(k)||exempt.has(k))) continue;
        const arr = frases.get(exige) ?? []; if (!arr.includes(sent)) arr.push(sent);
        frases.set(exige, arr);
      }
    }
  }
  const out = [...frases.entries()].sort();
  let txt = "";
  for (const [w, ss] of out) txt += `\n### ${w}\n` + ss.map(s=>"  - "+s).join("\n") + "\n";
  fs.writeFileSync("scripts/_deA2/faltan.txt", txt);
  console.log(`${out.length} palabras sin cubrir`);
  await p.$disconnect();
})();
