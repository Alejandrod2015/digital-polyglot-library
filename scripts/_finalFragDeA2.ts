/** Lleva el FINAL del ultimo fragmento de una historia al final real del
 *  master. Toca un solo numero, `endSec` de ese fragmento, y nada mas.
 *
 *  WHY (2026-09-23): _rerollSection se niega a empalmar cuando la frontera cae
 *  sobre voz, y en brot-und-salz-fuer-die-neue el final del fragmento 4 estaba
 *  0,33 s antes del final del audio. La via normal es _remeasureFragments, pero
 *  ahi no logro anclar cuatro de los cinco fragmentos y proponia tiempos
 *  absurdos (el titulo ocupando 15 s), que es la averia que corrompio cinco
 *  historias del FR A2. Esto hace lo minimo y comprobable.
 *
 *  Uso: npx tsx scripts/_finalFragDeA2.ts <slug> [--si] */
import "./_loadEnv";
import { execFileSync } from "child_process";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const slug = process.argv[2];
  const s: any = await p.journeyStory.findFirst({ where: { journeyId: "cmubidgaf0007j8np6g7n89iu", slug } });
  if (!s?.audioUrl) throw new Error(`${slug} no tiene audio`);
  const fr: any[] = [...((s.audioFragments ?? []) as any[])].sort((a, b) => a.index - b.index);
  const ultimo = fr[fr.length - 1];
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", s.audioUrl]).toString().trim());
  console.log(`${slug}: master ${dur.toFixed(2)}s · fragmento ${ultimo.index} acaba en ${Number(ultimo.endSec).toFixed(2)}s`);
  if (Number(ultimo.endSec) >= dur) { console.log("ya llega al final; nada que hacer"); await p.$disconnect(); return; }
  console.log(`  ${Number(ultimo.endSec).toFixed(2)} -> ${dur.toFixed(2)} (${(dur - Number(ultimo.endSec)).toFixed(2)}s mas)`);
  if (!process.argv.includes("--si")) { console.log("\nen seco: nada escrito. Repite con --si."); await p.$disconnect(); return; }
  const nuevos = fr.map((f) => (f.index === ultimo.index ? { ...f, endSec: dur } : f));
  await p.journeyStory.update({ where: { id: s.id }, data: { audioFragments: nuevos as object } });
  console.log("escrito. Los otros fragmentos no se han tocado.");
  await p.$disconnect();
})();
