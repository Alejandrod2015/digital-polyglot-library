import { PrismaClient } from "../src/generated/prisma";
import { getTapGlossesForSlug } from "../src/lib/tapGlosses";
const p = new PrismaClient();
(async () => {
  const slug = process.argv[2];
  const s = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true } });
  const g: any = getTapGlossesForSlug(slug);
  const full = `${s?.title}. ${s?.text}`;
  const frases = full.split(/(?<=[.!?”])\s+/).map((f) => f.trim()).filter(Boolean);
  const visto = new Set<string>();
  frases.forEach((f, i) => {
    const ws = (f.toLowerCase().match(/\p{L}+/gu) ?? []).filter((w) => g[w] && !visto.has(w));
    ws.forEach((w) => visto.add(w));
    if (ws.length) console.log(`\n[${i}] ${f}\n    ${ws.map((w) => `${w}(${g[w].t[0]})`).join(" ")}`);
  });
  console.log(`\nTOTAL ${visto.size} palabras en ${frases.length} frases`);
  await p.$disconnect();
})();
