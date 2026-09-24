/**
 * Mide en local, para las 21 a la vez, el cruce de vocab contra los OTROS
 * journeys de espanol (`vocab-taught-elsewhere`, tope 2 por historia).
 *
 * Solo LEE. Repite la logica del saver: se salta la capa portable (verbo,
 * adjetivo, adverbio, expresion), se salta el mismo tipo en otro nivel y solo
 * cuenta dentro del mismo pool de variante.
 *
 *   npx tsx scripts/_esLatamA0Conversations/cruzaElsewhere.ts
 */
import fs from "fs";
import path from "path";
import { PrismaClient } from "../../src/generated/prisma";
import { variantPool } from "@domain/languageVariant";

const JID = "cmub5my8d000432ye0v6pv5ng";
const DIR = "scripts/_esLatamA0Conversations";
const prisma = new PrismaClient();

(async () => {
  const mio = await prisma.journey.findUnique({
    where: { id: JID }, select: { language: true, typeSlug: true, variant: true },
  });
  if (!mio) throw new Error("no existe el journey");
  const otras = await prisma.journeyStory.findMany({
    where: { journey: { language: mio.language, status: { not: "archived" } }, journeyId: { not: JID } },
    select: { vocab: true, journey: { select: { typeSlug: true, levels: true, variant: true } } },
  });
  const miPool = variantPool(mio.variant);
  const PORTABLES = new Set(["verb", "adjective", "adverb", "expression"]);
  const fuera = new Set<string>();
  for (const r of otras) {
    const suyo = variantPool(r.journey?.variant);
    if (miPool && suyo && miPool !== suyo) continue;
    const mismoTipo = !!mio.typeSlug && r.journey?.typeSlug === mio.typeSlug;
    const mismoNivel = (r.journey?.levels ?? []).some((l) => String(l).toLowerCase() === "a0");
    for (const v of ((r.vocab as Array<{ word?: unknown; type?: unknown }> | null) ?? [])) {
      if (!v?.word) continue;
      if (PORTABLES.has(String(v.type ?? "").toLowerCase())) continue;
      if (mismoTipo && !mismoNivel) continue;
      fuera.add(String(v.word));
    }
  }
  const lema = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const ya = new Set([...fuera].map(lema));

  let rojas = 0;
  for (const f of fs.readdirSync(DIR).filter((x) => /^tema\d\.json$/.test(x)).sort()) {
    for (const s of JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as Array<{
      topic: string; slotIndex: number; vocab: Array<{ word: string; surface?: string }>;
    }>) {
      const hits = s.vocab.filter((v) => ya.has(lema(String(v.word)))).map((v) => v.surface ?? v.word);
      if (!hits.length) continue;
      if (hits.length > 2) rojas++;
      console.log(`${hits.length > 2 ? "ROJO" : "aviso"} ${s.topic}#${s.slotIndex}: ${hits.length}/20 · ${hits.join(", ")}`);
      if (hits.length > 2) {
        // Candidatas: palabras del cuerpo que ni ensena este journey ni otro.
        const dentro = new Set<string>();
        for (const f2 of fs.readdirSync(DIR).filter((x) => /^tema\d\.json$/.test(x)))
          for (const s2 of JSON.parse(fs.readFileSync(path.join(DIR, f2), "utf8")) as any[])
            for (const v of s2.vocab) { dentro.add(lema(v.word).replace(/^(el|la|los|las|un|una) /, "")); dentro.add(lema(v.surface ?? v.word)); }
        const libres = [...new Set((((s as any).text as string).match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g) ?? [])
          .filter((w) => w[0] === w[0].toLowerCase() && w.length > 3)
          .filter((w) => !dentro.has(lema(w)) && !ya.has(lema(w))))];
        console.log(`     libres y no ensenadas fuera: ${libres.join(", ") || "(ninguna)"}`);
      }
    }
  }
  console.log(`${ya.size} lemas los ensena otro journey de espanol · historias en rojo: ${rojas}`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
