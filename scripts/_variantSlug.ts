import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j: any = await p.journey.findUnique({ where: { id: "cmsyrge55000732u9oiu8wue3" } });
  console.log({ language: j.language, variant: j.variant, name: j.name, levels: j.levels, status: j.status });
  await p.$disconnect();
})();
