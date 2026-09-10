import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { slug: "la-pared-que-nadie-encargo" }, select: { text: true } });
  const m = s!.text!.split("\n").filter(l => l.includes("tumba") || l.includes("secreto"));
  console.log(m.join("\n"));
  await p.$disconnect();
})();
