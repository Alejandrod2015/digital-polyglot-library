/** Pone en el lector las 21 portadas del Friends FR A1 (France) que llegaron
 *  por Drive (carpeta francia-a1, generadas en la laptop 2 con el metodo del
 *  cast sheet). Misma persistencia que la ruta del estudio
 *  `api/studio/journeys/cover-upload`: sube el PNG a R2, calcula el thumbhash y
 *  escribe coverUrl + coverThumbhash + coverDone en la historia. Adaptado de
 *  scripts/_b2sCoversApply.ts (worktree vigorous-shaw-4cc212), con la
 *  comprobacion de 21 intacta.
 *
 *  uso: NODE_OPTIONS="-r ./scripts/_envBoth.cjs" npx tsx scripts/_frA1CoversApply.ts <mapa.json> [--dry]
 *    <mapa.json> = { "<slug>": "<ruta local del png>", ... }
 */
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
import { computeCoverThumbhash } from "../src/lib/coverThumbhash";

const JOURNEY = "cmtwz1iop000l32jybeo2jg4x";
const p = new PrismaClient();

(async () => {
  const [mapPath] = process.argv.slice(2);
  const dry = process.argv.includes("--dry");
  const map: Record<string, string> = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  const stories = await p.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    select: { id: true, slug: true, topic: true, slotIndex: true },
  });
  const bySlug = new Map(stories.map((s) => [s.slug!, s]));
  const faltan = stories.filter((s) => !map[s.slug!]).map((s) => s.slug);
  const sobran = Object.keys(map).filter((k) => !bySlug.has(k));
  if (stories.length !== 21) throw new Error(`journey tiene ${stories.length} historias, no 21`);
  if (faltan.length || sobran.length) throw new Error(`mapa incompleto; faltan ${faltan.join(",")} sobran ${sobran.join(",")}`);
  for (const [slug, file] of Object.entries(map)) if (!fs.existsSync(file)) throw new Error(`no existe ${file} (${slug})`);
  console.log(`${stories.length} historias, ${Object.keys(map).length} portadas en el mapa${dry ? " (dry)" : ""}`);
  if (dry) { await p.$disconnect(); return; }

  let ok = 0;
  for (const s of stories.sort((a, b) => a.topic.localeCompare(b.topic) || a.slotIndex - b.slotIndex)) {
    const body = fs.readFileSync(map[s.slug!]);
    const key = `media/covers/uploaded/${s.id}-${Date.now()}.png`;
    const up = await uploadPublicObject({ key, body, contentType: "image/png" });
    if (!up?.url) throw new Error(`subida fallida: ${s.slug}`);
    const coverThumbhash = await computeCoverThumbhash(up.url);
    await p.journeyStory.update({ where: { id: s.id }, data: { coverUrl: up.url, coverThumbhash, coverDone: true } });
    ok++;
    console.log(`${ok.toString().padStart(2)} ${s.slug}  thumbhash:${coverThumbhash ? "si" : "NO"}  ${up.url}`);
  }
  console.log(`listo: ${ok}/${stories.length}`);
  await p.$disconnect();
})().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
