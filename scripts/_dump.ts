import { PrismaClient } from "../src/generated/prisma";
import { getTapGlossesForSlug } from "../src/lib/tapGlosses";
const p = new PrismaClient();
async function main() {
  const slugs = process.argv.slice(2);
  for (const slug of slugs) {
    const s = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true } });
    const g: any = getTapGlossesForSlug(slug);
    console.log(`\n########## ${slug}\nTÍTULO: ${s?.title}\n${(s?.text ?? "").replace(/\n+/g, "\n")}`);
    const vistos: string[] = [];
    for (const t of `${s?.title ?? ""} ${s?.text ?? ""}`.toLowerCase().match(/\p{L}+/gu) ?? []) {
      if (g[t] && !vistos.includes(t)) vistos.push(t);
    }
    console.log(`--- ${vistos.length} palabras:`);
    console.log(vistos.map((t) => `${t}|${g[t].t}|${g[t].g}${g[t].f ? "|CONJ:" + g[t].f.lemma : ""}`).join("\n"));
  }
  await p.$disconnect();
}
main();
