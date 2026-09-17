/**
 * Sube solo algunas portadas del FR France A1 Friends y actualiza sus filas.
 *
 * uso:
 * NODE_OPTIONS="-r ./scripts/_envBoth.cjs" npx tsx scripts/_frA1CoversApplyPartial.ts <mapa.json> [--dry]
 *
 * <mapa.json> = { "<slug>": "<ruta local del png>", ... }
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
  if (!mapPath) throw new Error("falta <mapa.json>");

  const map: Record<string, string> = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  const slugs = Object.keys(map);
  if (!slugs.length) throw new Error("mapa vacio");

  const stories = await p.journeyStory.findMany({
    where: { journeyId: JOURNEY, slug: { in: slugs } },
    select: { id: true, slug: true, title: true, coverUrl: true },
  });
  const bySlug = new Map(stories.map((s) => [s.slug!, s]));
  const faltan = slugs.filter((slug) => !bySlug.has(slug));
  if (faltan.length) throw new Error(`no hay story para: ${faltan.join(", ")}`);

  for (const [slug, file] of Object.entries(map)) {
    if (!fs.existsSync(file)) throw new Error(`no existe ${file} (${slug})`);
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size <= 0) throw new Error(`archivo invalido ${file} (${slug})`);
  }

  console.log(`${slugs.length} portadas parciales${dry ? " (dry)" : ""}`);
  for (const slug of slugs) {
    const story = bySlug.get(slug)!;
    console.log(`${slug} -> ${map[slug]} (${story.id})`);
  }
  if (dry) return;

  let ok = 0;
  for (const slug of slugs) {
    const story = bySlug.get(slug)!;
    const body = fs.readFileSync(map[slug]);
    const key = `media/covers/uploaded/${story.id}-${Date.now()}.png`;
    const up = await uploadPublicObject({ key, body, contentType: "image/png" });
    if (!up?.url) throw new Error(`subida fallida: ${slug}`);
    const coverThumbhash = await computeCoverThumbhash(up.url);
    await p.journeyStory.update({
      where: { id: story.id },
      data: { coverUrl: up.url, coverThumbhash, coverDone: true },
    });
    ok++;
    console.log(`${ok.toString().padStart(2)} ${slug} thumbhash:${coverThumbhash ? "si" : "NO"} ${up.url}`);
  }
  console.log(`listo: ${ok}/${slugs.length}`);
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await p.$disconnect();
  });
