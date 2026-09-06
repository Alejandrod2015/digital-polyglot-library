import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const M: Array<[string, RegExp]> = [
  ["perfecto (he/ha + participio)", /\b(he|has|ha|hemos|habéis|han)\s+\w+(ado|ido|to|cho)\b/gi],
  ["subjuntivo", /\b(que|si|cuando|aunque|para que)\s+\w*(e|es|emos|éis|en|a|as|amos|áis|an)\b(?=[^.]*\b(pida|conste|grite|sea|vaya|haya|tenga|pueda|quiera)\b)|\b(conste|grite|sea|vaya|haya|tenga|pueda|quiera|probemos)\b/gi],
  ["condicional / futuro", /\b\w+(ría|rías|ríamos|rían|rá|rás|remos|rán)\b/gi],
  ["pronombre de objeto pegado", /\b\w+(rlo|rla|rle|rlos|rlas|rse|ndolo|ndola|ndose)\b/gi],
  ["subordinada con que", /\bque\b/gi],
  ["perifrasis (hay que, tener que, ir a)", /\b(hay que|tiene que|tienen que|va a|van a|hace falta)\b/gi],
];
(async () => {
  const js = await p.journey.findMany({ where: { language: { equals: "spanish", mode: "insensitive" }, variant: "spain", typeSlug: "traveler", status: { not: "archived" } },
    select: { id: true, levels: true } });
  for (const j of js) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { text: true } });
    const t = ss.map((s) => s.text).join(" ");
    const pal = t.split(/\s+/).length;
    const fila = M.map(([n, re]) => `${n.split(" ")[0]} ${((t.match(re) ?? []).length / pal * 1000).toFixed(1)}`).join(" · ");
    console.log(`${(j.levels ?? []).join("").padEnd(3)} ${String(ss.length).padStart(2)} hist · ${String(pal).padStart(4)} pal · ${fila}`);
  }
  await p.$disconnect();
})();
