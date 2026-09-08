/** Vuelca las cuatro historias del B1 latam cuyos titulos el usuario encontro
 *  raros, para titularlas leyendo el cuerpo y no la etiqueta. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const S = [
  "le-puso-el-ojo-al-cuartel",
  "la-pasilla-del-jueves",
  "prometio-cargar-el-anda",
  "le-fiaron-en-el-palenque",
];

(async () => {
  const uno = process.argv[2];
  for (const slug of uno ? [uno] : S) {
    const h = await p.journeyStory.findFirst({
      where: { slug }, select: { title: true, synopsis: true, text: true },
    });
    console.log(`\n═════ ${slug}\nTITULO: ${h?.title}  (${(h?.title ?? "").length} car.)\nSINOPSIS: ${h?.synopsis}\n---\n${h?.text}`);
  }
  await p.$disconnect();
})();
