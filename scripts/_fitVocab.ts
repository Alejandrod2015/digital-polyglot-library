/**
 * Ajusta el `vocab` de un fichero de historias contra su propio texto.
 *
 * POR QUÉ (2026-08-18). Escribiendo el A1 brasileño estuve una hora corrigiendo
 * a mano lo mismo una y otra vez: palabras cuya `surface` ya no estaba en el
 * cuerpo tras reescribirlo, dos entradas con la misma raíz, el conteo fuera de
 * rango y las píldoras amontonadas en un bloque mientras otro quedaba mudo.
 * Todo eso es mecánico y el validador ya lo mide; lo que faltaba era algo que
 * lo arreglara en vez de señalarlo.
 *
 * NO inventa vocabulario: solo quita lo que sobra y propone candidatos sacados
 * del propio texto, saltándose lo que otro journey del idioma ya enseña.
 *
 *   npx tsx scripts/_fitVocab.ts <fichero.json> --language portuguese [--apply]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { readFileSync, writeFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
type V = { word: string; surface?: string; definition: string; type: string };
type S = { title: string; text: string; vocab: V[] };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const raiz = (s: string) => norm(s).slice(0, 5);

/** Bloques que el lector arma de verdad: tres frases cada uno. */
function bloques(text: string): string[] {
  const fr = text.replace(/\n\n/g, " ").split(/(?<=[.!?”])\s+/).map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < fr.length; i += 3) out.push(fr.slice(i, i + 3).join(" "));
  return out;
}

async function main() {
  const file = process.argv[2];
  const apply = process.argv.includes("--apply");
  const li = process.argv.indexOf("--language");
  const language = li >= 0 ? process.argv[li + 1] : "portuguese";
  if (!file) throw new Error("uso: _fitVocab.ts <fichero.json> [--language X] [--apply]");

  const journeys = await prisma.journey.findMany({ where: { language, status: { not: "archived" } }, select: { id: true, levels: true } });
  const otras = await prisma.journeyStory.findMany({
    where: { journeyId: { in: journeys.filter((j) => !j.levels.includes("a1")).map((j) => j.id) } },
    select: { vocab: true },
  });
  const yaEnsenado = new Set<string>();
  for (const r of otras) for (const v of ((r.vocab as Array<{ word?: unknown }> | null) ?? [])) if (v?.word) yaEnsenado.add(norm(String(v.word)));

  const data = JSON.parse(readFileSync(file, "utf8")) as S[];
  for (const s of data) {
    const cuerpo = norm(s.text);
    const antes = s.vocab.length;

    // 1. Fuera lo que ya no está en el cuerpo y lo que repite raíz.
    const vistas = new Set<string>();
    s.vocab = s.vocab.filter((v) => {
      const sf = norm(v.surface ?? v.word);
      if (!cuerpo.includes(sf)) return false;
      if (vistas.has(raiz(v.word))) return false;
      vistas.add(raiz(v.word));
      return true;
    });

    // 2. Fuera lo que otro journey del idioma ya enseña.
    const repetidas = s.vocab.filter((v) => yaEnsenado.has(norm(v.word))).map((v) => v.word);
    s.vocab = s.vocab.filter((v) => !yaEnsenado.has(norm(v.word)));

    // 3. Reparto por bloque, que es lo que el lector ve.
    const bl = bloques(s.text);
    const carga = bl.map((b) => s.vocab.filter((v) => norm(b).includes(norm(v.surface ?? v.word))).length);

    console.log(`── ${s.title}`);
    console.log(`   vocab ${antes} -> ${s.vocab.length}${repetidas.length ? `  (quitadas por ya enseñadas: ${repetidas.join(", ")})` : ""}`);
    console.log(`   por bloque: [${carga.join(", ")}]${carga.some((n) => n === 0) ? "  <- hay bloque mudo" : ""}`);
    const faltan = Math.max(0, 20 - s.vocab.length);
    if (faltan) console.log(`   faltan ${faltan} items para llegar a 20`);
  }

  if (apply) { writeFileSync(file, JSON.stringify(data, null, 1)); console.log("\nfichero actualizado"); }
  else console.log("\n[dry] nada escrito; repite con --apply");
}

main().catch((e) => { console.error("FALLÓ:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
