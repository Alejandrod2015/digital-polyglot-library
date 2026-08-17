/**
 * Separa en parrafos propios los turnos de dialogo del journey Hanseat.
 *
 * Forma actual: los bloques de narrador SI van separados por "\n\n", pero los
 * turnos de dialogo dentro de un bloque van pegados con "\n" simple. El lector
 * parte por "\n\n", asi que 16 lineas se renderizan como 4 parrafos: un muro de
 * dialogo, y el check vocab-distribution ve el 85% del vocabulario en un solo
 * parrafo cuando en realidad esta repartido.
 *
 * El arreglo es un salto de linea, no una reescritura: NADA de texto cambia,
 * solo el separador. Verificado en el script: quitando todos los saltos, el
 * antes y el despues son la misma cadena.
 *
 * Escribe un JSON por historia en scripts/_hanseatOut/ para pasarlos por
 * saveStory.ts, que es el unico camino permitido hacia journeyStory.text.
 */
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";

const prisma = new PrismaClient();
const JOURNEY = "cmrdbz11t000032asrvo832i9";

function splitTurns(text: string): string {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n");
}

async function main() {
  const outDir = "scripts/_hanseatOut";
  fs.mkdirSync(outDir, { recursive: true });

  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    select: {
      title: true, slug: true, text: true, synopsis: true, arcType: true,
      vocab: true, level: true, topic: true, slotIndex: true, audioUrl: true,
    },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });

  fs.writeFileSync("scripts/_hanseatBackup.json", JSON.stringify(stories, null, 2));

  let changed = 0;
  for (const s of stories) {
    if (s.audioUrl) { console.log(`  SALTADA (tiene audio): ${s.slug}`); continue; }
    const before = s.text ?? "";
    const after = splitTurns(before);

    // Cinturon: el texto sin saltos tiene que ser IDENTICO. Si no lo es, el
    // "arreglo de formato" estaria tocando palabras, y eso no es lo que es.
    const bare = (t: string) => t.replace(/\s+/g, " ").trim();
    if (bare(before) !== bare(after)) {
      console.log(`  !! ${s.slug}: el texto cambiaria, NO se toca`);
      continue;
    }
    if (before === after) continue;

    const p0 = before.split(/\n{2,}/).filter((x) => x.trim()).length;
    const p1 = after.split(/\n{2,}/).filter((x) => x.trim()).length;
    console.log(`${s.topic}#${s.slotIndex}: ${p0} -> ${p1} parrafos`);
    changed += 1;
    fs.writeFileSync(
      `${outDir}/${s.topic}-${s.slotIndex}.json`,
      JSON.stringify([{ ...s, text: after, audioUrl: undefined }], null, 2)
    );
  }
  console.log(`\nhistorias a reformatear: ${changed} / ${stories.length}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
