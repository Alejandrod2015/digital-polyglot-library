import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function run(){
const A0 = "cmss0fkc40007j8dub1zpa1kc";
const st = await prisma.journeyStory.findMany({ where: { journeyId: A0 }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
const all = new Map<string, number>();
let slots = 0;
for (const s of st) for (const v of ((s.vocab as any[]) ?? [])) { slots++; const t = String(v.term ?? v.word ?? "").trim(); all.set(t, (all.get(t) ?? 0) + 1); }
console.log(`slots=${slots} distinct=${all.size}`);
console.log([...all.keys()].sort((a,b)=>a.localeCompare(b,"it")).join(" | "));
console.log("\n=== sample vocab shape ===");
console.log(JSON.stringify(((st[0].vocab as any[]) ?? []).slice(0,4), null, 2));
await prisma.$disconnect();
}
run();
