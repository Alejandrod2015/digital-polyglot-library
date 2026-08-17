// ¿Cuánto costaría generar los clips que faltan en los ejercicios match?
// ElevenLabs cobra por CARACTER, así que se cuentan caracteres y se compara
// con lo que cuesta narrar una historia. Solo lee, no sintetiza nada.
import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

type MatchPayload = { pairs?: Array<{ word?: string; meaning?: string }>; extras?: string[] };

async function main() {
  const journeys = await p.journey.findMany({
    where: { status: { notIn: ["archived", "draft"] } },
    select: { id: true, name: true, language: true, variant: true },
    orderBy: [{ language: "asc" }],
  });

  let granTotal = 0;
  for (const j of journeys) {
    const ejs = await p.storyPracticeExercise.findMany({
      where: { set: { story: { journeyId: j.id } }, type: "match_meaning" },
      select: { payload: true },
    });

    // Solo la PALABRA se sintetiza (el significado va en inglés y se lee).
    const palabras = new Set<string>();
    for (const e of ejs) {
      for (const par of ((e.payload as MatchPayload | null)?.pairs ?? [])) {
        const w = (par.word ?? "").trim();
        if (w) palabras.add(w);
      }
    }
    const chars = [...palabras].reduce((n, w) => n + w.length, 0);
    granTotal += chars;

    // Referencia: lo que cuesta narrar las historias de ese journey.
    const hist = await p.journeyStory.findMany({
      where: { journeyId: j.id, status: "published" },
      select: { text: true },
    });
    const charsHistorias = hist.reduce((n, h) => n + (h.text?.length ?? 0), 0);
    const porHistoria = hist.length ? Math.round(charsHistorias / hist.length) : 0;

    console.log(
      `${(j.language + "/" + j.variant + " · " + j.name).padEnd(36)} ${ejs.length} match · ${palabras.size} palabras únicas · ${String(chars).padStart(5)} caracteres` +
        (porHistoria ? ` · = ${(chars / porHistoria).toFixed(2)} historias` : "")
    );
  }
  console.log(`\nTOTAL los 8 journeys: ${granTotal} caracteres`);
}
main().finally(() => p.$disconnect());
