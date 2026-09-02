/**
 * LINT: el karaoke de una historia no puede ir por detras de su texto.
 *
 * WHY: el lector con karaoke (HighlightedStoryContent) parte los parrafos por
 * cada salto de linea de `payload.storyPlainText`, que es una COPIA del texto
 * guardada al alinear, no el texto vivo. Si el texto se edita despues de
 * narrar, el lector sigue pintando la forma vieja y nada avisa: el validador
 * pasa, las glosas pasan, y solo se ve abriendo la pagina CON SESION. El
 * 2026-09-02 el A2 latam se veia como una lista de trece renglones donde el
 * texto ya tenia cinco parrafos.
 *
 * Se arregla realineando, que NO gasta creditos de ElevenLabs: usa el audioUrl
 * que ya existe y corre la alineacion en Modal.
 *   npx tsx scripts/_realinea.ts
 *
 * Run:  npm run lint:karaoke-fresh
 * Exit: 0 limpio, 1 con la lista de historias desfasadas.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

/** Los bloques que el lector pinta: parte por CADA salto, igual que
 *  HighlightedStoryContent, y no por linea en blanco. */
function bloques(s: string): string[] {
  // Fuera el HTML de las historias de libro: el payload guarda texto plano y
  // compararlo con markup daba falso positivo en 40 historias legacy.
  const plano = s.replace(/<[^>]+>/g, "\n");
  return plano.split(/\n+/).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** Desfases que ya existian al poner el lint. No bloquean; bloquea uno NUEVO,
 *  que es el que aparece por editar el texto despues de narrar. */
const CONOCIDOS: Set<string> = new Set(
  JSON.parse(fs.readFileSync(path.join(__dirname, "karaoke-fresh-known.json"), "utf8"))
);

(async () => {
  const stories = await prisma.journeyStory.findMany({
    where: { NOT: { audioUrl: null } },
    select: { slug: true, text: true, audioWordTimings: true, journeyId: true },
  });

  const malas: Array<{ slug: string; motivo: string }> = [];
  let conKaraoke = 0;

  for (const s of stories) {
    const payload = s.audioWordTimings as { storyPlainText?: unknown } | null;
    const foto = typeof payload?.storyPlainText === "string" ? payload.storyPlainText : null;
    if (!foto) continue; // sin alineacion no hay karaoke que se desfase
    conKaraoke++;
    if (!s.text) continue;
    // Lo que decide la forma en pantalla es CUANTOS bloques hay.
    const A = bloques(foto), B = bloques(s.text);
    if (A.length !== B.length && !CONOCIDOS.has(s.slug)) {
      malas.push({ slug: s.slug, motivo: `el lector pinta ${A.length} bloque(s) y el texto tiene ${B.length}` });
    }
  }

  if (malas.length === 0) {
    console.log(`karaoke-fresh: limpio (${conKaraoke} historias alineadas, todas al dia con su texto)`);
    return;
  }

  console.error(`karaoke-fresh: ${malas.length} historia(s) con el karaoke por detras del texto\n`);
  for (const m of malas) console.error(`  ${m.slug}: ${m.motivo}`);
  console.error(
    "\nEl lector pinta desde la copia guardada al alinear, no desde el texto.\n" +
      "Realinea (usa el audio que ya existe, no gasta creditos):\n" +
      "  npx tsx scripts/_realinea.ts"
  );
  process.exitCode = 1;
})().finally(() => prisma.$disconnect());
