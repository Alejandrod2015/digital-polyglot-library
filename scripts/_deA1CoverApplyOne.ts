/** Sube UNA portada del Friends DE A1 (Frankfurt) al lector: misma
 *  persistencia que scripts/_frA0CoversApply.ts (y la ruta del estudio
 *  api/studio/journeys/cover-upload), pero para un solo slug en vez de
 *  exigir el mapa completo de 21. Uso cuando falta una sola portada y el
 *  resto del journey ya está listo.
 *
 *  uso: npx tsx scripts/_deA1CoverApplyOne.ts <slug> <ruta-local-imagen> [--dry]
 */
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
import { computeCoverThumbhash } from "../src/lib/coverThumbhash";

const JOURNEY = "cmu0dqr6y0007j8o52i1s3gf7";
const p = new PrismaClient();

(async () => {
  const [slug, file] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const dry = process.argv.includes("--dry");
  if (!slug || !file) throw new Error("uso: _deA1CoverApplyOne.ts <slug> <ruta-imagen> [--dry]");
  if (!fs.existsSync(file)) throw new Error(`no existe ${file}`);

  const s = await p.journeyStory.findFirst({ where: { journeyId: JOURNEY, slug }, select: { id: true, slug: true, coverUrl: true } });
  if (!s) throw new Error(`no existe la historia ${slug} en el journey ${JOURNEY}`);
  console.log(`historia: ${s.slug}  coverUrl actual: ${s.coverUrl ?? "(vacio)"}`);
  if (dry) { console.log("--dry: no se subio nada."); await p.$disconnect(); return; }

  const body = fs.readFileSync(file);
  const ext = file.toLowerCase().endsWith(".png") ? "png" : "jpg";
  const contentType = ext === "png" ? "image/png" : "image/jpeg";
  const key = `media/covers/uploaded/${s.id}-${Date.now()}.${ext}`;
  const up = await uploadPublicObject({ key, body, contentType });
  if (!up?.url) throw new Error(`subida fallida: ${slug}`);
  const coverThumbhash = await computeCoverThumbhash(up.url);
  await p.journeyStory.update({ where: { id: s.id }, data: { coverUrl: up.url, coverThumbhash, coverDone: true } });
  console.log(`listo: ${slug}  thumbhash:${coverThumbhash ? "si" : "NO"}  ${up.url}`);
  await p.$disconnect();
})().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
