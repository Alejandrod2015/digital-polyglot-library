/** Glosa en contexto: estas 30 venian copiadas de otro journey con el sentido
 *  que tenian ALLI. Se reescriben contra la frase donde caen aqui. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const FIX: Record<string, string> = {
  abre: "opens; abre Berta, Berta opens the meeting",
  alta: "en voz alta, out loud",
  billete: "banknote, the paper money in your hand",
  bombilla: "light bulb",
  casero: "landlord",
  cola: "glue",
  corta: "short; corta Berta, Berta cuts in",
  cuarto: "a fourth floor; also a room",
  cuenta: "por su cuenta, on their own",
  falta: "is missing; sin falta, without fail",
  final: "al final, in the end",
  golpe: "de golpe, all at once",
  mano: "hand",
  mira: "watches, keeps an eye on",
  muda: "se muda, moves house",
  oye: "se oye, one hears",
  pasa: "runs, passes something over",
  pega: "sticks, puts up",
  poco: "little; poco a poco, little by little",
  prueba: "tries, tests",
  sale: "sale o no sale, it passes or it does not",
  serio: "en serio, seriously",
  sobre: "above, on top of",
  suena: "sounds",
  tapa: "covers (tapar)",
  vez: "de una vez, once and for all",
  parte: "share, part",
  obra: "building work",
  orden: "el orden del día, the agenda",
  primera: "a la primera, first time",
};
(async () => {
  const p = new PrismaClient();
  const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "spanish-traveler-spain-b1", slug: "" } } });
  const g = f!.glosses as Record<string, { g: string; t?: string }>;
  let n = 0;
  for (const [w, nueva] of Object.entries(FIX)) {
    if (!g[w]) { console.log("  no existe:", w); continue; }
    if (g[w].g !== nueva) { g[w] = { ...g[w], g: nueva }; n++; }
  }
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: "spanish-traveler-spain-b1", slug: "" } }, data: { glosses: g } });
  console.log(`corregidas ${n} de ${Object.keys(FIX).length}`);
  await p.$disconnect();
})();
