/** Sube las portadas del Friends FR A2 (Nantes) que llegaron a mano en
 *  scripts/_frA2cov/. A diferencia de _b1CoversApply.ts (que exige el mapa
 *  completo), este acepta un mapa PARCIAL: las historias sin entrada en el
 *  mapa se quedan sin portada (defecto detectado en revision, ej. 4.1).
 *  Misma persistencia que la ruta del estudio api/studio/journeys/cover-upload:
 *  sube el jpg a R2, calcula el thumbhash y escribe coverUrl + coverThumbhash +
 *  coverDone en la historia. NO toca audioUrl/audioSegments/texto.
 *
 *  uso: NODE_OPTIONS="--conditions=react-server -r dotenv/config"
 *    DOTENV_CONFIG_PATH=.env.local npx tsx scripts/_frA2CoversApply.ts <mapa.json> [--dry]
 *    <mapa.json> = { "<slug>": "<ruta local del jpg>", ... }
 */
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
import { computeCoverThumbhash } from "../src/lib/coverThumbhash";

const JOURNEY = "cmu04ereh000732z7px7naqa2";
const p = new PrismaClient();

(async () => {
  const [mapPath] = process.argv.slice(2);
  const dry = process.argv.includes("--dry");
  const map: Record<string, string> = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  const stories = await p.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    select: { id: true, slug: true, topic: true, slotIndex: true, coverDone: true, audioUrl: true },
  });
  const bySlug = new Map(stories.map((s) => [s.slug!, s]));
  const sobran = Object.keys(map).filter((k) => !bySlug.has(k));
  if (sobran.length) throw new Error(`sobran slugs que no existen en el journey: ${sobran.join(",")}`);
  for (const [slug, file] of Object.entries(map)) if (!fs.existsSync(file)) throw new Error(`no existe ${file} (${slug})`);
  const faltan = stories.filter((s) => !map[s.slug!]).map((s) => s.slug);
  console.log(`${stories.length} historias, ${Object.keys(map).length} portadas en el mapa (quedan sin portada: ${faltan.join(", ") || "ninguna"})${dry ? " (dry)" : ""}`);
  if (dry) { await p.$disconnect(); return; }

  let ok = 0;
  for (const s of stories.sort((a, b) => a.topic.localeCompare(b.topic) || a.slotIndex - b.slotIndex)) {
    const file = map[s.slug!];
    if (!file) { console.log(`-- ${s.slug} (sin portada, se deja fuera)`); continue; }
    const body = fs.readFileSync(file);
    const key = `media/covers/uploaded/${s.id}-${Date.now()}.jpg`;
    const up = await uploadPublicObject({ key, body, contentType: "image/jpeg" });
    if (!up?.url) throw new Error(`subida fallida: ${s.slug}`);
    const coverThumbhash = await computeCoverThumbhash(up.url);
    await p.journeyStory.update({ where: { id: s.id }, data: { coverUrl: up.url, coverThumbhash, coverDone: true } });
    ok++;
    console.log(`${ok.toString().padStart(2)} ${s.slug}  thumbhash:${coverThumbhash ? "si" : "NO"}  ${up.url}`);
  }
  console.log(`listo: ${ok}/${stories.length} con portada nueva`);
  await p.$disconnect();
})().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
