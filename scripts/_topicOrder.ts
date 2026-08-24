import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j: any = await p.journey.findUnique({ where: { id: "cmsyrge55000732u9oiu8wue3" } });
  console.log(JSON.stringify(j.topics));
  await p.$disconnect();
})();
