/** Sonda de solo lectura: pasa los 7 temas del Friends FR A2 por el porton de evidencia. No escribe nada. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded } from "../src/lib/topicEvidence";
const prisma = new PrismaClient();
const TEMAS = ["Home Life & Habits","Jokes & Memories","Family & Manners","Housework & Fairness","Arguments & Apologies","Ceremonies & Public Speaking","Homesickness & Belonging"];
const slug = (l: string) => l.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
async function main() {
  const existentes = (await prisma.journey.findMany({ where:{language:"french", status:{not:"archived"}}, select:{topics:true}})).flatMap(j=>j.topics);
  const labels = (await prisma.topic.findMany({ where:{slug:{in:existentes}}, select:{label:true}})).map(t=>t.label);
  const choque = await prisma.topic.findMany({ where:{ label:{ in: TEMAS } }, select:{slug:true,label:true} });
  console.log("labels ya existentes en dp_topics:", choque); console.log("slugs ya existentes:", await prisma.topic.findMany({ where:{ slug:{ in: TEMAS.map(slug) } }, select:{slug:true} })); console.log(TEMAS.map(slug).join(" "));
  await assertTopicsGrounded({ language:"French", proposals: TEMAS.map(label=>({label, slug: slug(label)})), journeyEvidence:["I plan to move there in 6-8 months","still struggle feeling  confident with my comprehension"], existingLabels: labels, prisma });
  console.log("PORTON OK");
}
main().catch(e=>{console.error("FALLO:", e.message); process.exit(1)}).finally(()=>prisma.$disconnect());
