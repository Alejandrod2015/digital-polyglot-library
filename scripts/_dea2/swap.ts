/** Por historia: que palabra objetivo de un ejercicio ya no es plaza de vocab
 *  (sale) y que plaza nueva se ha quedado sin ejercicio (entra), con la frase
 *  y el tipo de la que entra, que es lo que hace falta para escribirlo. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { extractStoryPlainText } from "../../src/lib/storyPlainText";
const JID = "cmubidgaf0007j8np6g7n89iu";
const p = new PrismaClient();
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const ART = /^(der|die|das|den|dem|des|ein|eine)$/;
const head = (s: string) => { const t = norm(s).split(/\s+/).filter(Boolean); return t.length>1 && ART.test(t[0]) ? t[t.length-1] : t[0]; };
/** ESTRICTO a proposito. El `covers` del validador compara por prefijo de la
 *  cabeza y en aleman eso da falsos positivos que esconden huecos: `der
 *  Fussball` daba por cubierta `der Fuss` (prefijo de 3) y `leihen` daba por
 *  cubierta `leicht`. Aqui el objetivo tiene que ser el lema sin articulo o la
 *  superficie, y nada mas. */
const cubre = (target: string, word: string, surface?: string) => {
  const a = norm(target);
  return a === norm(word) || a === head(norm(word)) || (!!surface && a === norm(surface));
};
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: JID }, select: { slug:true, title:true, text:true, vocab:true } });
  for (const s of st.sort((a,b)=>a.slug!.localeCompare(b.slug!))) {
    const f = `scripts/_sets/${s.slug}.json`; if (!fs.existsSync(f)) continue;
    const exs = JSON.parse(fs.readFileSync(f, "utf8")) as any[];
    const voc = ((s.vocab as any[]) ?? []);
    const targets: Array<{ w: string; tipo: string }> = [];
    for (const e of exs) {
      if (e.type === "match_meaning") for (const pr of e.payload.pairs) targets.push({ w: pr.word, tipo: "match" });
      else targets.push({ w: e.word, tipo: e.type });
    }
    const salen = targets.filter(t => !voc.some(v => cubre(t.w, v.word, v.surface)));
    const entran = voc.filter(v => !targets.some(t => cubre(t.w, v.word, v.surface)));
    if (!salen.length && !entran.length) continue;
    const texto = `${s.title}\n${extractStoryPlainText(s.text ?? "")}`;
    const frases = texto.split(/(?<=[.!?”])\s+/).map(x=>x.trim()).filter(Boolean);
    console.log(`\n=== ${s.slug}`);
    console.log(`  SALEN: ${salen.map(t=>`${t.w} (${t.tipo})`).join(", ")}`);
    for (const v of entran) {
      const sup = String(v.surface ?? v.word);
      const re = new RegExp(`(?<![\\p{L}\\p{M}])${sup.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}`, "iu");
      console.log(`  ENTRA: ${v.word} [${v.type}] surface=${sup}`);
      console.log(`         def: ${v.definition}`);
      console.log(`         fra: ${frases.find(x=>re.test(x)) ?? "?"}`);
    }
  }
  await p.$disconnect();
})();
