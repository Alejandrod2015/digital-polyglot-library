/**
 * Escribe src/lib/bodyWordBandBaseline.ts: la palabra congelada de cada
 * historia LIVE que el 2026-09-11 estaba fuera de la banda del spec.
 * Solo journeys `active`; los drafts no se congelan.
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { BANDA_PALABRAS_SPEC } from "../src/lib/bodyWordBand";
const p = new PrismaClient();
const W = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

async function main() {
  const js = await p.journey.findMany({
    where: { status: "active" },
    select: { id: true, name: true, language: true, variant: true, levels: true,
      stories: { select: { topic: true, slotIndex: true, text: true } } },
    orderBy: [{ language: "asc" }, { name: "asc" }],
  });
  const bloques: string[] = [];
  let total = 0;
  for (const j of js) {
    const lvl = (j.levels[0] ?? "").toUpperCase();
    const band = BANDA_PALABRAS_SPEC[lvl];
    if (!band) continue;
    const fuera = j.stories
      .filter((s) => (s.text ?? "").trim())
      .map((s) => ({ k: `${s.topic}#${s.slotIndex}`, w: W(s.text!) }))
      .filter((x) => x.w < band[0] || x.w > band[1])
      .sort((a, b) => a.k.localeCompare(b.k));
    if (!fuera.length) continue;
    total += fuera.length;
    bloques.push(
      `  ${j.id}: {\n    nota: "${j.name} ${j.language}/${j.variant} ${lvl}, ${fuera.length} fuera de ${band[0]}-${band[1]}",\n    historias: {\n` +
        fuera.map((x) => `      "${x.k}": ${x.w},`).join("\n") +
        `\n    },\n  },`
    );
  }
  const out = `/**
 * LINEA BASE de \`body-word-count\`, por historia. Generado el 2026-09-11 por
 * scripts/_congelaBandaPalabras.ts; no se regenera, se aprieta a mano.
 *
 * POR QUE. El 2026-09-11 \`body-word-count\` paso a FALLAR fuera de la banda
 * del spec para el nivel (src/lib/bodyWordBand.ts). Medido ese dia, casi
 * todo lo publicado quedaba fuera: el aviso de 115-170 habia dejado entrar
 * A0-A2 de 156-170 palabras, y los C1 se escribieron contra la banda vieja de
 * 220-280. Un journey publicado no puede quedar bloqueado para siempre (ni
 * una errata se podria corregir), asi que cada historia LIVE que estaba fuera
 * conserva como limite las palabras que tenia ese dia: puede quedarse igual o
 * acercarse a la banda, nunca alejarse mas. Clave: \`tema#hueco\`, que no
 * cambia al retitular.
 *
 * Solo journeys live (${total} historias). Los drafts NO estan aqui: un draft
 * se arregla antes de publicarse, que es para lo que existe el gate. Una
 * historia nueva, o un hueco que no este en la lista, responde a la banda
 * entera.
 */
export const PALABRAS_CONGELADAS: Record<string, { nota: string; historias: Record<string, number> }> = {
${bloques.join("\n")}
};
`;
  fs.writeFileSync("src/lib/bodyWordBandBaseline.ts", out);
  console.log(`congeladas ${total} historias en ${bloques.length} journeys live`);
}
main().finally(() => p.$disconnect());
