/**
 * Auditoría de comillas del catálogo: cuerpos y sus espejos de audio.
 *
 * El cuerpo de una historia lleva comillas CURVAS “”; las angulares, las rectas
 * y las bajas alemanas están prohibidas. El gate `body-quote-style` cubre el
 * cuerpo al guardar; esto barre lo que el gate no ve, que es lo ya escrito y
 * las COPIAS del cuerpo (`audioSegments[].text`, `audioFragments[].text`).
 *
 * Mide de paso la alineación del karaoke, porque es la víctima natural de
 * cualquier edición de texto: `audioWordTimings.words[].charStart/charEnd`
 * tienen que seguir apuntando a la misma palabra.
 *
 *   npx tsx scripts/_quoteAudit.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const OUT_OF_STANDARD = /["«»„]/;

async function main() {
  const js = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: {
      name: true, language: true, variant: true, levels: true, status: true,
      stories: { select: { slug: true, text: true, audioSegments: true, audioFragments: true, audioWordTimings: true } },
    },
    orderBy: [{ status: "asc" }, { language: "asc" }],
  });
  let bodies = 0, mirrors = 0, misaligned = 0, stories = 0;
  for (const j of js) {
    let b = 0, m = 0, mis = 0, words = 0;
    for (const s of j.stories) {
      stories++;
      const t = String(s.text ?? "");
      if (OUT_OF_STANDARD.test(t)) b++;
      for (const key of ["audioSegments", "audioFragments"] as const) {
        const arr = s[key] as Array<{ text?: string }> | null;
        if (Array.isArray(arr)) for (const i of arr) if (typeof i.text === "string" && OUT_OF_STANDARD.test(i.text)) m++;
      }
      const wt = s.audioWordTimings as { words?: Array<{ text: string; charStart: number; charEnd: number }> } | null;
      if (wt?.words?.length) for (const w of wt.words) { words++; if (t.slice(w.charStart, w.charEnd) !== w.text) mis++; }
    }
    bodies += b; mirrors += m; misaligned += mis;
    if (b || m || mis) {
      console.log(`${j.status === "active" ? "LIVE " : "DRAFT"} ${j.name} ${j.language}/${j.variant} ${j.levels.join("/")}: cuerpos=${b} espejos=${m} karaoke=${mis}/${words}`);
    }
  }
  console.log(`\n${stories} historias live+draft · cuerpos fuera del estandar: ${bodies} · espejos: ${mirrors} · palabras de karaoke desalineadas: ${misaligned}`);
  await p.$disconnect();
}
main();
