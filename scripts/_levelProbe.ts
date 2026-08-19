/**
 * Sonda de nivel: compara dos journeys del mismo idioma en las señales que
 * separan A0/A1/A2 y que NO mide el validador (longitud de oración,
 * subordinación, tiempos verbales, léxico fuera de la lista A1-A2).
 *
 *   npx tsx --conditions react-server scripts/_levelProbe.ts <idA> <idB> ...
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { isPortugueseA1A2 } from "../src/lib/cefr/portugueseA1A2";
const p = new PrismaClient();

const SUB = /\b(porque|quando|se|enquanto|embora|assim que|antes de que|depois que|para que|mesmo que|caso|como se|que)\b/gi;
// Pretérito perfecto SIN el ruido de "meu/seu/céu/chapéu": las formas en
// -ou/-iu menos una lista corta de sustantivos y posesivos, más los
// irregulares frecuentes.
const NO_VERBO = new Set(["meu", "seu", "teu", "céu", "chapéu", "europeu", "ateu", "judeu", "museu", "troféu"]);
const PERF_RE = /\b[a-zà-ú]+(?:ou|iu)\b/gi;
const PERF_IRR = /\b(foi|foram|teve|tiveram|fez|fizeram|disse|disseram|veio|vieram|deu|deram|pôs|puseram|trouxe|quis|pôde|soube|esteve|estiveram)\b/gi;
// Imperfecto: solo -ava/-avam (inequívoco) y los irregulares. Las formas en
// -ia se quedan fuera a propósito: "dia", "praia", "família" y "energia" las
// contaban como verbos y ensuciaban la comparación.
const IMPERF = /\b[a-zà-ú]+(?:ava|avam)\b|\b(era|eram|tinha|tinham|havia|estava|estavam|ia|iam|fazia|faziam|dizia|diziam|vinha|vinham|queria|queriam|sabia|sabiam|podia|podiam)\b/gi;
const SUBJ = /\b\w+(asse|esse|isse|assem|essem|issem)\b|\b(seja|sejam|tenha|tenham|esteja|estejam|queira|possa|for|forem|tiver|tiverem|quiser)\b/gi;
const COND = /\b\w+(ria|riam)\b/gi;
const FUT = /\b\w+(rá|rão|rei|remos)\b/gi;
const PERIF = /\b(vai|vou|vamos|vão)\s+\w+r\b/gi;

async function main() {
  for (const id of process.argv.slice(2)) {
    const j = await p.journey.findUnique({ where: { id }, select: { name: true, variant: true, levels: true, status: true } });
    const rows = await p.journeyStory.findMany({ where: { journeyId: id, text: { not: null } }, select: { text: true, vocab: true } });
    const texto = rows.map((r) => r.text!).join("\n");
    const frases = texto.replace(/\n+/g, " ").split(/(?<=[.!?”])\s+/).filter((f) => f.trim().length > 1);
    const palabras = texto.toLowerCase().match(/[a-zà-ú]+/g) ?? [];
    const unicas = new Set(palabras);
    const fuera = [...unicas].filter((w) => w.length > 3 && !isPortugueseA1A2(w));
    const cuenta = (re: RegExp) => (texto.match(re) ?? []).length;
    const n = frases.length;
    const largas = frases.filter((f) => (f.match(/[a-zà-ú]+/gi) ?? []).length > 15).length;
    const pills = rows.flatMap((r) => ((r.vocab as any[]) ?? []).map((v) => String(v.word)));
    console.log(`\n== ${j?.name} ${j?.variant} ${JSON.stringify(j?.levels)} [${j?.status}] · ${rows.length} historias`);
    console.log(`   palabras/oración        ${(palabras.length / n).toFixed(1)}   (oraciones ${n})`);
    console.log(`   oraciones >15 palabras  ${Math.round((100 * largas) / n)}%`);
    console.log(`   subordinación /100 or.  ${Math.round((100 * cuenta(SUB)) / n)}`);
    const perf = (texto.match(PERF_RE) ?? []).filter((w) => !NO_VERBO.has(w.toLowerCase())).length + cuenta(PERF_IRR);
    console.log(`   pretérito perfecto      ${Math.round((100 * perf) / n)}`);
    console.log(`   imperfecto              ${Math.round((100 * cuenta(IMPERF)) / n)}`);
    console.log(`   subjuntivo              ${Math.round((100 * cuenta(SUBJ)) / n)}`);
    console.log(`   condicional             ${Math.round((100 * cuenta(COND)) / n)}`);
    console.log(`   futuro sintético        ${Math.round((100 * cuenta(FUT)) / n)}`);
    console.log(`   perífrasis "vai + inf"  ${Math.round((100 * cuenta(PERIF)) / n)}`);
    console.log(`   tipos distintos         ${unicas.size} · fuera de lista A1-A2 ${fuera.length} (${Math.round((100 * fuera.length) / unicas.size)}%)`);
    console.log(`   píldoras fuera de lista ${pills.filter((w) => !isPortugueseA1A2(w)).length}/${pills.length}`);
    console.log(`   ejemplos fuera: ${fuera.slice(0, 25).join(" ")}`);
  }
  await p.$disconnect();
}
main();
