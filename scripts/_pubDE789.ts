import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const fixes = [
    { id: "cmr92f1ik000e32ffbv9m2umd", slug: "duzen-auf-eigene-gefahr" },
    { id: "cmr92f1li000g32ffkcy2vw06", slug: "feierabend-ist-ein-versprechen" },
    { id: "cmr92f1oe000i32ffninluyp2", slug: "feedback-auf-deutsch" },
  ];
  for (const f of fixes) {
    const r = await prisma.journeyStory.update({ where: { id: f.id },
      data: { status: "published", slug: f.slug } });
    console.log(r.status, r.slug);
  }
})().finally(() => prisma.$disconnect());
