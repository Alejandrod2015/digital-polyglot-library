/** Sonda SIN ESCRITURA: el porton de escalera para un Friends DE germany b1. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertLadderContiguous } from "../src/lib/journeyLadder";
(async () => {
  const p = new PrismaClient();
  const ex = await p.journey.findMany({ select: { id:true,name:true,language:true,variant:true,levels:true,status:true } });
  try {
    assertLadderContiguous({ name:"Friends", language:"german", variant:"germany", levels:["b1"] }, ex as any);
    console.log("escalera: PASA (b1 rellena el hueco del Friends DE)");
  } catch (e:any) { console.log("escalera: TIRA -> " + e.message); }
  await p.$disconnect();
})();
