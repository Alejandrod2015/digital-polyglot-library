import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function run(){
const t = await prisma.topic.findMany({ orderBy: { slug: "asc" } });
console.log(`${t.length} temas en dp_topics_v1`);
console.log(t.map(x=>`${x.slug} = ${x.label}${x.isUniversal?" [univ]":""}`).join("\n"));
const jt = await prisma.journeyType.findMany({ select: { id:true, slug: true, label: true } });
console.log("\ntipos:", jt.map(x=>`${x.slug}(${x.label})`).join(" · "));
await prisma.$disconnect();
}
run();
