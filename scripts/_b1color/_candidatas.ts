/** Candidatas de reemplazo para las plazas que salen, ORDENADAS POR ENCUENTROS.
 *
 *  Importa el orden: la escalera mide la media de encuentros de las PORTABLES,
 *  y las ancladas estaban exentas. Cambiar 19 ancladas por 19 portables que
 *  salgan una sola vez hunde esa media y la cola de "un solo encuentro". Asi
 *  que la sustituta buena es la que ya se repite en el cuerpo.
 *
 *  Filtra funcionales y lo que ya ocupa plaza. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isSpanishUpToLevel } from "../../src/lib/cefr/spanishLevels";

const p = new PrismaClient();
const JOURNEY = "cmtmylg7k0007321h6t7njesx";
const CUANTAS: Record<string, number> = {
  "el-pretexto-armado": 1, "un-tinto-que-nadie-pidio": 4, "la-greca-fria": 3,
  "yo-no-dije-nada": 4, "la-casilla-en-blanco": 2, "quiltro-con-dueno": 1,
  "me-quedo-con-el-bote": 1, "antes-eran-mias": 1, "le-falta-sal": 2,
};
/** Sin carga lexica: ocupan plaza y no enseñan nada. */
const FUNCIONALES = new Set([
  "desde", "donde", "cuando", "porque", "aunque", "mismo", "misma", "mismos",
  "todos", "todas", "nadie", "alguien", "también", "menos", "antes", "después",
  "igual", "entre", "contra", "sobre", "hasta", "cuatro", "cinco", "seis",
  "nueve", "treinta", "veinte", "media", "entera", "entero", "había", "hubiera",
  "habría", "tengo", "pongo", "quedo", "veces", "cosa", "cosas", "quién", "dónde",
]);

(async () => {
  for (const [slug, n] of Object.entries(CUANTAS)) {
    const h = await p.journeyStory.findFirst({
      where: { journeyId: JOURNEY, slug }, select: { text: true, vocab: true },
    });
    if (!h) continue;
    const texto = `${h.text}`.toLowerCase();
    const voc = (h.vocab as Array<{ word?: unknown; surface?: unknown }>) ?? [];
    const ocupadas = new Set(voc.flatMap((v) => [String(v?.word ?? ""), String(v?.surface ?? "")]).map((x) => x.toLowerCase()));
    const cuenta = new Map<string, number>();
    for (const w of texto.match(/\p{L}+/gu) ?? []) cuenta.set(w, (cuenta.get(w) ?? 0) + 1);
    const cand = [...cuenta.entries()]
      .filter(([w]) => w.length > 4 && !FUNCIONALES.has(w) && !ocupadas.has(w) && isSpanishUpToLevel(w, "b1"))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14);
    console.log(`\n${slug}  (necesita ${n})`);
    console.log(`  ${cand.map(([w, c]) => `${w} x${c}`).join(", ")}`);
  }
  await p.$disconnect();
})();
