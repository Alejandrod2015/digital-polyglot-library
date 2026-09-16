import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { execFileSync, spawnSync } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
const p = new PrismaClient();
const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();
function silencios(url: string): Array<[number, number]> {
  // d=0.12 (no 0.18): el MISMO umbral que usa assertCorteEnSilencio en
  // produccion (audioEditorSections.ts), para que este guard valide contra
  // el mismo criterio que el splice real va a aplicar. Con 0.18 las pausas
  // cortas entre parrafo y parrafo (~0.45s de hueco, pero con ruido de fondo
  // que no siempre cae bajo -35dB los 0.18s seguidos) no se detectaban como
  // silencio y el guard bloqueaba limites que el splice real SI acepta.
  const out: Array<[number, number]> = [];
  const r = spawnSync("ffmpeg", ["-i", url, "-af", "silencedetect=noise=-35dB:d=0.12", "-f", "null", "-"], { encoding: "utf8" });
  const err = String(r.stderr ?? "");
  let ini: number | null = null;
  for (const m of err.matchAll(/silence_(start|end): ([\d.]+)/g)) {
    if (m[1] === "start") ini = Number(m[2]); else if (ini !== null) { out.push([ini, Number(m[2])]); ini = null; }
  }
  return out;
}
function alSilencio(t: number, sils: Array<[number, number]>): number {
  // Si t cae DENTRO de un hueco real [a,b], ese es el hueco correcto: no
  // buscar mas lejos. El bug real (2026-09-15): la version anterior solo
  // miraba huecos que TERMINAN antes de t (b <= t+0.02), asi que un target
  // que cae dentro de un hueco AMPLIO (a <= t <= b) lo descartaba y snapeaba
  // a una pausa interna mas cercana pero incorrecta (la coma de una frase),
  // produciendo un corte a mitad de frase que duplicaba la cola de la
  // oracion siguiente al re-empalmar.
  const contenedor = sils.find(([a, b]) => t >= a - 0.02 && t <= b + 0.02);
  if (contenedor) return (contenedor[0] + contenedor[1]) / 2;
  let mejor = t, dist = Infinity;
  for (const [a, b] of sils) { if (b > t + 0.02) continue; const d = t - b; if (d < dist && d < 1.5) { dist = d; mejor = (a + b) / 2; } }
  return mejor === t ? Math.max(0, t - 0.06) : mejor;
}
(async () => {
  const slug = process.argv[2];
  const s = await p.journeyStory.findFirst({ where: { slug }, select: { id: true, title: true, text: true, audioUrl: true, audioSegments: true } });
  if (!s?.audioUrl) throw new Error("no story/audio");
  const segs = ((s.audioSegments as any[]) ?? []).filter((g) => g && g.endSec > g.startSec);
  const paras = String(s.text).split(/\n\n+/).map((x) => x.trim()).filter(Boolean);
  const grupos: { start: number; end: number; lastIdx: number }[] = [];
  let si = 0;
  for (const para of paras) {
    const objetivo = norm(para).split(" ").filter(Boolean).length;
    let acum = 0; const inicio = segs[si]?.startSec; let fin2 = inicio; let lastIdx = si;
    while (si < segs.length && acum < objetivo) { acum += norm(segs[si].text).split(" ").filter(Boolean).length; fin2 = segs[si].endSec; lastIdx = si; si++; }
    grupos.push({ start: inicio, end: fin2, lastIdx });
  }
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", s.audioUrl], { encoding: "utf8" }).trim());
  const sils = silencios(s.audioUrl);
  // Limite REAL entre fragmentos: el punto medio entre el fin de la ultima
  // oracion del grupo anterior y el inicio de la primera del siguiente,
  // medido directamente de los audioSegments (STT por oracion), NO
  // "snapeado" al hueco de silencio mas cercano detectado por ffmpeg.
  //
  // BUG real encontrado (2026-09-15): alSilencio() buscaba el hueco mas
  // cercano que TERMINA antes del target, asi que un target que cae DENTRO
  // de un hueco amplio (la pausa real entre fragmentos, que aqui mide hasta
  // 0.86s) lo descartaba, y snapeaba a una pausa INTERNA de la frase (una
  // coma) que quedaba mas cerca por la metrica de distancia. Eso cortaba a
  // mitad de frase y perdia o duplicaba contenido segun el fragmento.
  // Arreglo intermedio (contenedor: t dentro de [a,b]) trae el MISMO
  // problema al reves: una pausa interna AMPLIA (la de "arrivee, la boule au
  // ventre") puede CONTENER el target por pura cercania de las dos oraciones
  // en el guion, sin ser la pausa entre fragmentos.
  // El punto medio entre oraciones REALES (fin de una, inicio de la
  // siguiente) no tiene ese problema: es correcto salga o no dentro de un
  // hueco detectado, y `assertCorteEnSilencio` (dentro de spliceInPlace) ya
  // verifica de forma independiente, con su propio silencedetect, que el
  // punto elegido cae en silencio real antes de cortar nada.
  // El punto medio entre oraciones (fin de una, inicio de la siguiente) es
  // la mejor ESTIMACION, pero los timestamps de audioSegments no son
  // perfectos (aqui, una oracion medida hasta 72.54s en realidad se sigue
  // oyendo hasta 72.78s: 0.24s de margen de error de la transcripcion).
  // Si esa estimacion no cae en NINGUN hueco de silencio real, se usa el
  // centro del hueco real mas cercano por DISTANCIA (sin la restriccion
  // vieja de "solo huecos que terminan antes del target", que era el bug).
  const limite = (finPrev: number, inicioNext: number) => {
    const estimado = (finPrev + inicioNext) / 2;
    if (sils.some(([a, b]) => estimado >= a - 0.08 && estimado <= b + 0.08)) return estimado;
    let mejor = estimado, dist = Infinity;
    for (const [a, b] of sils) {
      const centro = (a + b) / 2;
      const d = Math.abs(estimado - centro);
      if (d < dist) { dist = d; mejor = centro; }
    }
    return mejor;
  };
  const bounds: { index: number; startSec: number; endSec: number; text: string }[] = [
    { index: 0, startSec: 0, endSec: grupos[0] ? limite(0, grupos[0].start) : 0, text: s.title },
  ];
  grupos.forEach((gr, i) => {
    const start = i === 0 ? bounds[0].endSec : limite(segs[grupos[i - 1].lastIdx].endSec, gr.start);
    const end = i === grupos.length - 1 ? dur : limite(segs[gr.lastIdx].endSec, grupos[i + 1].start);
    bounds.push({ index: i + 1, startSec: start, endSec: end, text: paras[i] });
  });
  void alSilencio; void sils; // se conservan por si hace falta comparar, sin usarse ya para el limite
  let ordenOk = true;
  for (let i = 1; i < bounds.length; i++) if (bounds[i].startSec < bounds[i - 1].startSec) ordenOk = false;
  const enSilencio = (t: number) => sils.some(([a, b]) => t >= a - 0.08 && t <= b + 0.08);
  const silenciosOk = bounds.slice(1).every((f) => enSilencio(f.startSec));
  console.log("limites: orden", ordenOk ? "OK" : "MAL", "· silencio", silenciosOk ? "OK" : "MAL");
  bounds.forEach((b) => console.log(` [${b.index}] ${b.startSec.toFixed(2)}-${b.endSec.toFixed(2)}  ${String(b.text).slice(0, 60)}`));
  if (!ordenOk || !silenciosOk) { console.log("NO ESCRIBO (fallo guard)"); await p.$disconnect(); return; }

  const dir = mkdtempSync(path.join(tmpdir(), "sec-"));
  const master = path.join(dir, "master.mp3");
  writeFileSync(master, Buffer.from(await (await fetch(s.audioUrl)).arrayBuffer()));
  const outFrags: any[] = [];
  let prevUrl: string | null = null;
  for (const f of bounds) {
    const secFile = path.join(dir, `sec${f.index}.mp3`);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", master, "-ss", String(f.startSec), "-to", String(f.endSec), "-c:a", "libmp3lame", "-q:a", "2", secFile]);
    const up = await uploadPublicObject({ key: `media/generated/audio/sections/${slug}-sec${f.index}-remeasure.mp3`, body: readFileSync(secFile), contentType: "audio/mpeg" });
    if (!up) throw new Error("upload fallo");
    outFrags.push({ ...f, url: up.url, speaker: "narrator", voiceId: "ucMmKRQbfDEYyb2IIGax", prevUrl });
    prevUrl = up.url;
  }
  await p.journeyStory.update({ where: { id: s.id }, data: { audioFragments: outFrags as any } });
  console.log("fragmentos re-medidos y escritos");
  await p.$disconnect();
})();
