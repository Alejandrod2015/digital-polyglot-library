/**
 * Rellena `CatalogStoryAudioTimings.storyId` a partir del slug.
 *
 * La tabla nacio indexada por slug y el slug NO es unico en el catalogo: si
 * dos libros tienen una historia con el mismo slug, la segunda se queda sin
 * karaoke. Este script pone la clave real (el id de CatalogStory) en cada
 * fila existente.
 *
 * Para los slugs ambiguos NO adivina: compara el texto de cada historia
 * candidata con las palabras de los timings y se queda con la que de mayor
 * solape. Si el solape no es concluyente, deja la fila sin storyId y la
 * reporta, porque una asignacion equivocada es peor que ninguna (el lector
 * mostraria el karaoke de otra historia).
 *
 *   npx tsx scripts/backfillTimingStoryIds.ts [--apply]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** Solape minimo para dar por buena una asignacion ambigua. */
const MIN_SOLAPE = 0.6;

function normalizar(input: string): string[] {
  return input
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9ñ]+/)
    .filter(Boolean);
}

function palabrasDeTimings(payload: unknown): string[] {
  const p = payload as { words?: Array<{ text?: unknown; word?: unknown }>; storyPlainText?: unknown };
  // El texto plano que se alineo es la mejor huella cuando esta; si no,
  // reconstruyo desde los tokens. El campo del token es `text` (no `word`).
  if (typeof p?.storyPlainText === "string" && p.storyPlainText.trim()) {
    return normalizar(p.storyPlainText);
  }
  if (!Array.isArray(p?.words)) return [];
  return p.words.flatMap((w) => normalizar(String(w?.text ?? w?.word ?? "")));
}

/** Fraccion de las primeras N palabras de los timings que aparecen en el texto. */
function solape(timings: string[], texto: string[]): number {
  const muestra = timings.slice(0, 120);
  if (muestra.length === 0) return 0;
  const enTexto = new Set(texto);
  return muestra.filter((w) => enTexto.has(w)).length / muestra.length;
}

async function main() {
  const historias = await prisma.catalogStory.findMany({
    select: { id: true, slug: true, text: true, book: { select: { slug: true } } },
  });
  const porSlug = new Map<string, typeof historias>();
  for (const h of historias) porSlug.set(h.slug, [...(porSlug.get(h.slug) ?? []), h]);

  const filas = await prisma.catalogStoryAudioTimings.findMany({
    select: { slug: true, storyId: true, audioWordTimings: true },
  });

  let asignadas = 0;
  let yaEstaban = 0;
  const sinResolver: string[] = [];

  for (const fila of filas) {
    if (fila.storyId) { yaEstaban++; continue; }

    const candidatas = porSlug.get(fila.slug) ?? [];
    if (candidatas.length === 0) { sinResolver.push(`${fila.slug}: no existe esa historia`); continue; }

    let elegida = candidatas[0];

    if (candidatas.length > 1) {
      const timings = palabrasDeTimings(fila.audioWordTimings);
      const puntuadas = candidatas
        .map((h) => ({ h, s: solape(timings, normalizar(h.text)) }))
        .sort((a, b) => b.s - a.s);
      const [mejor, segunda] = puntuadas;
      if (mejor.s < MIN_SOLAPE || (segunda && mejor.s - segunda.s < 0.1)) {
        sinResolver.push(
          `${fila.slug}: ambiguo, solapes ${puntuadas.map((p) => `${p.h.book.slug}=${p.s.toFixed(2)}`).join(" ")}`
        );
        continue;
      }
      console.log(
        `  ${fila.slug}: ambiguo resuelto -> ${mejor.h.book.slug} (${mejor.s.toFixed(2)} vs ${segunda.s.toFixed(2)})`
      );
      elegida = mejor.h;
    }

    if (APPLY) {
      await prisma.catalogStoryAudioTimings.update({
        where: { slug: fila.slug },
        data: { storyId: elegida.id },
      });
    }
    asignadas++;
  }

  console.log(`\nfilas: ${filas.length} | ya tenian storyId: ${yaEstaban} | asignadas: ${asignadas} | sin resolver: ${sinResolver.length}`);
  for (const s of sinResolver) console.log(`  ${s}`);
  console.log(APPLY ? "\naplicado" : "\n(dry run, usa --apply)");

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
