/** Glosas cuya definicion BASE no se parece en nada al ingles de su propia
 *  frase.
 *
 *  Es el fallo de «perdis»: g decia "you lose" y la tarjeta mostraba "At
 *  least" justo debajo. Buscar eso a ojo entre seiscientas claves es una
 *  loteria; buscarlo asi es una lista corta que se lee en un rato. La señal es
 *  tonta a proposito: si ninguna palabra de contenido de la definicion aparece
 *  en la traduccion del trozo, la pareja merece una lectura. Habra falsos
 *  positivos (sinonimos, parafrasis) y por eso NO borra ni corrige nada: solo
 *  lista para leer.
 *
 *  Uso: _contradice.ts <bundle> */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const p = new PrismaClient();

/** Palabras que no distinguen nada: aparecen en cualquier definicion y en
 *  cualquier traduccion, asi que compararlas no dice nada. */
const VACIAS = new Set([
  "a", "an", "the", "to", "of", "in", "on", "at", "for", "with", "by", "from",
  "and", "or", "but", "as", "that", "this", "it", "its", "is", "are", "was",
  "were", "be", "been", "being", "do", "does", "did", "not", "no", "so",
  "you", "your", "he", "she", "they", "we", "i", "his", "her", "their", "our",
  "him", "them", "me", "my", "one", "something", "somebody", "someone", "thing",
  "up", "down", "out", "off", "over", "about", "into", "used", "usually",
  "form", "sense", "way", "when", "who", "what", "which", "here", "there",
]);

const contenido = (s: string) =>
  new Set((s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !VACIAS.has(w)));

/** Raiz burda: recorta la flexion inglesa mas comun para que "laugh" y
 *  "laughing" cuenten como la misma palabra. */
const raiz = (w: string) => w.replace(/(ing|ed|es|s)$/, "");

(async () => {
  const bundle = process.argv[2];
  const filas = await p.tapGlossSet.findMany({ where: { bundle }, select: { slug: true, glosses: true } });
  const vistos = new Set<string>();
  let n = 0;
  for (const f of filas) {
    if (!f.slug) continue;
    for (const [w, v] of Object.entries(f.glosses as Record<string, { g?: string; c?: { es?: string; en?: string } }>)) {
      const g = v?.g, en = v?.c?.en, es = v?.c?.es;
      if (!g || !en || vistos.has(`${w}|${en}`)) continue;
      const a = [...contenido(g)].map(raiz);
      const b = new Set([...contenido(en)].map(raiz));
      if (!a.length || a.some((x) => b.has(x))) continue;
      vistos.add(`${w}|${en}`);
      n++;
      console.log(`${w}\n  g:  ${g}\n  es: ${es}\n  en: ${en}\n  (${f.slug})`);
    }
  }
  console.log(`\n${n} parejas que no comparten ninguna palabra`);
  await p.$disconnect();
})();
