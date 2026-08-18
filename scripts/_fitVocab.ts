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
 *   npx tsx scripts/_fitVocab.ts <fichero.json> --propose   (candidatos por hueco)
 *
 * `--propose` es la parte que faltaba. Ajustar el vocab a mano era un bucle sin
 * fin: al mover una palabra para arreglar el reparto quedaba corta la cuenta, al
 * añadir otra se desequilibraba el reparto otra vez, y así diez rondas. Este
 * modo mira los bloques POBRES del lector, saca de ellos las palabras que están
 * libres (ni enseñadas en otro journey ni ya en el vocab) y de nivel, y escupe
 * las entradas listas con `definition` vacía para rellenar a mano. La glosa la
 * escribe una persona; el reparto y el filtrado, la máquina.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { readFileSync, writeFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { isPortugueseA1A2 } from "../src/lib/cefr/portugueseA1A2";
import { isItalianA1A2 } from "../src/lib/cefr/italianA1A2";
import { isGermanA1A2 } from "../src/lib/cefr/germanA1A2";

const prisma = new PrismaClient();
type V = { word: string; surface?: string; definition: string; type: string };
type S = { title: string; text: string; vocab: V[] };

/** Palabras que nunca son un item de vocab por sí solas. */
const FUNCIONALES = new Set([
  "para", "com", "que", "uma", "sem", "mais", "dois", "esse", "essa", "esta", "aqui",
  "todos", "todo", "cada", "quase", "nada", "muito", "bem", "ainda", "depois", "ela",
  "ele", "dela", "dele", "isso", "outra", "outro", "vocês", "eles", "deles", "assim",
  "como", "quando", "onde", "quem", "qual", "está", "estão", "eram", "tem", "temos",
  "dias", "então", "porque", "também", "sobre", "entre", "pelo", "pela", "numa", "num",
]);

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const raiz = (s: string) => norm(s).slice(0, 5);

/** Bloques que el lector arma de verdad: tres frases cada uno. */
function bloques(text: string): string[] {
  const fr = text.replace(/\n\n/g, " ").split(/(?<=[.!?”])\s+/).map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < fr.length; i += 3) out.push(fr.slice(i, i + 3).join(" "));
  return out;
}

/** El filtro de nivel del idioma; sin lista, no se filtra. */
function nivelDe(language: string): (w: string) => boolean {
  const porIdioma: Record<string, ((w: string) => boolean) | undefined> = {
    portuguese: isPortugueseA1A2,
    italian: isItalianA1A2,
    german: isGermanA1A2,
  };
  return porIdioma[language.toLowerCase()] ?? (() => true);
}

async function main() {
  const file = process.argv[2];
  const apply = process.argv.includes("--apply");
  const proponer = process.argv.includes("--propose");
  const li = process.argv.indexOf("--language");
  const language = li >= 0 ? process.argv[li + 1] : "portuguese";
  if (!file) throw new Error("uso: _fitVocab.ts <fichero.json> [--language X] [--apply]");

  const deNivel = nivelDe(language);

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

    // Bloques del lector: lo que el gate mide de verdad.
    const bl = bloques(s.text);

    // 2. Fuera lo que otro journey del idioma ya enseña.
    const repetidas = s.vocab.filter((v) => yaEnsenado.has(norm(v.word))).map((v) => v.word);
    s.vocab = s.vocab.filter((v) => !yaEnsenado.has(norm(v.word)));

    const carga = bl.map((b) => s.vocab.filter((v) => norm(b).includes(norm(v.surface ?? v.word))).length);

    // 4. ELECCIÓN por reparto. Con más candidatos que huecos, quedarse con los
    //    primeros amontona las píldoras al principio; se recorren los bloques en
    //    rueda cogiendo uno de cada uno, que es lo que el gate mide.
    const TOPE = 22;
    if (s.vocab.length > TOPE) {
      const porBloque: V[][] = bl.map((b) => s.vocab.filter((v) => norm(b).includes(norm(v.surface ?? v.word))));
      const elegidos: V[] = [];
      let ronda = 0;
      while (elegidos.length < TOPE) {
        let puesto = false;
        for (const grupo of porBloque) {
          const cand = grupo[ronda];
          if (cand && !elegidos.includes(cand)) { elegidos.push(cand); puesto = true; }
          if (elegidos.length >= TOPE) break;
        }
        if (!puesto) break;
        ronda++;
      }
      s.vocab = elegidos;
    }

    console.log(`── ${s.title}`);
    console.log(`   vocab ${antes} -> ${s.vocab.length}${repetidas.length ? `  (quitadas por ya enseñadas: ${repetidas.join(", ")})` : ""}`);
    console.log(`   por bloque: [${carga.join(", ")}]${carga.some((n) => n === 0) ? "  <- hay bloque mudo" : ""}`);
    const faltan = Math.max(0, 20 - s.vocab.length);
    if (faltan) console.log(`   faltan ${faltan} items para llegar a 20`);

    if (proponer && (faltan > 0 || carga.some((n) => n === 0))) {
      // Se recorren los bloques del más pobre al más rico, para que cada hueco
      // se llene con una palabra de donde falta, no de donde ya sobra.
      const orden = bl.map((b, i) => ({ b, i, n: carga[i] })).sort((x, y) => x.n - y.n);
      const yaEnVocab = new Set(s.vocab.map((v) => norm(v.word)));
      const propuestas: Array<{ bloque: number; word: string }> = [];
      // UNA por bloque y vuelta a empezar. Coger todas las del primer bloque
      // pobre las amontona ahí: la primera versión propuso seis palabras del
      // bloque 0 y el gate pasó de 20% a 45% en ese bloque (2026-08-18).
      const cupo = Math.max(faltan, carga.filter((n) => n === 0).length);
      const libresPorBloque = orden.map(({ b, i }) => ({
        i,
        palabras: [...new Set((b.toLowerCase().match(/[a-zà-ÿ]{4,}/g) ?? []))]
          .filter((w) => !yaEnVocab.has(norm(w)) && !yaEnsenado.has(norm(w)) && !FUNCIONALES.has(norm(w)) && deNivel(w)),
      }));
      for (let vuelta = 0; propuestas.length < cupo; vuelta++) {
        let puesto = false;
        for (const grupo of libresPorBloque) {
          const w = grupo.palabras[vuelta];
          if (!w || yaEnVocab.has(norm(w))) continue;
          yaEnVocab.add(norm(w));
          propuestas.push({ bloque: grupo.i, word: w });
          puesto = true;
          if (propuestas.length >= cupo) break;
        }
        if (!puesto) break;
      }
      if (propuestas.length) {
        console.log(`   PROPUESTAS (rellena "definition" y pega en el vocab):`);
        for (const pr of propuestas) {
          console.log(`     { "type": "?", "word": "${pr.word}", "surface": "${pr.word}", "definition": "" },   // bloque ${pr.bloque}`);
        }
      } else {
        console.log(`   sin candidatos libres en el texto: hay que reescribir alguna frase`);
      }
    }
  }

  if (apply) { writeFileSync(file, JSON.stringify(data, null, 1)); console.log("\nfichero actualizado"); }
  else console.log("\n[dry] nada escrito; repite con --apply");
}

main().catch((e) => { console.error("FALLÓ:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
