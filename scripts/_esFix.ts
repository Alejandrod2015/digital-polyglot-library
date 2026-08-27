/** Rehace las tablas de conjugación de un bundle YA ESCRITO a mano, sin tocar
 *  los trozos de contexto ni el género.
 *
 *  buildGlossForms salta las historias que ya tienen `c` (para no perder el
 *  trabajo a mano), asi que un arreglo del motor no llega a los journeys
 *  publicados. Este script recorre las tablas existentes, vuelve a preguntar
 *  al motor por el MISMO infinitivo y persona, y si el motor ya no reconoce
 *  ese infinitivo, QUITA la tabla: mejor sin bloque que con uno inventado.
 *
 *  npx tsx scripts/_esFix.ts <bundle> [--dry]
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

async function main() {
  const bundle = process.argv[2];
  const dry = process.argv.includes("--dry");
  const filas = await p.tapGlossSet.findMany({ where: { bundle } });
  const global = filas.find((f) => f.slug === "")!;
  const g = global.glosses as Record<string, { t: string }>;
  const variante = global.variant ?? "latam";

  // Los textos, para que el motor vea las mismas formas que vio la vez pasada.
  const hist = await p.journeyStory.findMany({ where: { slug: { in: global.slugs } }, select: { slug: true, title: true, text: true } });
  const textos: Record<string, string> = {};
  for (const h of hist) textos[h.slug!] = `${h.title}. ${h.text}`;
  fs.writeFileSync("/tmp/_esfix.json", JSON.stringify(textos));

  // Se llama al generador en un bundle FANTASMA: mismo idioma, misma variante,
  // mismas glosas y mismos textos, pero sin capa de contexto, para que no lo
  // salte. De ahi salen las tablas buenas, que luego se trasplantan.
  const fantasma = `${bundle}--refresh`;
  await p.tapGlossSet.deleteMany({ where: { bundle: fantasma } });
  await p.tapGlossSet.create({ data: { bundle: fantasma, slug: "", language: global.language, variant: variante, slugs: global.slugs, glosses: global.glosses as never } });
  execFileSync("npx", ["tsx", "scripts/buildGlossForms.ts", fantasma, "/tmp/_esfix.json"], { stdio: "inherit" });
  const filasNuevas = await p.tapGlossSet.findMany({ where: { bundle: fantasma } });
  const nuevas = new Map(filasNuevas.filter((x) => x.slug !== "").map((x) => [x.slug, x.glosses as Record<string, any>]));

  let cambiadas = 0, quitadas = 0, iguales = 0;
  for (const f of filas.filter((x) => x.slug !== "")) {
    const capa = f.glosses as Record<string, any>;
    const buenas = nuevas.get(f.slug) ?? {};
    let toco = false;
    for (const [w, e] of Object.entries(capa)) {
      if (g[w]?.t !== "verb") continue;
      const nueva = buenas[w]?.f;
      const antes = JSON.stringify(e.f ?? null);
      if (!nueva && e.f) { delete e.f; quitadas++; toco = true; continue; }
      if (nueva && antes !== JSON.stringify(nueva)) { e.f = nueva; cambiadas++; toco = true; continue; }
      if (nueva) iguales++;
    }
    if (toco && !dry) await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: f.slug } }, data: { glosses: capa as never } });
  }
  await p.tapGlossSet.deleteMany({ where: { bundle: fantasma } });
  console.log(`${bundle}: ${cambiadas} tablas rehechas, ${quitadas} quitadas, ${iguales} ya estaban bien${dry ? " (--dry)" : ""}`);
  await p.$disconnect();
}
main();
