/** Comprueba que la PRIMERA historia de cada tema nombre el pais en su primer
 *  parrafo. La ciudad sola no basta: el lector anglosajon no sabe que Salento
 *  y Arequipa estan en paises distintos (regla del usuario, 2026-09-02). */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const PAISES = ["Argentina", "Colombia", "Perú", "México"];
(async () => {
  const J = "cmtgelq560007j84n3ujx9bpd";
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const ss = (await p.journeyStory.findMany({ where: { journeyId: J, slotIndex: 1 },
    select: { topic: true, slug: true, text: true, audioUrl: true } }))
    .sort((a, b) => j!.topics.indexOf(a.topic) - j!.topics.indexOf(b.topic));
  let mal = 0;
  for (const s of ss) {
    const p1 = (s.text || "").split("\n\n")[0].normalize("NFC");
    const hit = PAISES.find((x) => p1.includes(x));
    if (!hit) mal++;
    console.log(`${s.slug.padEnd(26)} ${hit ?? "NO"}${s.audioUrl ? "  · renarrar" : ""}`);
  }
  console.log(mal === 0 ? "\nlos 7 temas nombran su pais" : `\nfaltan ${mal}`);
})().finally(() => p.$disconnect());
