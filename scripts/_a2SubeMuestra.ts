/** Sube una muestra ya recortada y la deja como PREVIEW de su historia, para
 *  que se oiga en el editor de audio con el texto delante y no como mp3 suelto. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
const p = new PrismaClient();
(async () => {
  const [slug, file] = process.argv.slice(2);
  const s = await p.journeyStory.findFirst({ where: { slug }, select: { id: true, title: true } });
  if (!s) throw new Error("no encuentro " + slug);
  const key = `media/generated/audio/${slug}_muestra_${Date.now()}.mp3`;
  const up = await uploadPublicObject({ key, body: fs.readFileSync(file), contentType: "audio/mpeg" });
  await p.journeyStory.update({ where: { id: s.id }, data: { audioUrlPreview: up!.url, audioFilenamePreview: key.split("/").pop() } });
  console.log("preview:", up!.url);
  await p.$disconnect();
})();
