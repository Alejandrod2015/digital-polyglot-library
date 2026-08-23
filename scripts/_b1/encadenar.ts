/**
 * Encadena los journeys de Espana: a0 Friends -> a1 Traveler -> b1 Traveler.
 *
 * `Journey.nextJourneyId` existe desde el 2026-08-18, cuando un beta tester iba
 * 13/21 en el A0 de Espana y 0/21 en el A1 recien publicado sin que nada le
 * dijera que existia. Los diez journeys de espanol seguian con el puntero
 * vacio.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const A0 = "cmrr5hnbl000032k1esry5n8g"; // Friends spain a0
const A1 = "cmsvz6mz9000732gsgsfer0ko"; // Traveler spain a1
const B1 = "cmt5x67ze000l320cpgunu5vi"; // Traveler spain b1
(async () => {
  const dry = process.argv.includes("--dry");
  for (const [de, a] of [[A0, A1], [A1, B1]] as const) {
    const j = await p.journey.findUnique({ where: { id: de } });
    const k = await p.journey.findUnique({ where: { id: a } });
    const x = j as unknown as Record<string, unknown>;
    const y = k as unknown as Record<string, unknown>;
    if (!j || !k) { console.error("falta un journey"); process.exit(1); }
    console.log(`${x.name}/${x.variant}${JSON.stringify(x.levels)} -> ${y.name}/${y.variant}${JSON.stringify(y.levels)}${x.nextJourneyId ? `  (ya apuntaba a ${x.nextJourneyId})` : ""}`);
    if (!dry) await p.journey.update({ where: { id: de }, data: { nextJourneyId: a } });
  }
  console.log(dry ? "\n--dry: nada escrito." : "\ncadena escrita.");
})().finally(() => p.$disconnect());
