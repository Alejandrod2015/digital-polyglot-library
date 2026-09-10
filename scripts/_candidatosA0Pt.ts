// Solo lectura: comprueba si los slugs y etiquetas candidatos del A0 PT ya existen en Topic.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const C = [
  ["rio-de-janeiro", "Greetings & Names"], ["belo-horizonte", "Family & Photos"], ["fortaleza", "Coffee & Breakfast"],
  ["porto-alegre", "Days & Plans"], ["natal", "Weather & Clothes"], ["sao-luis", "Rooms & Keys"], ["bonito", "Phones & Numbers"],
];
async function main() {
  for (const [slug, label] of C) {
    const s = await p.topic.findFirst({ where: { slug }, select: { label: true } });
    const l = await p.topic.findFirst({ where: { label: { equals: label, mode: "insensitive" } }, select: { slug: true } });
    const usos = await p.journey.findMany({ where: { topics: { has: slug } }, select: { language: true, levels: true, status: true } });
    console.log(`${slug} -> ${s ? `EXISTE "${s.label}"` : "libre"} | "${label}" -> ${l ? `EXISTE en ${l.slug}` : "libre"} | journeys: ${JSON.stringify(usos)}`);
  }
  const parecidas = await p.topic.findMany({ where: { OR: ["Greet", "Famil", "Coffee", "Breakfast", "Days", "Weather", "Rooms", "Phone", "Numbers", "Names"].map(w => ({ label: { contains: w, mode: "insensitive" as const } })) }, select: { slug: true, label: true } });
  console.log("etiquetas parecidas:", parecidas.map(t => `${t.slug}="${t.label}"`).join(" · "));
}
main().finally(() => p.$disconnect());
