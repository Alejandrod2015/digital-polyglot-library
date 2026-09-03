/** Mide un audio ya narrado del A2: duracion, ritmo, F0 del titulo y huecos. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { spawnSync } from "child_process";
import * as fs from "fs"; import * as os from "os"; import * as path from "path";
const p = new PrismaClient();
const py = fs.existsSync("/Users/alejandrodelcarpio/.cache/dpl-qa/venv/bin/python") ? "/Users/alejandrodelcarpio/.cache/dpl-qa/venv/bin/python" : "python3";

const dur = (f: string) => parseFloat(spawnSync("ffprobe", ["-v","error","-show_entries","format=duration","-of","csv=p=0", f]).stdout.toString().trim());

(async () => {
  for (const slug of process.argv.slice(2)) {
    const s = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true, audioUrl: true, audioSegments: true, audioStatus: true } });
    if (!s?.audioUrl) { console.log(`${slug}: SIN AUDIO`); continue; }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mide-"));
    const f = path.join(dir, "a.mp3");
    spawnSync("curl", ["-sL","-o",f,s.audioUrl]);
    const total = dur(f);
    const palabras = (s.text || "").replace(/<[^>]+>/g," ").split(/\s+/).filter(Boolean).length;

    const segs = (s.audioSegments as any[]) || [];
    let huecos: string[] = [];
    for (let i = 1; i < segs.length; i++) {
      const g = (segs[i].start ?? 0) - (segs[i-1].end ?? 0);
      if (g > 0.3) huecos.push(`${g.toFixed(2)}s antes del bloque ${i+1}`);
    }
    // Titulo: hasta el arranque del primer bloque de cuerpo, o 4 s.
    const fin = segs.length > 1 ? Math.max(1.2, (segs[0].end ?? 2)) : 3;
    const t = path.join(dir, "t.wav");
    spawnSync("ffmpeg", ["-y","-v","error","-i",f,"-t",String(fin),t]);
    const r = spawnSync(py, ["scripts/_f0gate.py", t, "statement"]);
    let end = "?"; try { end = JSON.parse(r.stdout.toString()).end?.toFixed?.(1) ?? "?"; } catch {}

    console.log(`\n${slug} · "${s.title}" · ${s.audioStatus}`);
    console.log(`  ${total.toFixed(1)} s · ${palabras} palabras · ${(palabras/total).toFixed(2)} pal/s`);
    console.log(`  titulo F0 end: ${end} st  (negativo = afirmacion)`);
    console.log(`  bloques: ${segs.length} · huecos >0,3 s: ${huecos.length ? huecos.join("; ") : "ninguno"}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  await p.$disconnect();
})();
