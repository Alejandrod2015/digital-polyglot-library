// Sube un PNG local y lo fija como coverUrl de una CatalogStory (libros).
// Equivalente a scripts/_setCover.ts, que solo sirve para JourneyStory.
// No genera imagen: solo sube y apunta.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
import { readFileSync } from "node:fs";

const p = new PrismaClient();

async function main() {
  const [slug, file] = [process.argv[2], process.argv[3]];
  if (!slug || !file) throw new Error("uso: tsx scripts/_setCatalogCover.ts <storySlug> <archivo.png>");
  const story = await p.catalogStory.findFirst({
    where: { slug },
    select: { id: true, slug: true, title: true },
  });
  if (!story) throw new Error(`historia no encontrada: ${slug}`);

  const buf = readFileSync(file);
  const key = `media/generated/images/${slug}-cel-clean-${buf.length}.png`;
  const up = await uploadPublicObject({ key, body: buf, contentType: "image/png" });
  if (!up?.url) throw new Error("fallo la subida");

  await p.catalogStory.update({ where: { id: story.id }, data: { coverUrl: up.url } });
  console.log(`SET ${story.slug} -> ${up.url}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
