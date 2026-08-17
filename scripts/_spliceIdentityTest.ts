// Prueba de identidad del empalme. NO gasta audio.
//
// Corta el fragmento N del máster y lo vuelve a pegar EN SU SITIO. Si el
// empalme es correcto, el resultado debe ser indistinguible del original. Si
// aparecen restos o huecos, el fallo está en el corte y no en la toma nueva,
// y se puede iterar sin pagar síntesis.
//
//   npx tsx scripts/_spliceIdentityTest.ts <slug> <fragmentIndex>
import { config } from "dotenv"; config({ path: ".env", quiet:true });
import { execFileSync, spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
type Frag = { index:number; startSec:number; endSec:number; text?:string };
const ff = (args:string[]) => spawnSync("ffmpeg", ["-v","error","-y",...args], { encoding:"utf8" });
const dur = (f:string) => Number(execFileSync("ffprobe", ["-v","error","-show_entries","format=duration","-of","csv=p=0", f], { encoding:"utf8" }).trim());

(async()=>{
  const [slug, idxRaw] = [process.argv[2], Number(process.argv[3])];
  const s = await p.journeyStory.findFirst({ where:{ slug }, select:{ audioUrl:true, audioFragments:true } });
  const frags = (s?.audioFragments as Frag[] | null) ?? [];
  const frag = frags.find(f => f.index === idxRaw);
  if (!s?.audioUrl || !frag) throw new Error("sin máster o sin ese fragmento");

  const dir = mkdtempSync(join(tmpdir(), "ident-"));
  try {
    const master = join(dir, "master.mp3");
    writeFileSync(master, Buffer.from(await (await fetch(s.audioUrl)).arrayBuffer()));
    const total = dur(master);
    const { startSec: a, endSec: b } = frag;
    console.log(`${slug} frag ${idxRaw}: ${a.toFixed(2)}-${b.toFixed(2)}s de ${total.toFixed(2)}s`);

    // 1. Extraer el trozo tal cual está en el máster.
    const seg = join(dir, "seg.mp3");
    ff(["-i", master, "-ss", String(a), "-to", String(b), "-c:a","libmp3lame","-b:a","192k", seg]);
    console.log(`   trozo extraído: ${dur(seg).toFixed(2)}s (esperado ${(b-a).toFixed(2)}s)`);

    // 2. Volver a pegarlo en su sitio, igual que hace spliceInPlace.
    const NORM = "aformat=channel_layouts=stereo:sample_rates=44100:sample_fmts=fltp";
    const parts:string[] = [], order:string[] = [];
    if (a > 0.02) { parts.push(`[0:a]atrim=0:${a.toFixed(3)},asetpts=PTS-STARTPTS,${NORM}[before]`); order.push("[before]"); }
    parts.push(`[1:a]${NORM}[seg]`); order.push("[seg]");
    if (b < total - 0.02) { parts.push(`[0:a]atrim=${b.toFixed(3)},asetpts=PTS-STARTPTS,${NORM}[after]`); order.push("[after]"); }
    const out = join(dir, "out.mp3");
    ff(["-i", master, "-i", seg, "-filter_complex", parts.join(";") + `;${order.join("")}concat=n=${order.length}:v=0:a=1[out]`, "-map","[out]","-c:a","libmp3lame","-b:a","192k", out]);
    const nuevo = dur(out);
    console.log(`   máster re-empalmado: ${nuevo.toFixed(2)}s (original ${total.toFixed(2)}s, diferencia ${(nuevo-total).toFixed(3)}s)`);

    // 3. Comparar en la frontera: ¿cuánta energía se ha desplazado?
    const corr = spawnSync("ffmpeg", ["-v","error","-i", master, "-i", out, "-filter_complex","[0:a][1:a]psnr","-f","null","-"], { encoding:"utf8" });
    const psnr = (String(corr.stderr).match(/average:([\d.]+)/) ?? [])[1];
    console.log(`   PSNR frente al original: ${psnr ?? "n/d"} dB  ${psnr && Number(psnr) > 40 ? "(idéntico)" : "(DIFIERE)"}`);
    writeFileSync(`_identity_${slug}_${idxRaw}.mp3`, readFileSync(out));
    console.log(`   escrito _identity_${slug}_${idxRaw}.mp3 para escuchar la costura`);
  } finally { rmSync(dir, { recursive:true, force:true }); }
})().catch(e=>{console.error("FALLÓ:", e instanceof Error?e.message:e); process.exit(1);}).finally(()=>p.$disconnect());
