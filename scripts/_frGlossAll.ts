/** Vuelca TODAS las glosas del paquete francés con un uso real al lado, para
 *  leerlas una a una contra la frase. `--from N --n M` para ir por tandas. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmt09ehi60000320qf9efrypu" }, select: { title: true, text: true } });
  const raw = JSON.parse(fs.readFileSync("src/data/tapGlosses/french-expat-lyon.json", "utf8"));
  const g: Record<string, any> = raw.glosses ?? raw;
  const frases = st.flatMap((s) => `${s.title}. ${s.text}`.split(/(?<=[.!?”])\s+/)).map((f) => f.replace(/\s+/g, " ").trim());
  const arg = (n: string, d: number) => { const i = process.argv.indexOf(n); return i > 0 ? Number(process.argv[i + 1]) : d; };
  const keys = Object.keys(g).sort();
  const from = arg("--from", 0), n = arg("--n", 100);
  for (const k of keys.slice(from, from + n)) {
    const re = new RegExp(`(?<![\\p{L}'’])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "iu");
    const uso = frases.find((f) => re.test(f));
    const gl = typeof g[k] === "string" ? g[k] : g[k].g;
    const ctx = uso ? uso.replace(new RegExp(`(${k})`, "iu"), "«$1»").slice(0, 74) : "(sin uso directo)";
    console.log(`${String(keys.indexOf(k)).padStart(3)} ${k.padEnd(16)} ${gl.slice(0, 46).padEnd(48)} ${ctx}`);
  }
  console.log(`\n[${from}-${Math.min(from + n, keys.length)} de ${keys.length}]`);
  await p.$disconnect();
})();
