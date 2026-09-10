import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const PRET = /(?<![\p{L}])[\p{L}]+(ó|aron|ieron)(?![\p{L}])|(?<![\p{L}])(fue|fueron|tuvo|hizo|dijo|vino|dio|puso|quiso)(?![\p{L}])/giu;
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmtplpfum0007j8c6piegwt31" }, select: { topic: true, text: true } });
  const por = new Map<string, string[]>();
  for (const s of st) por.set(s.topic, [...(por.get(s.topic) ?? []), s.text ?? ""]);
  for (const [t, xs] of por) {
    const txt = xs.join("\n");
    const fr = txt.replace(/\n+/g, " ").split(/(?<=[.!?”"])\s+/).filter((x) => x.trim().length > 1).length;
    console.log(`${t.padEnd(24)} preterito (corregido) ${Math.round((100 * (txt.match(PRET) ?? []).length) / fr)} por 100`);
  }
  await p.$disconnect();
})();
