/** Tabla de estado del A1 latam: etapas de produccion por tema, nada de
 *  metadata interna. Cuenta glosas contra el bundle y el audio del ejercicio
 *  en payload.audioClip.clipUrl, no en audioUrl. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A1 = "cmt5vxwgd0007324oesy195k8";
(async () => {
  const j = await p.journey.findUnique({ where: { id: A1 } });
  const bundle = JSON.parse(fs.readFileSync("src/data/tapGlosses/spanish-traveler-latam.json", "utf8"));
  const enBundle = new Set<string>(bundle.slugs);
  const filas = await p.journeyStory.findMany({ where: { journeyId: A1 },
    select: { slug: true, title: true, topic: true, slotIndex: true, status: true, text: true,
      vocab: true, audioUrl: true, coverUrl: true,
      practiceSet: { select: { exercises: { select: { payload: true } } } } } });
  const orden = j!.topics;
  filas.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  console.log(`${j!.name} · ${j!.language}/${j!.variant} · ${j!.levels.join(",")} · ${j!.status}\n`);
  console.log("| # | Tema | Escritas+vocab | Glosas tap | Práctica | Audio | Cover |");
  console.log("|---|---|---|---|---|---|---|");
  for (const [i, t] of orden.entries()) {
    const tres = filas.filter((f) => f.topic === t);
    const escritas = tres.filter((f) => f.text && ((f.vocab as unknown[]) ?? []).length >= 20).length;
    const glosas = tres.filter((f) => f.slug && enBundle.has(f.slug)).length;
    const prac = tres.filter((f) => (f.practiceSet?.exercises.length ?? 0) > 0).length;
    let clips = 0, ejer = 0;
    for (const f of tres) for (const e of f.practiceSet?.exercises ?? []) {
      ejer++;
      const c = (e.payload as { audioClip?: { clipUrl?: string | null } } | null)?.audioClip?.clipUrl;
      if (c) clips++;
    }
    const audio = tres.filter((f) => f.audioUrl).length;
    const cover = tres.filter((f) => f.coverUrl).length;
    console.log(`| ${i + 1} | ${t} | ${escritas}/3 | ${glosas}/3 | ${prac}/3 (${clips}/${ejer} clips) | ${audio}/3 | ${cover}/3 |`);
  }
  const pub = filas.filter((f) => f.status === "published").length;
  console.log(`\nestados: ${filas.length} filas · ${pub} published · ${filas.length - pub} draft`);
  await p.$disconnect();
})();
