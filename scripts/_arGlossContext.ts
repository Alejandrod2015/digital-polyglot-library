/**
 * Audita la regla "la glosa se escribe mirando la frase, no el diccionario"
 * (project_tap_glosses_contract) en el bundle del A0 argentino.
 *
 * `rebuildTapGlosses` COPIA del bundle hermano del mismo idioma antes de pedir
 * nada, y los hermanos son journeys C1 de otros paises: una glosa copiada trae
 * el contexto de OTRA escena. Este script no decide nada, solo pone al lado la
 * glosa y la frase real de este journey para poder leerlas juntas.
 *
 * Marca dos cosas:
 *   AMBIGUA  la glosa ofrece dos o mas sentidos separados por coma
 *   MULTI    la forma sale en 2+ historias y la glosa da un solo sentido
 *
 *   npx tsx scripts/_arGlossContext.ts [--todas] [--forma=<palabra>]
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "fs";
import { PrismaClient } from "../src/generated/prisma";

const JOURNEY = "cmt5vx8du000732fjgkwi59ks";
const BUNDLE = "src/data/tapGlosses/spanish-friends-argentina-a0.json";
const HERMANOS = [
  "spanish-friends.json", "spanish-friends-argentina.json", "spanish-friends-colombia.json",
  "spanish-friends-mexico.json", "spanish-friends-spain-a0.json", "spanish-traveler-latam.json",
  "spanish-traveler-mexico-a0.json",
];
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];

const cargar = (f: string) => {
  const b = JSON.parse(fs.readFileSync(`src/data/tapGlosses/${f}`, "utf8"));
  return (b.glosses ?? b) as Record<string, { g: string; t?: string }>;
};

(async () => {
  const mias = cargar(BUNDLE.split("/").pop()!);
  const sibs = HERMANOS.map(cargar);
  const prisma = new PrismaClient();
  const historias = await prisma.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    select: { slug: true, title: true, text: true, vocab: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  await prisma.$disconnect();

  // Las palabras del vocab curado de cada historia NO pasan por el bundle:
  // TapGlossLayer ignora el tap sobre `.vocab-word`. Solo se audita el resto.
  const curadas = new Set<string>();
  for (const h of historias) for (const v of (h.vocab as { word: string }[] ?? [])) curadas.add(v.word.toLowerCase());

  const frases = new Map<string, { slug: string; frase: string }[]>();
  for (const h of historias) {
    const texto = `${h.title}. ${h.text}`;
    for (const f of texto.split(/(?<=[.!?”])\s+/)) {
      for (const tok of new Set(f.toLowerCase().match(/\p{L}+/gu) ?? [])) {
        if (!mias[tok]) continue;
        const lista = frases.get(tok) ?? [];
        if (!lista.some((x) => x.slug === h.slug)) lista.push({ slug: h.slug, frase: f.trim() });
        frases.set(tok, lista);
      }
    }
  }

  const soloUna = arg("forma");
  let ambiguas = 0, multi = 0, sinUso = 0;
  const filas: string[] = [];
  for (const [forma, entrada] of Object.entries(mias)) {
    if (soloUna && forma !== soloUna) continue;
    if (curadas.has(forma)) continue;
    const usos = frases.get(forma);
    if (!usos?.length) { sinUso++; continue; }
    const copiada = sibs.some((s) => s[forma]?.g === entrada.g);
    const sentidos = entrada.g.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
    const esAmbigua = sentidos.length > 1 && !entrada.g.includes(";");
    const esMulti = usos.length > 1 && !entrada.g.includes(";");
    if (esAmbigua) ambiguas++;
    if (esMulti && !esAmbigua) multi++;
    if (!process.argv.includes("--todas") && !esAmbigua) continue;
    filas.push(
      `${forma.padEnd(16)} ${copiada ? "copiada" : "propia "} ${esAmbigua ? "AMBIGUA" : esMulti ? "MULTI  " : "       "} ` +
      `"${entrada.g}"\n${usos.slice(0, 2).map((u) => `      ${u.slug}: ${u.frase.slice(0, 110)}`).join("\n")}`,
    );
  }
  console.log(filas.join("\n"));
  console.log(`\nformas del bundle usadas en el journey: ${Object.keys(mias).length - sinUso} (${sinUso} huerfanas, ${curadas.size} son vocab curado)`);
  console.log(`glosas con dos sentidos por coma (AMBIGUA): ${ambiguas} · forma en 2+ historias con un solo sentido (MULTI): ${multi}`);
})().catch((e) => { console.error(e); process.exit(1); });
