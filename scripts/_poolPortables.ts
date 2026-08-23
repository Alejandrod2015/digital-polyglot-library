/**
 * ¿Cuántas palabras PORTABLES libres quedan para diseñar la escalera de un
 * journey PT-BR A1? Portable = de uso diario, no atada a una escena.
 * Libre = en la lista A1-A2 y no enseñada por otro journey del mismo tipo.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { PORTUGUESE_A1_A2_LEMMAS } from "../src/lib/cefr/portugueseA1A2";
const p = new PrismaClient();
async function main() {
  const otras = await p.journeyStory.findMany({
    where: { journey: { language: "portuguese", typeSlug: "traveler", status: { not: "archived" } }, journeyId: { not: "cmsyrge55000732u9oiu8wue3" } },
    select: { vocab: true },
  });
  const bloq = new Set<string>();
  for (const r of otras) for (const v of ((r.vocab as any[]) ?? [])) bloq.add(String(v.word).toLowerCase());
  const lista = [...PORTUGUESE_A1_A2_LEMMAS].map((w) => String(w).toLowerCase());
  const libres = lista.filter((w) => !bloq.has(w));
  console.log(`lista A1-A2: ${lista.length} · bloqueadas por el A0: ${bloq.size} · libres: ${libres.length}`);
  console.log("\nmuestra de libres:", libres.slice(0, 60).join(" "));
  await p.$disconnect();
}
main();
