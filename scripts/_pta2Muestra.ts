/** SOLO LECTURA. Una historia del B1 PT, entera, para seguir el patron de
 *  narracion del journey hermano en vez de inventar uno. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmtq5n9a50007j8812p9lzxjr", topic: "sao-paulo" },
    select: { slug: true, title: true, synopsis: true, text: true, arcType: true, vocab: true },
    orderBy: { slotIndex: "asc" },
  });
  for (const s of ss.slice(0, 2)) {
    console.log(`\n===== ${s.slug} · ${s.title} · arc=${s.arcType}`);
    console.log(`SINOPSIS: ${s.synopsis}`);
    console.log(s.text);
    const v = (s.vocab ?? []) as Array<Record<string, unknown>>;
    console.log(`VOCAB (${v.length}): ` + JSON.stringify(v.slice(0, 3), null, 1));
  }
})().finally(() => p.$disconnect());
