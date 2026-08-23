import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const n = await p.journeyStory.count({ where: { coverUrl: { contains: "les-premi-res-heures" } } });
  console.log(`historias que apuntan a esas imagenes: ${n}`);
  await p.$disconnect();
})();
