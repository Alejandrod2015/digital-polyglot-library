/**
 * QUE ME QUEDA. La pool del Traveler ES/spain A2.
 *
 * Cubo de tolerancia CERO = lo que ya ensena un Traveler del POOL DE VARIANTE
 * de Espana (A1 y B1). Cubo blando (tope 2 por historia) = los journeys de
 * OTRO tipo del mismo pool (el Friends A0). Fuera del pool de variante no
 * cuenta: a un alumno de Espana no se le sirve el Traveler LATAM.
 *
 *   npx tsx scripts/_a2/pool.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { SPANISH_A1_A2_LEMMAS } from "../../src/lib/cefr/spanishA1A2";
import { variantPool } from "../../packages/domain/src/languageVariant";

const prisma = new PrismaClient();
const lema = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

(async () => {
  const rows = await prisma.journeyStory.findMany({
    where: { journey: { language: "spanish", status: { not: "archived" } } },
    select: { vocab: true, journey: { select: { typeSlug: true, variant: true, levels: true } } },
  });
  const MI = variantPool("spain");
  const duro = new Map<string, Set<string>>();
  const blando = new Map<string, Set<string>>();
  for (const r of rows) {
    const j = r.journey!;
    if (variantPool(j.variant) !== MI) continue;
    const dest = j.typeSlug === "traveler" ? duro : blando;
    const eti = `${j.typeSlug}/${(j.levels ?? []).join("+")}`;
    for (const v of ((r.vocab as Array<{ word?: string }> ?? []))) {
      if (!v?.word) continue;
      const l = lema(String(v.word));
      if (!dest.has(l)) dest.set(l, new Set());
      dest.get(l)!.add(eti);
    }
  }
  const orig = [...SPANISH_A1_A2_LEMMAS];
  const libres = orig.filter((w) => !duro.has(lema(w))).sort((a, b) => a.localeCompare(b, "es"));
  const conTope = libres.filter((w) => blando.has(lema(w)));
  fs.writeFileSync("scripts/_a2/pool-libre.txt", libres.join("\n") + "\n");
  fs.writeFileSync("scripts/_a2/pool-tope2.txt", conTope.join("\n") + "\n");
  fs.writeFileSync("scripts/_a2/ocupadas.txt",
    [...duro].sort().map(([l, s]) => `${l}\t${[...s].join(",")}`).join("\n") + "\n");
  console.log(`lista A1+A2 ................. ${orig.length}`);
  console.log(`cubo CERO (traveler/spain) .. ${duro.size} lemas`);
  console.log(`cubo blando (friends/spain) . ${blando.size} lemas`);
  console.log(`LIBRES ...................... ${libres.length}  (${conTope.length} con tope 2/historia)`);
})().finally(() => prisma.$disconnect());
