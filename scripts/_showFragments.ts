import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const s = await p.journeyStory.findFirst({
    where: { slug: process.argv[2] },
    select: { title: true, text: true, audioFragments: true, audioSegments: true },
  });
  const frags = (s?.audioFragments as unknown as Array<{ text?: string }> | null) ?? null;
  console.log(`${s?.title} · audioFragments: ${frags ? frags.length : "(ninguno)"}`);
  if (frags) frags.forEach((f, i) => console.log(`  [${i}] ${(f.text ?? "").slice(0, 120)}`));
  else (s?.text ?? "").split(/\n\s*\n/).forEach((para, i) => console.log(`  [${i}] ${para.slice(0, 120)}`));
})().finally(()=>p.$disconnect());
