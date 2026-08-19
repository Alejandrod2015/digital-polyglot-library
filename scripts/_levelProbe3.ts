import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const FALSOS = new Set(["param","esperam","estou","sei","meu","seu","teu","céu","chapéu","museu","ltimos","últimos","vou","sou","dou"]);
async function main() {
  for (const id of process.argv.slice(2)) {
    const j = await p.journey.findUnique({ where: { id }, select: { levels: true } });
    const rows = await p.journeyStory.findMany({ where: { journeyId: id, text: { not: null } }, select: { slug: true, text: true } });
    const t = rows.map((r) => r.text!).join("\n");
    const frases = t.replace(/\n+/g, " ").split(/(?<=[.!?”])\s+/).filter((f) => f.trim().length > 1);
    const hits = (re: RegExp) => (t.match(re) ?? []).map((x) => x.toLowerCase()).filter((w) => !FALSOS.has(w));
    const pret = [...hits(/\b[a-zà-ú]+(?:ou|iu|ei|amos|aram|eram|iram)\b/gi), ...hits(/\b(foi|foram|fui|teve|tive|tiveram|fez|fiz|fizeram|disse|disseram|veio|vieram|deu|dei|deram|trouxe|quis|pôde|soube|esteve|estive)\b/gi)];
    const imp = hits(/\b[a-zà-ú]+(?:ava|avam)\b|\b(era|eram|tinha|tinham|havia|estava|estavam|fazia|dizia|vinha|queria|sabia|podia|ia|iam)\b/gi);
    const subj = hits(/\b[a-zà-ú]+(?:asse|esse|isse|assem|essem|issem)\b|\b(seja|sejam|tenha|tenham|esteja|queira|possa|tiver|for|quiser|fizer)\b/gi);
    const porHistoria = rows.map((r) => ({
      slug: r.slug!,
      n: ((r.text!.match(/\b[a-zà-ú]+(?:ou|iu|ei|amos|aram|eram|iram)\b/gi) ?? []).map((x) => x.toLowerCase()).filter((w) => !FALSOS.has(w)).length
        + (r.text!.match(/\b(foi|foram|fui|teve|tive|tiveram|fez|fiz|fizeram|disse|disseram|veio|vieram|deu|dei|deram|trouxe|quis|pôde|soube|esteve|estive)\b/gi) ?? []).length),
    }));
    console.log(`\n== ${JSON.stringify(j?.levels)} · ${frases.length} oraciones · ${rows.length} historias`);
    console.log(`   pretérito: ${pret.length} usos (${Math.round((100 * pret.length) / frases.length)} por 100 oraciones)`);
    console.log(`   imperfecto: ${imp.length} -> ${[...new Set(imp)].join(" ")}`);
    console.log(`   subjuntivo: ${subj.length} -> ${[...new Set(subj)].join(" ")}`);
    console.log(`   historias con 0 pretérito: ${porHistoria.filter((x) => x.n === 0).length}/${rows.length}`);
    console.log(`   reparto: ${porHistoria.map((x) => x.n).join(" ")}`);
  }
  await p.$disconnect();
}
main();
