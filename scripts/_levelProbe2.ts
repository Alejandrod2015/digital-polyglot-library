import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const NO_VERBO = new Set(["meu","seu","teu","céu","chapéu","europeu","ateu","judeu","museu","troféu"]);
async function main() {
  for (const id of process.argv.slice(2)) {
    const j = await p.journey.findUnique({ where: { id }, select: { name: true, levels: true } });
    const rows = await p.journeyStory.findMany({ where: { journeyId: id, text: { not: null } }, select: { text: true } });
    const t = rows.map((r) => r.text!).join("\n");
    const frases = t.replace(/\n+/g, " ").split(/(?<=[.!?”])\s+/).filter((f) => f.trim().length > 1);
    // TODAS las personas del pretérito, no solo la tercera.
    const pret = (t.match(/\b[a-zà-ú]+(?:ou|iu|ei|amos|emos|imos|aram|eram|iram)\b/gi) ?? []).filter((w) => !NO_VERBO.has(w.toLowerCase()));
    const irr = t.match(/\b(foi|foram|fui|teve|tive|tiveram|fez|fiz|fizeram|disse|disseram|veio|vim|vieram|deu|dei|deram|trouxe|quis|pôde|soube|esteve|estive|estiveram)\b/gi) ?? [];
    const cont = (re: RegExp) => (t.match(re) ?? []).length;
    console.log(`\n== ${j?.name} ${JSON.stringify(j?.levels)} · ${frases.length} oraciones`);
    console.log(`   pretérito (todas las personas): ${pret.length + irr.length}`);
    console.log(`     formas: ${[...new Set([...pret, ...irr].map((x) => x.toLowerCase()))].sort().join(" ")}`);
    console.log(`   relativas "que + verbo":   ${cont(/\bque\s+[a-zà-ú]+(a|e|ou|em|am|ia)\b/gi)}`);
    console.log(`   comparativas mais/menos:   ${cont(/\b(mais|menos)\s+[a-zà-ú]+\s+(que|do que)\b/gi)}`);
    console.log(`   clíticos (se/me/te/lhe):   ${cont(/\b(se|me|te|lhe|nos)\s+[a-zà-ú]+(ar|er|ir|a|e)\b/gi)}`);
    console.log(`   estilo indirecto (disse/avisa/explica que): ${cont(/\b(disse|diz|avisa|explica|conta|responde|pergunta)\s+(que|se)\b/gi)}`);
    console.log(`   negativas dobles (não ... nenhum/nada/ninguém): ${cont(/\bnão\b[^.!?”]{0,40}\b(nenhum|nenhuma|nada|ninguém|nunca)\b/gi)}`);
    const largas = frases.map((f) => [f, (f.match(/[a-zà-ú]+/gi) ?? []).length] as const).sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log("   las 5 oraciones más largas:");
    for (const [f, n] of largas) console.log(`     (${n}) ${f.trim().slice(0, 130)}`);
  }
  await p.$disconnect();
}
main();
