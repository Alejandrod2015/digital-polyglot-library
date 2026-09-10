/** ¿Caen en silencio las fronteras guardadas? Es el invariante que exige el
 *  empalme; el desfase master-vs-ultimo-fragmento solo mide la cola de silencio. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  for (const slug of process.argv.slice(2)) {
    const s = await prisma.journeyStory.findFirst({ where: { slug }, select: { audioUrl: true, audioFragments: true } });
    if (!s?.audioUrl) { console.log(`${slug}: sin audio`); continue; }
    const dir = mkdtempSync(path.join(tmpdir(), "front-"));
    const m = path.join(dir, "m.mp3");
    writeFileSync(m, Buffer.from(await (await fetch(s.audioUrl)).arrayBuffer()));
    const r = spawnSync("ffmpeg", ["-i", m, "-af", "silencedetect=noise=-35dB:d=0.12", "-f", "null", "-"], { encoding: "utf8" });
    const sils: Array<[number, number]> = []; let ini: number | null = null;
    for (const x of String(r.stderr ?? "").matchAll(/silence_(start|end): ([0-9.]+)/g)) {
      if (x[1] === "start") ini = Number(x[2]); else if (ini !== null) { sils.push([ini, Number(x[2])]); ini = null; }
    }
    const dentro = (t: number) => sils.some(([a, b]) => t >= a - 0.08 && t <= b + 0.08);
    const frags = ((s.audioFragments as any[]) ?? []).slice().sort((a, b) => a.index - b.index);
    const malas = frags.map((f, i) => ({ f, i })).filter(({ f, i }) => i > 0 && !dentro(Number(f.startSec)));
    console.log(`${slug}: ${frags.length - 1 - malas.length}/${frags.length - 1} fronteras en silencio`);
    for (const { f } of malas) console.log(`   [${f.index}] ${Number(f.startSec).toFixed(2)}s · ${String(f.text ?? "").slice(0, 42)}`);
  }
  await prisma.$disconnect();
})();
