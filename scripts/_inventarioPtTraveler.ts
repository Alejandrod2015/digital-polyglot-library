// Solo lectura: estado de los Traveler PT-BR y consumidores de su nivel en la base.
import { config } from "dotenv"; config({ path: ".env.local" }); config();
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const IDS = ["cmsou2uk0000732mqa4oatcmn","cmsyrge55000732u9oiu8wue3","cmtrcpgso00073232h8vaf7na","cmtq5n9a50007j8812p9lzxjr"];
async function main() {
  const js = await prisma.journey.findMany({ where: { OR: [{ id: { in: IDS } }, { language: "portuguese", typeSlug: { not: null } }] } });
  for (const j of js) {
    const st = await prisma.journeyStory.groupBy({ by: ["level"], where: { journeyId: j.id }, _count: true });
    const aud = await prisma.journeyStory.count({ where: { journeyId: j.id, audioUrl: { not: null } } });
    const txt = await prisma.journeyStory.count({ where: { journeyId: j.id, text: { not: "" } } });
    console.log(JSON.stringify({ id: j.id, name: (j as any).name, variant: j.variant, typeSlug: j.typeSlug, levels: j.levels, status: j.status, next: j.nextJourneyId, topics: j.topics.length, storyLevels: st, audio: aud, conTexto: txt }));
  }
  const tg = await prisma.tapGlossSet.groupBy({ by: ["bundle"], where: { bundle: { contains: "portuguese" } }, _count: true });
  console.log("TapGlossSet", JSON.stringify(tg));
}
main().finally(() => prisma.$disconnect());
