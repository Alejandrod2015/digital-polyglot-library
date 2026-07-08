import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const fixes = [
    { id: "cmr92f1zy000q32ff4gx8jt1z", slug: "sonntags-schliesst-sogar-berlin" },
    { id: "cmr92f22t000s32ff9dyu9juc", slug: "mit-freundlichen-gruessen-das-treppenhaus" },
    { id: "cmr92f25r000u32ffguldl5bf", slug: "ganz-berlin-wartet-auf-einen-mord" },
  ];
  for (const f of fixes) {
    const r = await prisma.journeyStory.update({ where: { id: f.id },
      data: { status: "published", slug: f.slug } });
    console.log(r.status, r.slug);
  }
})().finally(() => prisma.$disconnect());
