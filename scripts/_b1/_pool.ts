/**
 * El pool de palabras usables como plaza de vocab del B1, con la MISMA
 * consulta y la MISMA normalizacion que `scripts/saveStory.ts`. Si divergen,
 * el pool miente y el gate lo caza tarde. Solo lectura.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { SPANISH_A1_A2_LEMMAS } from "../../src/lib/cefr/spanishA1A2";
import { SPANISH_B1_LEMMAS } from "../../src/lib/cefr/spanishB1";
import { variantPool } from "@domain/languageVariant";

const MIO = "cmt5x67ze000l320cpgunu5vi";
// Identica a la de saveStory: minusculas, sin tildes. `stripPrefix` solo actua
// en aleman, asi que en espanol no quita nada.
const lema = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const p = new PrismaClient();
(async () => {
  const mio = await p.journey.findUnique({ where: { id: MIO }, select: { language: true, typeSlug: true, variant: true } });
  if (!mio) throw new Error("journey no encontrado");
  const otras = await p.journeyStory.findMany({
    where: { journey: { language: mio.language, status: { not: "archived" } }, journeyId: { not: MIO } },
    select: { vocab: true, journey: { select: { typeSlug: true, variant: true } } },
  });
  const duro = new Set<string>(); const blando = new Set<string>();
  // Mismo criterio que saveStory: el cubo duro es mismo tipo Y mismo pool de
  // variante, con el fallback del lado estricto.
  const miPool = variantPool(mio.variant);
  const mismaVariante = (v?: string | null) => {
    const suyo = variantPool(v);
    if (!miPool || !suyo) return true;
    return miPool === suyo;
  };
  for (const r of otras) {
    if (!mismaVariante(r.journey?.variant)) continue;
    const destino = mio.typeSlug && r.journey?.typeSlug === mio.typeSlug ? duro : blando;
    for (const v of ((r.vocab as Array<{ word?: unknown }> | null) ?? [])) if (v?.word) destino.add(lema(String(v.word)));
  }
  const propias = await p.journeyStory.findMany({ where: { journeyId: MIO }, select: { vocab: true } });
  for (const r of propias) for (const v of ((r.vocab as Array<{ word?: unknown }> | null) ?? [])) if (v?.word) duro.add(lema(String(v.word)));

  const upToB1 = [...new Set([...SPANISH_A1_A2_LEMMAS, ...SPANISH_B1_LEMMAS])];
  const limpio = upToB1.filter((w) => !duro.has(lema(w)) && !blando.has(lema(w)));
  console.log(`mismo tipo (tope 0): ${duro.size} lemas · otros tipos (tope 2): ${blando.size} lemas`);
  console.log(`lista hasta B1: ${upToB1.length} · pool limpio: ${limpio.length}`);
  fs.writeFileSync("scripts/_b1/pool-limpio.txt", limpio.sort().join("\n"));
})().finally(() => p.$disconnect());
