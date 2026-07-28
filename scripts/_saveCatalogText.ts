/** Guarda el texto de UNA historia de catalogo, con respaldo previo fuera del repo. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const [slug, file] = process.argv.slice(2);
  const nuevo = readFileSync(file, "utf-8");
  const row = await p.catalogStory.findFirst({ where: { slug }, select: { id: true, text: true } });
  if (!row) throw new Error(`no existe ${slug}`);
  const dir = path.join(homedir(), ".dpl-catalog-text-backups", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${slug}.html`), row.text);
  await p.catalogStory.update({ where: { id: row.id }, data: { text: nuevo } });
  console.log(`guardado ${slug}: ${row.text.length} -> ${nuevo.length} chars`);
  console.log(`respaldo: ${dir}/${slug}.html`);
  await p.$disconnect();
})();
