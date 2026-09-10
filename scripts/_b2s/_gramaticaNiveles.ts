/** Rasgos gramaticales y lexicos por journey ES live+draft: solo lectura. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";
const p = new PrismaClient();
const RASGOS: Record<string, RegExp> = {
  pasado: /\b\w+(é|ó|aste|amos|asteis|aron|í|iste|ió|imos|isteis|ieron|aba|abas|ábamos|aban|ía|ías|íamos|ían)\b/i,
  subjPres: /\b(que|cuando|aunque|para que|antes de que|hasta que|ojalá|en cuanto|sin que)\s+(\w+\s+)?\w+(e|es|emos|en|a|as|amos|an)\b/i,
  subjImpf: /\b\w+(ara|aras|áramos|aran|iera|ieras|iéramos|ieran|ase|iese)\b/i,
  condic: /\b\w+(ría|rías|ríamos|rían)\b/i,
  pluscuamp: /\b(había|habías|habíamos|habían)\s+\w+(ado|ido|to|cho)\b/i,
  perfCompuesto: /\b(he|has|ha|hemos|han)\s+\w+(ado|ido|to|cho)\b/i,
  siCond: /\bsi\s+\w+(ara|iera|ase|iese)\b|\bsi\s+(hubiera|hubiese)\b/i,
  relCulto: /\b(el cual|la cual|los cuales|las cuales|cuyo|cuya|cuyos|cuyas|lo cual)\b/i,
  conectorB2: /\b(sin embargo|no obstante|a pesar de|aun así|de modo que|de manera que|por lo tanto|así pues|en cambio|mientras que|dado que|puesto que|con tal de|a no ser que|siempre que)\b/i,
  perifrasis: /\b(lleva\w*|sigue\w*|acab\w*\s+de|vuelv\w*\s+a|dej\w*\s+de|suel\w*)\s+\w+(ndo|ar|er|ir)\b/i,
  pasivaSe: /\bse\s+\w+(a|an|e|en)\b/i,
};
(async () => {
  const js = await p.journey.findMany({ where: { language: "spanish", status: { in: ["active", "draft"] } }, select: { id: true, name: true, variant: true, levels: true, status: true } });
  const filas: any[] = [];
  for (const j of js) {
    const st = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { text: true } });
    const texto = st.map((s) => s.text ?? "").join("\n");
    if (!texto.trim()) continue;
    const frases = texto.split(/(?<=[.!?…])\s+/).map((f) => f.trim()).filter((f) => f.split(/\s+/).length >= 3);
    const lon = frases.map((f) => f.split(/\s+/).length).sort((a, b) => a - b);
    const med = lon[Math.floor(lon.length / 2)];
    const pct = (re: RegExp) => Math.round((100 * frases.filter((f) => re.test(f)).length) / frases.length);
    const toks = (texto.toLowerCase().match(/[a-záéíóúüñ]{3,}/g) ?? []);
    const fueraA2 = toks.filter((w) => !isSpanishUpToLevel(w, "a2")).length;
    const fueraB1 = toks.filter((w) => !isSpanishUpToLevel(w, "b1")).length;
    const palabrasHist = Math.round(toks.length / st.length);
    filas.push({ j: `${j.name} ${j.variant} ${(j.levels as string[]).join("")} ${j.status === "active" ? "live" : "draft"}`, nivel: (j.levels as string[])[0], n: st.length, med, palabrasHist,
      ...Object.fromEntries(Object.entries(RASGOS).map(([k, re]) => [k, pct(re)])),
      fA2: Math.round((100 * fueraA2) / toks.length), fB1: Math.round((100 * fueraB1) / toks.length) });
  }
  const orden = ["a0", "a1", "a2", "b1", "b2", "c1", "c2"];
  filas.sort((a, b) => orden.indexOf(a.nivel) - orden.indexOf(b.nivel));
  const cols = ["med", "palabrasHist", ...Object.keys(RASGOS), "fA2", "fB1"];
  console.log(["journey".padEnd(34), "n", ...cols].join(" | "));
  for (const f of filas) console.log([f.j.padEnd(34), f.n, ...cols.map((c) => f[c])].join(" | "));
  await p.$disconnect();
})();
