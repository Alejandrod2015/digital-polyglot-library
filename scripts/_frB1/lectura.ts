/** Trabajo: vuelca las 21 en orden de journey (tema, slot) con sinopsis, para la lectura seguida. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const J = "cmu0doigc0007j8e292tycths";
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const st = await p.journeyStory.findMany({ where: { journeyId: J }, select: { topic: true, slotIndex: true, title: true, synopsis: true, text: true } });
  st.sort((a, b) => j!.topics.indexOf(a.topic) - j!.topics.indexOf(b.topic) || a.slotIndex - b.slotIndex);
  let i = 0;
  for (const s of st) console.log(`\n#${++i} [${s.topic} ${s.slotIndex + 1}] ${s.title}\nSINOPSIS: ${s.synopsis}\n${s.text}`);
}
main().finally(() => p.$disconnect());
