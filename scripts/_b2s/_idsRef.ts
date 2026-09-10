import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { language: "spanish", status: { in: ["active", "draft"] } }, select: { id: true, name: true, variant: true, levels: true, status: true } });
  const quiero = (j: any) => ["b1", "b2", "c1"].includes(j.levels[0]) || (j.levels[0] === "a2" && j.variant === "spain");
  for (const j of js.filter(quiero)) console.log(j.id, `${j.name}-${j.variant}-${j.levels[0]}-${j.status === "active" ? "live" : "draft"}`);
  await p.$disconnect();
})();
