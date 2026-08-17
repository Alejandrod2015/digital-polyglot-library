import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  for (const [etiqueta, where] of [
    ["PT-BR", { language:{ equals:"portuguese", mode:"insensitive" as const } }],
    ["ES-Spain", { language:{ equals:"spanish", mode:"insensitive" as const }, variant:"spain" }],
  ] as const) {
    const j = await p.journey.findFirst({ where:{ ...where, status:{ notIn:["archived","draft"] } }, select:{ id:true } });
    const st = await p.journeyStory.findMany({ where:{ journeyId:j!.id, status:"published" }, select:{ title:true, text:true }, orderBy:{ slotIndex:"asc" }, take:2 });
    for (const s of st) console.log(`\n══════ ${etiqueta} · ${s.title}\n${s.text}`);
  }
})().finally(()=>p.$disconnect());
