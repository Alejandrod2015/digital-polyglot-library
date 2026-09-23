/**
 * Distractores que son sinonimo o parafrasis de la respuesta, en los
 * ejercicios curados `meaning_in_context` y `listen_choose` de las historias
 * PUBLICADAS de los journeys ACTIVOS de un idioma. Un distractor asi deja dos
 * respuestas defendibles: el ejercicio no mide nada y frustra (2026-09-20, la
 * palabra "opinar" en `un-tinto-que-nadie-pidio`, vista en el Pixel).
 *
 *   npx tsx scripts/checkDistractorSynonyms.ts                    espanol
 *   npx tsx scripts/checkDistractorSynonyms.ts --language german
 *   npx tsx scripts/checkDistractorSynonyms.ts --story <slug>     una historia
 *
 * Tres criterios, todos sobre la forma normalizada (minusculas, sin
 * puntuacion, sin stopwords inglesas, con un stem ligero):
 *
 *   1. clave compartida: las claves del distractor y las de la respuesta se
 *      contienen o coinciden en la mitad o mas ("the counter" / "the serving
 *      counter"). Compartir una palabra suelta no basta: "without hurry" y
 *      "without paying" son un buen par paralelo, no sinonimos.
 *   2. glosa de la misma palabra: el distractor coincide con la CABEZA de la
 *      definicion que `JourneyStory.vocab` da a la palabra del ejercicio, o
 *      con la glosa que esa misma palabra lleva en otra historia del idioma.
 *      La cabeza es lo que va antes de `;`, `,`, una negacion o una relativa:
 *      "Small; not big" define por contraste, y "big" no es sinonimo.
 *   3. traduce la misma palabra: en `listen_choose` las opciones son
 *      palabras del idioma; un distractor cuya glosa (vocab de cualquier
 *      historia del idioma) coincide en cabeza con la glosa de la respuesta,
 *      o que es la misma palabra con otra forma (plural, acento), se marca.
 *
 * Imprime una tabla Markdown y sale con 1 si hay filas. Es un detector: la
 * fila dice "sospechoso", y la decision es de quien lee la historia.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const STOPWORDS = new Set(
  `a an the to of in on at for with and or it its is be do does did you your he she they we i me him her
  them this that these those what who whom whose which up out by from as so not no very something someone
  somebody anything one some about into than then there here get got go make made have has had
  are was were will would can could should may might when where while if but all any each every own same
  more most other just only also too being been am my our us his their yours how why
  s t re ve ll d don doesn isn`.split(/\s+/)
);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

/** Palabras de contenido de una glosa inglesa. */
function keys(text: string): Set<string> {
  return new Set(
    stripAccents(text.toLowerCase())
      .replace(/[^a-z\s'-]/g, " ")
      .split(/[\s'-]+/)
      .filter((w) => w && !STOPWORDS.has(w))
      .map(stem)
  );
}

function shared(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((k) => b.has(k));
}

function subset(a: Set<string>, b: Set<string>): boolean {
  return a.size > 0 && [...a].every((k) => b.has(k));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const inter = shared(a, b).length;
  const union = new Set([...a, ...b]).size;
  return union ? inter / union : 0;
}

/**
 * La cabeza de una glosa: lo que va antes del primer `;`, `,`, `:` o
 * parentesis, y antes de una negacion o una relativa, que es donde la
 * definicion pasa a explicar por contraste o a dar contexto.
 */
function head(text: string): string {
  return text
    .split(/[;,:(]/)[0]
    .split(/\b(?:not|no|never|without|rather than|instead of|that|which|who|where|when|because|here)\b/i)[0]
    .trim();
}

/** El distractor dice lo mismo que la cabeza de esa glosa. */
function matchesGloss(dKeys: Set<string>, glossText: string): boolean {
  const hKeys = keys(head(glossText));
  if (hKeys.size === 0 || dKeys.size === 0) return false;
  const first = [...hKeys][0];
  if (subset(hKeys, dKeys)) return true;
  return subset(dKeys, hKeys) && dKeys.has(first);
}

function normWord(w: string): string {
  return stripAccents(w.toLowerCase().trim());
}

/** Misma palabra del idioma con otra forma: plural o acento. */
function sameWordForm(a: string, b: string): boolean {
  const x = normWord(a);
  const y = normWord(b);
  if (x === y) return true;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  return l === s + "s" || l === s + "es" || (s.endsWith("s") && l === s.slice(0, -1) + "es");
}

type VocabEntry = { word?: string; definition?: string; type?: string };

type Row = {
  journey: string;
  story: string;
  word: string;
  answer: string;
  distractor: string;
  motivo: string;
};

async function main() {
  const language = (arg("language") ?? "spanish").toLowerCase();
  const onlyStory = arg("story");

  const stories = await prisma.journeyStory.findMany({
    where: {
      status: "published",
      ...(onlyStory ? { slug: onlyStory } : {}),
      journey: { status: "active", language },
    },
    select: {
      slug: true,
      level: true,
      vocab: true,
      journey: { select: { name: true, variant: true } },
      practiceSet: {
        select: {
          exercises: {
            where: { type: { in: ["meaning_in_context", "listen_choose"] } },
            orderBy: { orderIndex: "asc" },
            select: { id: true, type: true, word: true, payload: true },
          },
        },
      },
    },
    orderBy: [{ journey: { variant: "asc" } }, { level: "asc" }, { slug: "asc" }],
  });

  // Indice de glosas del idioma: palabra (normalizada) -> claves de cada
  // glosa que se le ha dado (definicion del vocab de cualquier historia y
  // respuesta de cualquier `meaning_in_context`). Para el criterio 2 (otra
  // historia) y el 3 (listen_choose).
  const glossIndex = new Map<string, { text: string; keys: Set<string>; story: string }[]>();
  const addGloss = (word: string, text: string, story: string) => {
    const k = normWord(word);
    if (!k || !text) return;
    const list = glossIndex.get(k) ?? [];
    list.push({ text, keys: keys(text), story });
    glossIndex.set(k, list);
  };
  for (const s of stories) {
    for (const v of (Array.isArray(s.vocab) ? (s.vocab as VocabEntry[]) : [])) {
      if (v?.word && v.definition) addGloss(v.word, v.definition, s.slug ?? "");
    }
    for (const e of s.practiceSet?.exercises ?? []) {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      if (e.type === "meaning_in_context" && typeof p.answer === "string") addGloss(e.word, p.answer, s.slug ?? "");
    }
  }

  const rows: Row[] = [];
  let checked = 0;
  for (const s of stories) {
    const journey = `${s.journey.name} ${s.journey.variant} ${s.level.toUpperCase()}`;
    const vocab = Array.isArray(s.vocab) ? (s.vocab as VocabEntry[]) : [];
    for (const e of s.practiceSet?.exercises ?? []) {
      const p = (e.payload ?? {}) as Record<string, unknown>;
      const options = Array.isArray(p.options) ? (p.options as string[]) : [];
      const answer = typeof p.answer === "string" ? p.answer : e.word;
      const distractors = options.filter((o) => o !== answer);
      if (distractors.length === 0) continue;
      checked++;
      const flag = (distractor: string, motivo: string) =>
        rows.push({ journey, story: s.slug ?? "", word: e.word, answer, distractor, motivo });

      if (e.type === "meaning_in_context") {
        const aKeys = keys(answer);
        const ownDef = vocab.find((v) => v?.word && sameWordForm(v.word, e.word))?.definition ?? "";
        const elsewhere = (glossIndex.get(normWord(e.word)) ?? []).filter((g) => g.story !== s.slug);
        for (const d of distractors) {
          const dKeys = keys(d);
          const common = shared(aKeys, dKeys);
          if (common.length && (subset(aKeys, dKeys) || subset(dKeys, aKeys) || jaccard(aKeys, dKeys) >= 0.5)) {
            flag(d, `1 clave compartida con la respuesta: ${common.join(", ")}`);
          } else if (ownDef && matchesGloss(dKeys, ownDef)) {
            flag(d, `2 coincide con la glosa de "${e.word}" en vocab: "${ownDef}"`);
          } else {
            const hit = elsewhere.find((g) => matchesGloss(dKeys, g.text));
            if (hit) flag(d, `2 glosa de "${e.word}" en ${hit.story}: "${hit.text}"`);
          }
        }
      } else {
        // listen_choose: opciones en el idioma. Glosa de la respuesta = la
        // del vocab de ESTA historia si existe, si no cualquiera del indice.
        const ownDef = vocab.find((v) => v?.word && sameWordForm(v.word, answer))?.definition;
        const aGlosses = ownDef ? [ownDef] : (glossIndex.get(normWord(answer)) ?? []).map((g) => g.text);
        const trs = Array.isArray(p.optionTranslations) ? (p.optionTranslations as string[]) : null;
        const aTr = trs ? trs[options.indexOf(answer)] : null;
        for (const d of distractors) {
          if (sameWordForm(d, answer)) { flag(d, `3 misma palabra que la respuesta con otra forma`); continue; }
          const dTr = trs ? trs[options.indexOf(d)] : null;
          if (aTr && dTr) {
            const common = shared(keys(aTr), keys(dTr));
            if (common.length) { flag(d, `3 la traduccion "${dTr}" comparte clave con "${aTr}": ${common.join(", ")}`); continue; }
          }
          const dGlosses = glossIndex.get(normWord(d)) ?? [];
          let hit: string | null = null;
          for (const ag of aGlosses) {
            for (const dg of dGlosses) {
              if (matchesGloss(keys(head(dg.text)), ag) || matchesGloss(keys(head(ag)), dg.text)) {
                hit = `3 la glosa de "${d}" ("${dg.text}") dice lo mismo que la de "${answer}" ("${ag}")`;
                break;
              }
            }
            if (hit) break;
          }
          if (hit) flag(d, hit);
        }
      }
    }
  }

  const cell = (v: string) => v.replace(/\|/g, "/").replace(/\n/g, " ");
  console.log(`${language}: ${stories.length} historias publicadas de journeys activos, ${checked} ejercicios revisados, ${rows.length} distractores sospechosos\n`);
  console.log("| journey | historia | palabra | respuesta | distractor sospechoso | motivo |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    console.log(`| ${cell(r.journey)} | ${cell(r.story)} | ${cell(r.word)} | ${cell(r.answer)} | ${cell(r.distractor)} | ${cell(r.motivo)} |`);
  }
  process.exitCode = rows.length ? 1 : 0;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
