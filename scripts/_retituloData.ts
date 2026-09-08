/** Construye el data.json de UN tema del B1 latam con los titulos nuevos
 *  (mapa en el scratchpad) y todo lo demas tal cual esta en la base, slug
 *  incluido para que saveStory no lo regenere. Uso: _retituloData.ts <tema> <out> */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const MAPA = JSON.parse(fs.readFileSync(process.env.TITULOS!, "utf8")) as Record<string, string | null>;
(async () => {
  const [tema, out] = process.argv.slice(2);
  const st = await p.journeyStory.findMany({
    where: { journeyId: "cmtmylg7k0007321h6t7njesx", topic: tema },
    select: { topic: true, slotIndex: true, slug: true, title: true, synopsis: true, text: true, vocab: true, arcType: true },
    orderBy: { slotIndex: "asc" },
  });
  const data = st.map((s) => ({
    topic: s.topic, slotIndex: s.slotIndex, slug: s.slug,
    title: (s.slug && MAPA[s.slug]) ? MAPA[s.slug]! : s.title,
    synopsis: s.synopsis, text: s.text, vocab: s.vocab, arcType: s.arcType,
  }));
  fs.writeFileSync(out, JSON.stringify(data, null, 1));
  console.log(tema, "->", data.map((d) => d.title).join(" | "));
  await p.$disconnect();
})();
