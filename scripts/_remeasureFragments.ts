// Re-mide los [startSec, endSec] de `audioFragments` contra el máster ACTUAL.
//
// POR QUÉ (2026-08-17). El empalme de `_rerollSection` corta el máster en los
// tiempos guardados, dando por hecho que caen en el silencio entre secciones.
// Los másters del A0 portugués llevan sufijo `_slow`: pasaron por
// `normalizeAudioPace` DESPUÉS de medirse los fragmentos, y el estirado
// desplazó todos los tiempos hasta 1,84s. El corte caía dentro de una palabra
// y el máster salía con restos ("l--", "n--", "tas--") justo en la costura.
//
// Aquí se localiza cada fragmento en el audio de verdad: se transcribe con
// marcas de tiempo por palabra y se busca dónde empieza y acaba el texto de
// cada fragmento. Después, cada frontera se lleva al silencio más cercano,
// que es donde un corte no parte nada.
//
//   npx tsx scripts/_remeasureFragments.ts <slug> [--apply]
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { execFileSync, spawnSync } from "child_process";
import { PrismaClient } from "../src/generated/prisma";
import { anclarFragmentos, tiemposDesordenados, norm, type Frag, type W } from "./remeasureFragmentsLib";

const p = new PrismaClient();
const apiKey = process.env.ELEVENLABS_API_KEY!;

async function transcribe(url:string): Promise<W[]> {
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const fd = new FormData();
  fd.append("model_id","scribe_v1");
  fd.append("timestamps_granularity","word");
  fd.append("file", new Blob([new Uint8Array(buf)], { type:"audio/mpeg" }), "s.mp3");
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method:"POST", headers:{ "xi-api-key":apiKey }, body:fd });
  if (!r.ok) throw new Error(`STT ${r.status}`);
  return (((await r.json()) as { words?:W[] }).words ?? []).filter(w => (w.type ?? "word") === "word" && norm(w.text));
}

/** Silencios del máster, para llevar cada frontera a un punto donde no hay voz. */
function silencios(url:string): Array<[number,number]> {
  const out: Array<[number,number]> = [];
  let err = "";
  try {
    const r = spawnSync("ffmpeg", ["-i", url, "-af", "silencedetect=noise=-35dB:d=0.18", "-f", "null", "-"], { encoding:"utf8" });
    err = String(r.stderr ?? "");
  } catch { /* sin ffmpeg: se sigue sin ajuste a silencio */ }
  let ini: number | null = null;
  for (const m of err.matchAll(/silence_(start|end): ([\d.]+)/g)) {
    if (m[1] === "start") ini = Number(m[2]);
    else if (ini !== null) { out.push([ini, Number(m[2])]); ini = null; }
  }
  return out;
}

/**
 * Frontera de corte para una palabra que empieza en `t`.
 *
 * Tiene que caer ANTES de que empiece la palabra, dentro del silencio que la
 * precede. Buscar "el silencio más cercano" no vale: si el más cercano es el
 * que viene DESPUÉS, el corte deja pegado el arranque de la palabra vieja y se
 * oye dos veces ("Bia, Bia desce", 2026-08-17).
 */
function alSilencio(t:number, sils:Array<[number,number]>): number {
  let mejor = t, dist = Infinity;
  for (const [a,b] of sils) {
    if (b > t + 0.02) continue;            // silencio posterior: no sirve
    const d = t - b;                        // cuánto antes de la palabra acaba
    if (d < dist && d < 1.5) { dist = d; mejor = (a + b) / 2; }
  }
  // Sin silencio previo utilizable, un margen fijo antes de la palabra es
  // mejor que cortar justo encima de ella.
  return mejor === t ? Math.max(0, t - 0.06) : mejor;
}

