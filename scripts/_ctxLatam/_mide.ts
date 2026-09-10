/** Cuántos trozos DISTINTOS hay que traducir en un bundle, y cuántos quedan
 *  todavía cortados por la mitad (acabados en artículo o preposición). Sirve
 *  para saber el tamaño del trabajo antes de empezarlo. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { trozosDe } from "../glossContextChunks";

const COLGANTE = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "lo", "de", "del", "al",
  "a", "en", "con", "por", "para", "sin", "sobre", "mi", "tu", "su", "sus", "y", "que",
]);
const p = new PrismaClient();

(async () => {
  const bundle = process.argv[2];
  const filas = await p.tapGlossSet.findMany({ where: { bundle }, select: { slug: true, slugs: true } });
  const slugs = (filas.find((f) => !f.slug)?.slugs ?? []) as string[];
  const hs = await p.journeyStory.findMany({ where: { slug: { in: slugs } }, select: { slug: true, title: true, text: true } });
  const todos = new Set<string>();
  const cortados: string[] = [];
  for (const h of hs) {
    for (const t of trozosDe(`${h.title}. ${h.text}`)) {
      todos.add(t);
      const ult = t.split(/\s+/).pop()!.toLowerCase().replace(/[^\p{L}\p{M}]/gu, "");
      if (COLGANTE.has(ult)) cortados.push(t);
    }
  }
  console.log(`${hs.length} historias · ${todos.size} trozos distintos`);
  console.log(`cortados por la mitad: ${cortados.length}`);
  for (const t of cortados.slice(0, 20)) console.log(`  ${t}`);
  await p.$disconnect();
})();
