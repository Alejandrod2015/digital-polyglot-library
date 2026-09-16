/**
 * Sube UNA portada del Friends FR B1 (Lille) y actualiza su fila.
 * Molde: scripts/_frA1CoversApplyPartial.ts, con dos diferencias: el journey
 * y que respeta la EXTENSION real del archivo (el molde forzaba .png y
 * contentType image/png; esta portada llega en jpg y servirla como png hace
 * que algunos clientes la rechacen).
 *
 * uso: npx tsx scripts/_frB1CoverApplyOne.ts <slug> <archivo> [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { extname } from "node:path";
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
import { computeCoverThumbhash } from "../src/lib/coverThumbhash";

const JOURNEY = "cmu0doigc0007j8e292tycths";
const TIPOS: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const p = new PrismaClient();

(async () => {
  const [slug, file] = process.argv.slice(2);
  const dry = process.argv.includes("--dry");
  if (!slug || !file) throw new Error("uso: _frB1CoverApplyOne.ts <slug> <archivo> [--dry]");
  const ext = extname(file).toLowerCase();
  const tipo = TIPOS[ext];
  if (!tipo) throw new Error(`extension no servible: ${ext}`);
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size <= 0) throw new Error(`archivo invalido: ${file}`);

  const story = await p.journeyStory.findFirst({
    where: { journeyId: JOURNEY, slug },
    select: { id: true, slug: true, title: true, coverUrl: true },
  });
  if (!story) throw new Error(`no hay historia ${slug} en ${JOURNEY}`);
  console.log(`${slug} (${story.id}) | coverUrl actual: ${story.coverUrl ?? "null"}`);
  console.log(`archivo: ${file} (${(stat.size/1024).toFixed(0)} KB, ${tipo})`);
  if (dry) { console.log("dry: no se sube nada"); return; }
  if (story.coverUrl) throw new Error(`${slug} YA tiene portada; este script solo rellena huecos`);

  const key = `media/covers/uploaded/${story.id}-${Date.now()}${ext}`;
  const up = await uploadPublicObject({ key, body: fs.readFileSync(file), contentType: tipo });
  if (!up?.url) throw new Error("subida fallida");
  const coverThumbhash = await computeCoverThumbhash(up.url);
  await p.journeyStory.update({ where: { id: story.id }, data: { coverUrl: up.url, coverThumbhash, coverDone: true } });
  console.log(`subida: ${up.url}\nthumbhash: ${coverThumbhash ? "si" : "NO"}`);
  await p.$disconnect();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
