import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const FALTAN: Record<string, string[]> = {
  "celia-no-dice-que-si": ["se ha mudado","ha comprobado","de mes en mes","por adelantado","de todo","a la primera","sin decir nada"],
  "la-mayoria-decide-el-techo": ["en voz alta","de una vez","por su cuenta","al final","poco más"],
  "arriba-vive-alguien": ["ha colgado","poco a poco","en serio","sin falta","de golpe","de momento","ha pegado"],
};
(async () => {
  const p = new PrismaClient();
  const ss = await p.journeyStory.findMany({ where: { journeyId: "cmt5x67ze000l320cpgunu5vi" }, select: { slug: true, title: true, text: true } });
  for (const s of ss) {
    console.log(`\n### ${s.slug}`);
    const cuerpo = `${s.title}. ${s.text}`;
    for (const f of FALTAN[s.slug!] ?? []) {
      const i = cuerpo.toLowerCase().indexOf(f);
      console.log(`- ${f}\n    ...${i < 0 ? "NO SALE" : cuerpo.slice(Math.max(0, i - 45), i + f.length + 40).replace(/\n/g, " ")}...`);
    }
  }
  await p.$disconnect();
})();
