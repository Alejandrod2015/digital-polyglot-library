// ¿Coinciden los offsets guardados en audioFragments con el máster actual?
// Si el máster pasó por normalizeAudioPace (sufijo _slow) y los fragmentos se
// midieron antes, todo corte cae desplazado y parte una palabra por la mitad.
import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { execFileSync } from "child_process";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
type Frag = { index:number; startSec:number; endSec:number; text?:string };
(async()=>{
  for (const slug of process.argv.slice(2)) {
    const s = await p.journeyStory.findFirst({ where:{ slug }, select:{ audioUrl:true, audioFragments:true } });
    const fr = (s?.audioFragments as Frag[] | null) ?? [];
    if (!s?.audioUrl || !fr.length) { console.log(`${slug}: sin datos`); continue; }
    const dur = parseFloat(execFileSync("ffprobe", ["-v","error","-show_entries","format=duration","-of","csv=p=0", s.audioUrl], { encoding:"utf8" }).trim());
    const ultimo = Math.max(...fr.map(f=>Number(f.endSec)));
    const desfase = dur - ultimo;
    console.log(`${slug.padEnd(32)} máster ${dur.toFixed(2)}s · último fragmento acaba en ${ultimo.toFixed(2)}s · desfase ${desfase.toFixed(2)}s ${Math.abs(desfase) > 1 ? "← DESFASADO" : ""}`);
  }
})().finally(()=>p.$disconnect());
