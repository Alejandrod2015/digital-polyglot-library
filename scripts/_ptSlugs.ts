import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const s = await p.journeyStory.findMany({
    where: { journey: { language: { equals: "portuguese", mode: "insensitive" } }, status: "published" },
    select: { slug: true }, orderBy: { createdAt: "asc" },
  });
  console.log(s.map(x=>x.slug).filter(Boolean).join(" "));
})().finally(()=>p.$disconnect());
