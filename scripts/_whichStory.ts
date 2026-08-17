import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const needle = process.argv[2];
  const st = await p.journeyStory.findMany({
    where:{ journey:{ language:{ equals:"portuguese", mode:"insensitive" } }, status:"published" },
    select:{ slug:true, text:true },
  });
  for (const s of st) if (s.text?.includes(needle)) console.log(s.slug);
})().finally(()=>p.$disconnect());
