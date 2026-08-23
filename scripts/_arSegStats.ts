/**
 * Mide, parrafo a parrafo, el segmento que hay EN LA CACHE de una historia:
 * duracion, ritmo, sonoridad (LUFS) y rango de tono. Solo lee: ni sintetiza ni
 * escribe. Sirve para responder "por que suena exagerado este parrafo" con
 * numeros en vez de con una teoria.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_arSegStats.ts --slug=el-sobre-del-dueno
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { execFile } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { promisify } from "util";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { multivoiceSegmentCacheKey, softenPunctuationForTts } from "../src/lib/elevenlabs";
import { getPublicObjectUrl } from "../src/lib/objectStorage";

const execFileAsync = promisify(execFile);
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const SLUG = arg("slug") ?? "el-sobre-del-dueno";
const VOICE = arg("voice") ?? "p7AwDmKvTdoHTBuueGvP";
const DIR = path.resolve(process.env.TMPDIR ?? "/tmp", "arsegs");

async function lufs(f: string): Promise<string> {
  try {
    const { stderr } = await execFileAsync("ffmpeg", ["-v", "info", "-i", f, "-filter:a", "loudnorm=print_format=json", "-f", "null", "-"]);
    const m = stderr.match(/"input_i"\s*:\s*"(-?[\d.]+)"/);
    return m ? `${Number(m[1]).toFixed(1)} LUFS` : "?";
  } catch { return "?"; }
}

async function pitch(f: string): Promise<string> {
  const py = path.join(process.env.HOME || "", ".cache", "dpl-qa", "venv", "bin", "python");
  const code = `
import sys, parselmouth, numpy as np
s = parselmouth.Sound(sys.argv[1]).to_pitch()
v = s.selected_array['frequency']; v = v[v > 0]
print(f"{np.percentile(v,10):.0f}-{np.percentile(v,90):.0f} Hz  mediana {np.median(v):.0f}  rango {np.percentile(v,90)-np.percentile(v,10):.0f}")
`;
  try {
    const { stdout } = await execFileAsync(py, ["-c", code, f]);
    return stdout.trim();
  } catch (e) { return `sin praat (${(e as Error).message.slice(0, 40)})`; }
}

(async () => {
  const prisma = new PrismaClient();
  const s = await prisma.journeyStory.findFirst({ where: { slug: SLUG }, select: { text: true, title: true } });
  await prisma.$disconnect();
  if (!s?.text) throw new Error(`sin historia ${SLUG}`);
  mkdirSync(DIR, { recursive: true });
  const parrafos = s.text.split("\n\n");
  console.log(`${SLUG}: ${parrafos.length} parrafos\n`);
  for (const [i, p] of parrafos.entries()) {
    const key = multivoiceSegmentCacheKey(VOICE, softenPunctuationForTts(p), "eleven_multilingual_v2" as never, undefined, true);
    const url = getPublicObjectUrl(key);
    if (!url) { console.log(`p${i}: sin url`); continue; }
    const r = await fetch(url);
    if (!r.ok) { console.log(`p${i}: NO esta en la cache (${r.status})`); continue; }
    const f = path.join(DIR, `p${i}.mp3`);
    writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    const { stdout: dur } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f]);
    const palabras = p.split(/\s+/).length;
    const citadas = (p.match(/“([^”]*)”/g) ?? []).join(" ").split(/\s+/).filter(Boolean).length;
    console.log(`p${i}  ${Number(dur).toFixed(1)}s  ${(palabras / Number(dur)).toFixed(2)} pal/s  ${await lufs(f)}  ${await pitch(f)}  citadas ${Math.round((100 * citadas) / palabras)}%`);
  }
  console.log(`\nmp3 en ${DIR}`);
})().catch((e) => { console.error(e); process.exit(1); });
