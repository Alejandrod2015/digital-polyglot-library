import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { execFileSync, spawnSync } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";
import { uploadPublicObject } from "../src/lib/objectStorage";
import { rapidasDe } from "./checkNarrationPace";
import { checkMasterCoverage } from "./coverageWhisperCheck";
import { boundaryFor } from "./silenceBoundaryLib";

const p = new PrismaClient();
const norm = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();

function silencios(url: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  // d=0.12: el MISMO umbral que assertCorteEnSilencio en produccion
  // (audioEditorSections.ts), para no medir con un criterio distinto del
  // que el splice real va a exigir despues.
  const r = spawnSync("ffmpeg", ["-i", url, "-af", "silencedetect=noise=-35dB:d=0.12", "-f", "null", "-"], { encoding: "utf8" });
  const err = String(r.stderr ?? "");
  let ini: number | null = null;
  for (const m of err.matchAll(/silence_(start|end): ([\d.]+)/g)) {
    if (m[1] === "start") ini = Number(m[2]);
    else if (ini !== null) { out.push([ini, Number(m[2])]); ini = null; }
  }
  return out;
}
// alSilencio() (la version anterior, propia de este archivo) ya no existe:
// la frontera de corte vive en silenceBoundaryLib.ts (boundaryFor).
// Diferencia real que importa aqui (2026-09-15): este script agrupa por
// PARRAFO acumulando palabras de `audioSegments`, y el punto que le pasaba a
// alSilencio() era el arranque BRUTO del siguiente grupo (`grupos[i+1].start`),
// no un punto medio entre oraciones reales. Eso hacia que el "contenedor"
// (bbf20063) recentrara al medio de un hueco ANCHO y mal medido -perdiendo
// una frase entera del master ("la boule au ventre", ver
// scripts/__tests__/silenceBoundaryLib.test.ts). El arreglo real es doble:
// 1) estimar el limite como el punto medio entre el FIN de la ultima
//    oracion del grupo anterior y el INICIO de la primera del siguiente
//    (mas preciso que el arranque bruto de un grupo), y
// 2) boundaryFor() prefiere ese estimado tal cual si ya cae en un hueco
//    real, y solo recentra cuando no cae en ninguno.

