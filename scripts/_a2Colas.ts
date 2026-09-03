/** Para las historias cuya cola pega a la palabra: la cola DECAE (es el final
 *  de la palabra) o REPUNTA (es una inhalacion suelta)? */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs"; import * as os from "os"; import * as path from "path";
import { spawnSync } from "child_process";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const PY = path.join(os.homedir(), ".cache/dpl-qa/venv/bin/python");
(async () => {
  for (const slug of process.argv.slice(2)) {
    const s = await p.journeyStory.findFirst({ where: { slug }, select: { audioUrl: true, audioSegments: true } });
    if (!s?.audioUrl) { console.log(`${slug}: sin master`); continue; }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cola-"));
    const mp3 = path.join(dir, "m.mp3"), wav = path.join(dir, "m.wav");
    spawnSync("curl", ["-sL", "-o", mp3, s.audioUrl]);
    spawnSync("ffmpeg", ["-y", "-v", "error", "-i", mp3, "-ac", "1", "-ar", "16000", wav]);
    const segs = (s.audioSegments as Array<{ startSec?: number }> | null) ?? [];
    const cuerpo = typeof segs[0]?.startSec === "number" ? segs[0]!.startSec! : 2.5;
    const det = JSON.parse(spawnSync(PY, ["scripts/_a2QuitaAire.py", wav, String(Math.max(0.8, cuerpo - 0.08))]).stdout.toString().trim());
    if (!det.ok) { console.log(`${slug}: limpio`); continue; }
    const r = spawnSync(PY, ["-c", `
import sys,wave,numpy as np
w=wave.open(sys.argv[1]);sr=w.getframerate()
x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(float)/32768
fin=float(sys.argv[2]); ini=float(sys.argv[3]); f2=float(sys.argv[4])
def db(a,b):
    s=x[int(a*sr):int(b*sr)]
    return round(float(20*np.log10(max(np.sqrt((s**2).mean()),1e-6))),1)
print(db(max(0,fin-0.06),fin), db(ini,f2), round(f2-ini,3))`, wav, String(det.finPalabra), String(det.aireIni), String(det.aireFin)]);
    const [antes, cola, largo] = r.stdout.toString().trim().split(/\s+/).map(Number);
    const repunta = cola > antes;
    console.log(`${slug.padEnd(28)} palabra ${antes} dB · cola ${cola} dB · ${(largo*1000).toFixed(0)} ms · ${repunta ? "REPUNTA (sospechosa)" : "decae (es la palabra)"}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  await p.$disconnect();
})();
