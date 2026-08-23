import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const r = await p.journeyStory.findFirst({
    where: { journeyId: "cmqfnp3tf000032afygkqp8z2", slug: "kabeljau-vom-fischmarkt" },
    select: { text: true, updatedAt: true },
  });
  const t = String(r?.text ?? "");
  console.log("EN LA BASE:", t.trim().split(/\s+/).length, "palabras · updatedAt", r?.updatedAt?.toISOString());
  console.log("primera linea:", t.split("\n")[0].slice(0, 72));
  await p.$disconnect();
})();