(async()=>{
  const slug = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!slug) throw new Error("uso: _remeasureFragments.ts <slug> [--apply]");
  const s = await p.journeyStory.findFirst({ where:{ slug }, select:{ id:true, audioUrl:true, audioFragments:true } });
  const frags = (s?.audioFragments as Frag[] | null) ?? [];
  if (!s?.audioUrl || !frags.length) throw new Error("sin máster o sin fragmentos");

  const dur = Number(execFileSync("ffprobe", ["-v","error","-show_entries","format=duration","-of","csv=p=0", s.audioUrl], { encoding:"utf8" }).trim());
  const words = await transcribe(s.audioUrl);
  const sils = silencios(s.audioUrl);
  console.log(`${slug}: máster ${dur.toFixed(2)}s · ${words.length} palabras oídas · ${sils.length} silencios`);

  // Se recorre la transcripción en orden, consumiendo las palabras de cada
  // fragmento. Así cada uno queda anclado donde suena de verdad. Lógica en
  // remeasureFragmentsLib.ts (testeada aparte, scripts/__tests__/).
  const orden = [...frags].sort((a,b)=>a.index-b.index);
  const { inicios, sinAnclar } = anclarFragmentos(orden, words);

  // GUARD DE ORDEN (2026-09-14). El índice de ancla es monótono por
  // construcción, pero el TIEMPO que trae la palabra en ese índice no lo es
  // siempre: scribe_v1 puede devolver `words[i].start` fuera de orden en un
  // tramo dudoso. Sin este chequeo, une-liste-dans-la-tete escribió un
  // fragmento con endSec menor que su propio startSec y nadie lo notó hasta
  // que el usuario lo oyó mal. Mismo criterio que el chequeo de silencio de
  // abajo: mejor no escribir que escribir tiempos invertidos.
  const desorden = tiemposDesordenados(orden, inicios, words);
  if (desorden.length) {
    console.log(`\n  NO SE ESCRIBE: timestamps del transcriptor fuera de orden en el/los fragmento(s) ${desorden.join(", ")}.`);
    console.log(`  El indice de ancla es correcto pero scribe_v1 devolvio su tiempo antes que el del fragmento previo.`);
    console.log(`  No hay arreglo automatico seguro aqui: revisar de oido o re-tirar ese fragmento por otra via.`);
    process.exitCode = 1;
    return;
  }

  const nuevos: Frag[] = [];
  for (let n = 0; n < orden.length; n++) {
    const f = orden[n];
    const iniIdx = inicios[n];
    const startBruto = Number(words[iniIdx]?.start ?? f.startSec);
    // El fin es el INICIO del siguiente: así no quedan huecos ni solapes.
    const sigIdx = inicios[n + 1];
    const endBruto = n === orden.length - 1 || sigIdx === undefined
      ? dur
      : Number(words[sigIdx]?.start ?? f.endSec);
    const start = n === 0 ? 0 : alSilencio(startBruto, sils);
    const end = n === orden.length - 1 ? dur : alSilencio(endBruto, sils);
    const antes = `${Number(f.startSec).toFixed(2)}-${Number(f.endSec).toFixed(2)}`;
    console.log(`  [${f.index}] ${antes}  ->  ${start.toFixed(2)}-${end.toFixed(2)}   ${String(f.text ?? "").slice(0,44)}`);
    nuevos.push({ ...f, startSec: Number(start.toFixed(3)), endSec: Number(end.toFixed(3)) });
  }

  // NINGUNA frontera puede caer sobre voz: es el mismo invariante que exige
  // assertCorteEnSilencio antes de empalmar, y escribir aqui un tiempo que ese
  // guard va a rechazar despues no ayuda a nadie. Si una no cae en silencio, se
  // dice cual y NO se escribe: unos tiempos viejos y sabidos son mejores que
  // unos nuevos y equivocados.
  const enSilencio = (t: number) => sils.some(([a, b]) => t >= a - 0.08 && t <= b + 0.08);
  const malas = nuevos
    .map((f, n) => ({ f, n }))
    .filter(({ f, n }) => n > 0 && !enSilencio(Number(f.startSec)));
  if (sinAnclar.length) console.log(`\n  sin anclar en la transcripcion: ${sinAnclar.join(", ")}`);
  if (malas.length) {
    console.log(`\n  NO SE ESCRIBE: ${malas.length} frontera(s) caen sobre voz:`);
    for (const { f } of malas) console.log(`    [${f.index}] ${Number(f.startSec).toFixed(2)}s · ${String(f.text ?? "").slice(0, 44)}`);
    process.exitCode = 1;
    return;
  }

  if (!apply) { console.log("\n[--dry] nada escrito. Repite con --apply."); return; }
  await p.journeyStory.update({ where:{ id:s.id }, data:{ audioFragments: nuevos as never } });
  console.log("\nfragmentos actualizados en la base");
})().catch(e=>{console.error("FALLÓ:", e instanceof Error?e.message:e); process.exit(1);}).finally(()=>p.$disconnect());
