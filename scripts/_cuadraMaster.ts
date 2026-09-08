/** Compara el master con la suma de sus secciones: si no cuadra, el empalme
 *  duplico o se comio audio. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { execFile } from "child_process"; import { promisify } from "util";
import { writeFileSync, mkdtempSync } from "fs"; import { tmpdir } from "os"; import path from "path";
const x = promisify(execFile); const prisma = new PrismaClient();
const dur = async (p: string) => Number((await x("ffprobe", ["-v","quiet","-show_entries","format=duration","-of","default=nw=1:nk=1",p])).stdout);
(async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "cuadra-"));
  for (const slug of process.argv.slice(2)) {
    const s = await prisma.journeyStory.findFirst({ where: { slug }, select: { audioUrl: true, audioFragments: true } });
    if (!s?.audioUrl) { console.log(`${slug}: sin audio`); continue; }
    const m = path.join(dir, `${slug}.mp3`);
    writeFileSync(m, Buffer.from(await (await fetch(s.audioUrl)).arrayBuffer()));
    const dm = await dur(m);
    const frags = (s.audioFragments as any[]) ?? [];
    let suma = 0; const filas: string[] = [];
    for (const [i, f] of frags.entries()) {
      const p = path.join(dir, `${slug}-${i}.mp3`);
      writeFileSync(p, Buffer.from(await (await fetch(String(f.url))).arrayBuffer()));
      const d = await dur(p);
      const decl = (f.endSec ?? 0) - (f.startSec ?? 0);
      suma += d;
      const delta = d - decl;
      filas.push(`   [${i}] real ${d.toFixed(2)}s · declarada ${decl.toFixed(2)}s · delta ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}${Math.abs(delta) > 0.12 ? "  <-- NO CUADRA" : ""}`);
    }
    const ultimo = frags.length ? (frags[frags.length - 1].endSec ?? 0) : 0;
    console.log(`\n${slug}: master ${dm.toFixed(2)}s · suma de secciones ${suma.toFixed(2)}s · fin declarado ${ultimo.toFixed(2)}s`);
    filas.forEach((l) => console.log(l));
  }
  await prisma.$disconnect();
})();
