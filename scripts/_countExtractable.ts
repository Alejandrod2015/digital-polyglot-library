import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { readFileSync, readdirSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[«»"¿¡!?.,:;]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
(async () => {
  let total = 0, exact = 0, fills = 0;
  const slugs = readdirSync("scripts/_sets").filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
  for (const slug of slugs) {
    const exs = JSON.parse(readFileSync(`scripts/_sets/${slug}.json`, "utf8"));
    const st = await prisma.journeyStory.findFirst({ where: { slug }, select: { audioSegments: true } });
    const segs = new Set((((st?.audioSegments as any[]) || [])).map((g) => norm(g.text)));
    for (const e of exs) {
      const ac = e?.payload?.audioClip;
      if (!ac?.sentence || e.type === "listen_choose") continue;
      total++;
      if (e.type === "fill_blank") { fills++; continue; }
      if (segs.has(norm(ac.sentence))) exact++;
    }
  }
  console.log(`clips de oración totales (sin listen): ${total}`);
  console.log(`  fills (oraciones inventadas, imposible extraer): ${fills}`);
  console.log(`  meaning con match EXACTO en segmentos (extraíbles): ${exact}`);
  console.log(`  meaning recortadas (sin match exacto, requieren TTS): ${total - fills - exact}`);
})().finally(() => prisma.$disconnect());
