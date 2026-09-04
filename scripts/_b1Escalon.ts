/**
 * Compara A1, A2 y B1 latam en las marcas que SI distinguen un nivel del otro:
 * largo de oracion, subordinacion, subjuntivo, condicional y tiempos compuestos.
 * El juez CEFR del validador solo mira frecuencia lexica; el escalon de B1 es
 * gramatical y no lo mide nadie.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";
const p = new PrismaClient();

const J: Array<[string, string]> = [
  ["A1", "cmt5vxwgd0007324oesy195k8"],
  ["A2", "cmtgelq560007j84n3ujx9bpd"],
  ["B1", "cmtmylg7k0007321h6t7njesx"],
];

const SUBORD = /\b(aunque|mientras|porque|para que|si\b|cuando|hasta que|antes de que|despues de que|después de que|como si|de modo que|ya que|puesto que|sino que)\b/gi;
const SUBJ = /\b\w+(ara|iera|ase|iese|aran|ieran|asen|iesen|are|iere)\b|\b(sea|seas|sean|haya|hayan|tenga|tengan|pueda|puedan|quiera|quieran|diga|digan|venga|vengan|salga|salgan|vaya|vayan|hiciera|dijera|supiera|fuera|fueran|estuviera)\b/gi;
const COND = /\b\w+(ría|rías|ríamos|rían)\b/gi;
const COMP = /\b(había|habían|habías|he|has|ha|hemos|han|habría|habrían)\s+\w+(ado|ido|to|cho)\b/gi;

(async () => {
  for (const [lvl, id] of J) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: id, NOT: { text: null } }, select: { text: true, wordCount: true } });
    if (!ss.length) { console.log(`${lvl}: sin historias`); continue; }
    let palabras = 0, oraciones = 0, sub = 0, subj = 0, cond = 0, comp = 0;
    for (const s of ss) {
      const t = extractStoryPlainText(s.text ?? "");
      palabras += t.split(/\s+/).filter(Boolean).length;
      oraciones += (t.match(/[.!?…]/g) ?? []).length;
      sub += (t.match(SUBORD) ?? []).length;
      subj += (t.match(SUBJ) ?? []).length;
      cond += (t.match(COND) ?? []).length;
      comp += (t.match(COMP) ?? []).length;
    }
    const por100 = (n: number) => ((n / palabras) * 100).toFixed(2);
    console.log(
      `${lvl} (${ss.length} hist, ${palabras} palabras) · oracion media ${(palabras / oraciones).toFixed(1)} palabras` +
      ` · subordinantes ${por100(sub)}/100 · subjuntivo ${por100(subj)}/100` +
      ` · condicional ${por100(cond)}/100 · compuestos ${por100(comp)}/100`,
    );
  }
  await p.$disconnect();
})();
