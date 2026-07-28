/** Guarda los textos reimportados de un libro, con respaldo previo fuera del repo. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const dir = process.argv[2];
  const dry = process.argv.includes("--dry");
  const dest = path.join(homedir(), ".dpl-catalog-text-backups", new Date().toISOString().replace(/[:.]/g, "-"));
  if (!dry) mkdirSync(dest, { recursive: true });
  const files = readdirSync(dir).filter((f) => f.endsWith(".html")).sort();
  let n = 0;
  for (const f of files) {
    const slug = f.slice(0, -5);
    const nuevo = readFileSync(path.join(dir, f), "utf-8");
    const row = await p.catalogStory.findFirst({ where: { slug }, select: { id: true, text: true } });
    if (!row) { console.log(`  ${slug}: no existe`); continue; }
    if (!dry) {
      writeFileSync(path.join(dest, `${slug}.html`), row.text);
      await p.catalogStory.update({ where: { id: row.id }, data: { text: nuevo } });
    }
    console.log(`  ${slug.padEnd(36)} ${row.text.length} -> ${nuevo.length} chars`);
    n += 1;
  }
  console.log(`\n${dry ? "[dry] " : ""}guardadas: ${n}`);
  if (!dry) console.log(`respaldo: ${dest}`);
  await p.$disconnect();
})();