(async () => {
  const slug = process.argv[2];
  const originalUrl = process.argv[3];
  if (!slug || !originalUrl) throw new Error("uso: <slug> <originalUrl>");

  const s = await p.journeyStory.findFirst({ where: { slug }, select: { id: true, title: true, text: true, journey: { select: { language: true } } } });
  if (!s) throw new Error("no story");

  await p.journeyStory.update({
    where: { id: s.id },
    data: { audioUrl: originalUrl, audioFilename: `${slug}-original.mp3`, audioStatus: "ready" },
  });
  console.log("audioUrl -> ORIGINAL:", originalUrl);
  await generateWordTimingsForStory(s.id);
  console.log("alineacion OK (Modal, contra el original)");

  const cov = await checkMasterCoverage(originalUrl, s.text, s.journey.language, s.title);
  console.log("cobertura:", cov.ok ? "OK" : "FALLA");
  cov.gaps.forEach((g) => console.log("  HUECO:", g.textWords.join(" ")));
  cov.duplicates.forEach((d) => console.log("  DUP:", d.words.join(" ")));
  if (!cov.ok) { console.log("NO SIGO: el original no esta limpio."); await p.$disconnect(); return; }

  const fin = await p.journeyStory.findUnique({ where: { id: s.id }, select: { audioSegments: true } });
  const segs = ((fin?.audioSegments as any[]) ?? []).filter((g) => g && g.endSec > g.startSec);
  const rap = rapidasDe(segs as any, []);
  console.log("\noraciones rapidas (sin corregir, decision del usuario):");
  rap.forEach((r) => console.log(`  ${r.ws.toFixed(2)} w/s (med ${r.mediana.toFixed(2)}) :: ${r.texto}`));

  // Deriva fragmentos por parrafo (para poder re-tirar despues si hace falta)
  const paras = String(s.text).split(/\n\n+/).map((x) => x.trim()).filter(Boolean);
  const grupos: { start: number; end: number; lastIdx: number }[] = [];
  let si = 0;
  for (const para of paras) {
    const objetivo = norm(para).split(" ").filter(Boolean).length;
    let acum = 0;
    const inicio = segs[si]?.startSec;
    let fin2 = inicio;
    let lastIdx = si;
    while (si < segs.length && acum < objetivo) {
      acum += norm(segs[si].text).split(" ").filter(Boolean).length;
      fin2 = segs[si].endSec;
      lastIdx = si;
      si++;
    }
    grupos.push({ start: inicio, end: fin2, lastIdx });
  }
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", originalUrl], { encoding: "utf8" }).trim());
  const sils = silencios(originalUrl);
  // Estimado = punto medio entre el FIN de la ultima oracion del grupo
  // anterior y el INICIO de la primera del siguiente (no el arranque bruto
  // de un grupo: ver la nota de arriba sobre "la boule au ventre").
  const estimar = (finPrev: number, inicioNext: number) => (finPrev + inicioNext) / 2;
  const bounds: { index: number; startSec: number; endSec: number; text: string }[] = [
    { index: 0, startSec: 0, endSec: grupos[0] ? boundaryFor(estimar(0, grupos[0].start), sils) : 0, text: s.title },
  ];
  grupos.forEach((gr, i) => {
    const start = i === 0 ? bounds[0].endSec : boundaryFor(estimar(segs[grupos[i - 1].lastIdx].endSec, gr.start), sils);
    const end = i === grupos.length - 1 ? dur : boundaryFor(estimar(segs[gr.lastIdx].endSec, grupos[i + 1].start), sils);
    bounds.push({ index: i + 1, startSec: start, endSec: end, text: paras[i] });
  });
  let ordenOk = true;
  for (let i = 1; i < bounds.length; i++) if (bounds[i].startSec < bounds[i - 1].startSec) ordenOk = false;
  const enSilencio = (t: number) => sils.some(([a, b]) => t >= a - 0.08 && t <= b + 0.08);
  const silenciosOk = bounds.slice(1).every((f) => enSilencio(f.startSec));
  console.log("\nlimites de fragmento: orden", ordenOk ? "OK" : "MAL", "· silencio", silenciosOk ? "OK" : "MAL");
  if (!ordenOk || !silenciosOk) { console.log("NO ESCRIBO fragmentos (fallo de guard)."); await p.$disconnect(); return; }

  // Secciones por fragmento (para poder re-tirar con _rerollSection despues)
  const dir = mkdtempSync(path.join(tmpdir(), "sec-"));
  const master = path.join(dir, "master.mp3");
  writeFileSync(master, Buffer.from(await (await fetch(originalUrl)).arrayBuffer()));
  const outFrags: any[] = [];
  let prevUrl: string | null = null;
  for (const f of bounds) {
    const secFile = path.join(dir, `sec${f.index}.mp3`);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", master, "-ss", String(f.startSec), "-to", String(f.endSec), "-c:a", "libmp3lame", "-q:a", "2", secFile]);
    const up = await uploadPublicObject({ key: `media/generated/audio/sections/${slug}-sec${f.index}-restore.mp3`, body: readFileSync(secFile), contentType: "audio/mpeg" });
    if (!up) throw new Error("upload fallo");
    outFrags.push({ ...f, url: up.url, speaker: "narrator", voiceId: "ucMmKRQbfDEYyb2IIGax", prevUrl });
    prevUrl = up.url;
  }
  await p.journeyStory.update({ where: { id: s.id }, data: { audioFragments: outFrags as any } });
  console.log("fragmentos con url escritos");

  await p.$disconnect();
})();
