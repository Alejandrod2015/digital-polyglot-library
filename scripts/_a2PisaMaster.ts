/** Sube un master ya editado y lo pone como audioUrl de su historia.
 *  Exige que dure EXACTAMENTE lo mismo, para no mover los tiempos de palabra. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { spawnSync } from "child_process";
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
const p = new PrismaClient();
const dur = (f: string) => parseFloat(spawnSync("ffprobe", ["-v","error","-show_entries","format=duration","-of","csv=p=0", f]).stdout.toString().trim());
(async () => {
  const [slug, file] = process.argv.slice(2);
  const s = await p.journeyStory.findFirst({ where: { slug }, select: { id: true, audioUrl: true, audioWordTimings: true } });
  if (!s?.audioUrl) throw new Error("esa historia no tiene master");
  const viejo = "/tmp/_master_viejo.mp3";
  spawnSync("curl", ["-sL", "-o", viejo, s.audioUrl]);
  const a = dur(viejo), b = dur(file);
  if (Math.abs(a - b) > 0.02) throw new Error(`la duracion se movio: ${a} -> ${b}; no subo nada`);
  const key = `media/generated/audio/${slug}_limpio_${Date.now()}.mp3`;
  const up = await uploadPublicObject({ key, body: fs.readFileSync(file), contentType: "audio/mpeg" });
  await p.journeyStory.update({ where: { id: s.id }, data: { audioUrl: up!.url } });
  console.log(`master reemplazado (${a.toFixed(3)}s -> ${b.toFixed(3)}s):`, up!.url);
  await p.$disconnect();
})();
