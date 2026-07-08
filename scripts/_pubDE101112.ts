import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const fixes = [
    { id: "cmr92f1ra000k32ffi2b16n6a", slug: "zustaendig-ist-ein-anderes-amt" },
    { id: "cmr92f1u6000m32ffwnc1z87w", slug: "ein-brief-kuendigt-briefe-an" },
    { id: "cmr92f1x2000o32ff2zcqi8uv", slug: "endgegner-auslaenderbehoerde" },
  ];
  for (const f of fixes) {
    const r = await prisma.journeyStory.update({ where: { id: f.id },
      data: { status: "published", slug: f.slug } });
    console.log(r.status, r.slug);
  }
})().finally(() => prisma.$disconnect());
