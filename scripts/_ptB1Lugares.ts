/** SOLO LECTURA. Frases del B1 (journey cmtrcpgso00073232h8vaf7na) donde salen los 6 lugares y "às". */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";
const p = new PrismaClient();
const W = ["aquidauana", "petrópolis", "gramado", "jericoacoara", "alegre", "lençóis", "às"];
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmtrcpgso00073232h8vaf7na" }, select: { slug: true, title: true, text: true } });
  for (const s of st) {
    const frases = `${s.title}. ${extractStoryPlainText(s.text ?? "")}`.split(/(?<=[.!?”])\s+/);
    for (const f of frases) for (const w of W)
      if (new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, "iu").test(f)) console.log(`${w}\t${s.slug}\t${f.trim()}`);
  }
})().finally(() => p.$disconnect());
