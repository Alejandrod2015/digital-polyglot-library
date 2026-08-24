/** Que comparten de verdad los cuatro journeys de Espana: personajes y sitios.
 *  El reparto se saca de quien HABLA (nombre pegado a un verbo de habla), que
 *  es el mismo criterio que usa el gate de journey. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const SAY = "dice|dijo|pregunta|preguntó|contesta|contestó|responde|respondió|añade|añadió|cuenta|contó|explica|explicó|grita|gritó|llama|llamó|pide|pidió|repite|repitió|susurra|avisa|suelta|insiste";
const J = [
  ["cmrr5hnbl000032k1esry5n8g", "Friends a0"],
  ["cmsvz6mz9000732gsgsfer0ko", "Traveler a1"],
  ["cmt70xfyt000l3283gxd70wck", "Traveler a2"],
  ["cmt5x67ze000l320cpgunu5vi", "Traveler b1"],
] as const;
(async () => {
  const reparto: Record<string, Map<string, number>> = {};
  for (const [id, et] of J) {
    const st = await p.journeyStory.findMany({ where: { journeyId: id, text: { not: null } }, select: { text: true } });
    const m = new Map<string, number>();
    for (const s of st) {
      const vistos = new Set<string>();
      for (const re of [new RegExp(`(?:${SAY})\\s+([\\p{Lu}][\\p{Ll}áéíóúñ]+)`, "gu"),
                        new RegExp(`([\\p{Lu}][\\p{Ll}áéíóúñ]+)\\s+(?:${SAY})`, "gu")])
        for (const x of s.text!.matchAll(re)) vistos.add(x[1]);
      for (const n of vistos) m.set(n, (m.get(n) ?? 0) + 1);
    }
    reparto[et] = m;
  }
  const todos = [...new Set(Object.values(reparto).flatMap((m) => [...m.keys()]))]
    .filter((n) => Object.values(reparto).some((m) => (m.get(n) ?? 0) >= 2))
    .sort();
  console.log(`| Personaje | ${J.map(([, e]) => e).join(" | ")} |`);
  console.log(`|---|${J.map(() => "---").join("|")}|`);
  for (const n of todos) {
    const f = J.map(([, e]) => reparto[e].get(n) ?? 0);
    if (f.filter((x) => x > 0).length === 0) continue;
    console.log(`| ${n} | ${f.map((x) => (x ? `${x} hist.` : "-")).join(" | ")} |`);
  }
})().finally(() => p.$disconnect());
