/**
 * saveStory.ts; THE ONLY sanctioned way to write JourneyStory CONTENT
 * (title/slug/text/vocab/arcType/synopsis) to the database.
 *
 * WHY THIS EXISTS (hard rule, 2026-07-09): a pilot was reported as
 * "validated" after running only the Python PRE-validator (a subset).
 * The canonical gate is `validateGeneratedStory` (src/lib). To make it
 * IMPOSSIBLE to skip that gate, this saver runs the canonical validator
 * IN-PROCESS and refuses to write a single row unless EVERY story in the
 * batch returns ok===true. Validation + write are atomic in one process,
 * so there is no stale-stamp window. The PreToolUse hook
 * `.claude/safety/pre-story-save-guard.sh` blocks every OTHER script that
 * writes journeyStory content, funnelling all saves through here.
 *
 * Usage:
 *   npx tsx scripts/saveStory.ts <data.json> --journey <id> \
 *       [--lang ES] [--level c1] [--variant LATAM] [--publish] [--dry]
 *
 * Modos que NO escriben contenido nuevo y por eso sustituyen el juicio
 * editorial sobre el resto de la historia por una comprobación mecánica de
 * que nada más cambia (ver cada bloque para el porqué):
 *   --typography-only   migración de comillas
 *   --title-only        acortar un título que se corta en la tarjeta
 *
 * ORDEN DE TEMAS (2026-09-05): antes de escribir nada comprueba que el tema
 * ANTERIOR del journey tenga cierre vigente en scripts/tema-cierres.json
 * (scripts/cierraTema.ts). Sin variable de escape.
 *
 * data.json: array of story objects { topic, slotIndex, title, slug?,
 *   synopsis, text, vocab[], arcType }. Rows are matched by
 *   (journeyId, topic, slotIndex) and updated.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

// Neutraliza el guard `server-only` (el validador importa el juez CEFR que lo usa).
import { createRequire } from "module";
const __req = createRequire(__filename);
try {
  const p = __req.resolve("server-only");
  (__req as unknown as { cache: Record<string, unknown> }).cache[p] = {
    id: p, filename: p, loaded: true, exports: {},
  };
} catch { /* noop */ }

import * as fs from "fs";
import { variantPool } from "@domain/languageVariant";
import { PrismaClient } from "../src/generated/prisma";
import { validateGeneratedStory, extractStoryMotifs, extractProperNouns, type ExistingStorySummary } from "@/lib/validateGeneratedStory";
import { renderedParagraphs } from "@/lib/readerParagraphs";
import { validateJourneyStories, type JourneyStoryInput, type JourneyCheck } from "@/lib/validateJourneyStories";
import { candadoCierrePrevio, type HistoriaCierre } from "./temaCierres";

/** Build the cross-story summary the canonical validator needs to run its
 *  repetition / rotation / opening-rhythm / motif checks against siblings. */
function summarize(d: any): ExistingStorySummary {
  const names = new Set<string>();
  for (const line of String(d.text).split(/\r?\n/)) {
    const m = line.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñü]+):\s/);
    if (m) names.add(m[1]);
  }
  // Las líneas `Nombre: …` solo existen en el formato diálogo. En prosa
  // narrada el reparto vive dentro del párrafo, así que hay que sacarlo del
  // cuerpo con el MISMO extractor que usa el validador; si no, cada historia
  // narrada declara cero personajes y la siguiente cree que todos son nuevos.
  for (const n of extractProperNouns(String(d.text))) names.add(n);
  const firstPara = String(d.text).split(/\n{2,}/)[0] ?? "";
  const firstSentence = (firstPara.split(/(?<=[.!?])\s/)[0] ?? firstPara).trim();
  return {
    title: d.title,
    arcType: d.arcType ?? null,
    vocabLemmas: (d.vocab ?? []).map((v: any) => String(v.word)),
    characterNames: [...names],
    openingFirstSentence: firstSentence,
    motifTags: extractStoryMotifs(String(d.text)),
  };
}

/**
 * ¿La edición empeora esta regla de conjunto respecto a como estaba?
 *
 * Conservador a propósito: devuelve "empeora" siempre que no pueda demostrar
 * lo contrario. Cuatro casos y ninguno más:
 *
 *   1. Antes pasaba y ahora no        -> EMPEORA. Sin excepción.
 *   2. El detalle es idéntico          -> igual. La edición no la tocó.
 *   3. Los dos detallan historias, y   -> igual o mejor. Ninguna historia
 *      las de ahora son un subconjunto    nueva entra en la lista de fallos.
 *      de las de antes
 *   4. Cualquier otra cosa             -> EMPEORA.
 *
 * Se compara por SLUG y no por los números del detalle porque el sentido de
 * un número depende de la regla: en `journey-quoted-speech-band` un 3% es
 * peor que un 7%, y en `journey-closing-alone` 17 es peor que 12. El conjunto
 * de historias señaladas, en cambio, significa lo mismo en todas.
 */
function empeora(antes: JourneyCheck | undefined, ahora: JourneyCheck, slugs: string[]): boolean {
  if (!antes || antes.status === "pass") return true;
  const da = (antes.detail ?? "").trim();
  const dh = (ahora.detail ?? "").trim();
  if (da === dh) return false;
  const mencionadas = (d: string) => new Set(slugs.filter((s) => d.includes(s)));
  const A = mencionadas(da);
  const H = mencionadas(dh);
  if (A.size === 0 || H.size === 0) return true;
  if (H.size > A.size) return true;
  for (const s of H) if (!A.has(s)) return true;
  return false;
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  return fallback;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

(async () => {
  const dataFile = process.argv[2];
  if (!dataFile || dataFile.startsWith("--")) {
    console.error("usage: saveStory.ts <data.json> --journey <id> [--lang ES --level c1 --variant LATAM] [--publish] [--dry] [--typography-only]");
    process.exit(2);
  }
  const journeyId = arg("journey");
  const dry = flag("dry");
  const publish = flag("publish");
  // C1-NARRATOR profile: single-voice narrated prose (3rd person + brief quotes),
  // NOT multi-voice dialogue. It legitimately fails the format checks that assume
  // "Speaker: line" turns. --narrator exempts EXACTLY those three format checks
  // (dialogue-ratio, speakers-count, speaker-lines) and NOTHING else; modismos,
  // defs, no-digits, arc, CEFR, distribution, cross-story dedup all still gate.
  const narrator = flag("narrator");
  const typographyOnly = flag("typography-only");
  // MODO SOLO-TÍTULO (2026-09-04). Mismo problema y misma cura que
  // --typography-only, un escalón más arriba: el título SÍ es contenido
  // editorial, así que aquí no basta con una verificación mecánica y el
  // título nuevo pasa por el validador CANÓNICO. Lo que se levanta es la
  // exigencia de que el RESTO de la historia cumpla el estándar de hoy, que
  // es deuda anterior y ajena al cambio. Ver el bloque `titleOnly`.
  const titleOnly = flag("title-only");
  // TRINQUETE (2026-08-26). El gate de conjunto es absoluto: exige que las 21
  // historias cumplan el estandar de HOY. Un journey escrito antes de una
  // regla queda congelado para siempre, sin poder recibir ni la correccion de
  // una palabra: el Friends ES/Spain A0 se escribio el 19 de julio y las
  // cuatro reglas de apertura, cierre, habla citada y repeticion entraron el
  // 23 de agosto. Eso mete en el mismo saco dos cosas distintas: "esta edicion
  // introduce un defecto" y "este journey arrastra deuda anterior a la regla".
  // Solo la primera es motivo para no dejar escribir.
  //
  // Con --no-regression el gate deja de exigir limpieza y pasa a exigir que la
  // edicion NO EMPEORE: mide el conjunto ANTES (lo que hay en la base) y
  // DESPUES (con la edicion), regla a regla. Lo que no sepa comparar, lo
  // rechaza. NO toca el validador canonico por historia, que sigue en cero
  // tolerancia; esto es solo para las reglas de CONJUNTO.
  const noRegression = flag("no-regression");
  // These checks all assume the multivoice "Speaker: line" format: they read
  // character names / turns from speaker labels, which a narrated prose story
  // (names in the prose, not in labels) does not have. Exempt ONLY these; the
  // same four the spec lists as known A0-narrator exemptions.
  //
  // vocab-count is NOT exempt (2026-07-09). It was, briefly, and that was a
  // mistake: the profile "replaced" the spec's hard minimum of 20 with a
  // homegrown minimum of 12, on the theory that pills stack in prose and read
  // like a highlighted exercise. Our own A0 narrator precedent refutes it ;
  // 22-26 items in 135-145 words, ~1 pill per 6 words, shipped and approved,
  // 3x denser. Relaxing a gate so the output passes is exactly what
  // `feedback_calibrate_gates_to_gold_standard` forbids. A high count is
  // bounded by DISTRIBUTION (spread it), never by cutting the count.
  // `names-match` SALE de la lista (2026-08-14). Entró aquí cuando comparaba
  // los nombres de la sinopsis contra los HABLANTES del diálogo, que en prosa
  // narrada no existen. Pero el check se arregló para buscar el nombre en todo
  // el cuerpo (ver su comentario en validateGeneratedStory), y desde entonces
  // funciona igual de bien narrado: una sinopsis que promete un personaje que
  // no aparece es un defecto en cualquier formato. Nadie lo sacó de la lista al
  // arreglarlo, así que llevaba tiempo sin comprobarse en todo el A0 y en los
  // Friends C1 narrados. Mismo patrón que el de la habla citada: una exención
  // que se come el requisito.
  const NARRATOR_EXEMPT = new Set([
    "body-dialogue-ratio", "speakers-count", "speaker-lines",
  ]);
  const ctx = {
    language: arg("lang", "ES")!,
    level: arg("level", "c1")!,
    variant: arg("variant", "LATAM")!,
  };
  if (!journeyId && !dry) {
    console.error("FAIL: --journey <id> is required (or use --dry to validate only).");
    process.exit(2);
  }

  const stories = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  if (!Array.isArray(stories)) { console.error("FAIL: data file must be a JSON array."); process.exit(2); }

  // ── MODO TIPOGRÁFICO (migración de comillas) ──────────────────
  //
  // Un cambio de comillas no introduce contenido nuevo, así que no hay nada
  // que el gate editorial pueda juzgar. En su lugar corre una comprobación
  // MÁS estricta que el gate: el texto nuevo tiene que ser idéntico al que
  // ya está en la base de datos SALVO caracteres de comilla, y de la misma
  // longitud (para que los offsets charStart/charEnd del karaoke sigan
  // apuntando al mismo sitio). Si cambia una sola letra, no escribe nada.
  //
  // POR QUÉ EXISTE (2026-08-17): el validador canónico exige que la historia
  // entera cumpla el estándar ACTUAL, y el corpus se escribió con estándares
  // anteriores. Eso dejaba a las historias publicadas sin poder recibir ni
  // una corrección tipográfica: fallaban por deuda propia (falta un ancla
  // sensorial, un nombre solo en la sinopsis) y arrastraban a las vecinas de
  // su topic. Esto NO relaja el gate; lo sustituye por una verificación
  // mecánica, para el único caso en que el gate no puede aportar nada.
  if (typographyOnly) {
    if (!journeyId) { console.error("FAIL: --typography-only requiere --journey <id>."); process.exit(2); }
    const QUOTE_CHARS = /[«»„“”"'‘’]/g;
    const canon = (v: string) => v.replace(QUOTE_CHARS, "\u0001");
    const countQuotes = (v: string) => (v.match(QUOTE_CHARS) ?? []).length;
    const prisma = new PrismaClient();
    try {
      const plan: { id: string; slug: string; fields: Record<string, string>; swaps: number }[] = [];
      for (const d of stories) {
        const slot = await prisma.journeyStory.findFirst({
          where: { journeyId, topic: d.topic, slotIndex: d.slotIndex },
          select: { id: true, slug: true, title: true, text: true, synopsis: true, vocab: true,
                    audioSegments: true, audioFragments: true, audioWordTimings: true },
        });
        if (!slot) { console.error(`FAIL: sin slot para ${d.topic}#${d.slotIndex}. Nada escrito.`); process.exit(1); }
        const fields: Record<string, string> = {};
        let swaps = 0;
        // `vocab` es JSON. NO se puede comparar serializado: dentro del JSON
        // una comilla recta va escapada (\" = 2 caracteres) y una inglesa no
        // (“ = 1), así que el swap cambia la longitud del serializado aunque
        // no cambie la de ningún valor. Se canoniza el OBJETO campo a campo.
        const canonDeep = (v: unknown): unknown => {
          if (typeof v === "string") return canon(v);
          if (Array.isArray(v)) return v.map(canonDeep);
          if (v && typeof v === "object") {
            const o: Record<string, unknown> = {};
            for (const [k, val] of Object.entries(v)) o[k] = canonDeep(val);
            return o;
          }
          return v;
        };
        const lensDeep = (v: unknown, out: number[] = []): number[] => {
          if (typeof v === "string") out.push(v.length);
          else if (Array.isArray(v)) v.forEach((x) => lensDeep(x, out));
          else if (v && typeof v === "object") Object.values(v).forEach((x) => lensDeep(x, out));
          return out;
        };
        const beforeVocab = JSON.stringify(slot.vocab ?? null);
        const afterVocab = JSON.stringify(d.vocab ?? null);
        if (beforeVocab !== afterVocab) {
          const lb = lensDeep(slot.vocab ?? null), la = lensDeep(d.vocab ?? null);
          const sameLens = lb.length === la.length && lb.every((n, i) => n === la[i]);
          if (!sameLens || JSON.stringify(canonDeep(slot.vocab ?? null)) !== JSON.stringify(canonDeep(d.vocab ?? null))) {
            console.error(`FAIL ${slot.slug ?? slot.id} .vocab: el cambio NO es solo de comillas. Nada escrito.`);
            process.exit(1);
          }
          (fields as Record<string, unknown>).vocab = d.vocab;
          swaps += countQuotes(afterVocab);
        }
        for (const field of ["text", "synopsis", "title"] as const) {
          const before = slot[field];
          const after = d[field];
          if (typeof before !== "string" || typeof after !== "string") continue;
          if (before === after) continue;
          const sameLength = before.length === after.length && canon(before) === canon(after);
          // Espacios repetidos. Un espacio de más metido DESPUÉS de renderizar
          // el audio corre todos los `charStart/charEnd` de ahí en adelante y
          // el karaoke resalta la palabra anterior: el 2026-08-21, en
          // `despues-del-carnaval`, 115 de 142 palabras. Quitarlo no es
          // editorial (nadie ve un espacio doble) y el gate canónico no puede
          // arreglarlo, porque rechaza la historia por deuda ajena.
          //
          // El permiso es estrecho a propósito: el texto solo puede diferir en
          // comillas y en RUNS de espacios, y si la historia tiene karaoke el
          // cambio se escribe solo si lo deja PERFECTAMENTE alineado. Esa
          // comprobación es más dura que la de longitud, no más blanda.
          const collapse = (v: string) => canon(v).replace(/[^\S\n]+/g, " ");
          const onlySpacing = !sameLength && collapse(before) === collapse(after);
          if (!sameLength && !onlySpacing) {
            console.error(`FAIL ${slot.slug ?? slot.id} .${field}: el cambio NO es solo de comillas ni de espacios. Nada escrito.`);
            process.exit(1);
          }
          if (onlySpacing && field === "text") {
            const wt = slot.audioWordTimings as { words?: Array<{ text: string; charStart: number; charEnd: number }> } | null;
            const words = wt?.words ?? [];
            const off = words.filter((w) => after.slice(w.charStart, w.charEnd) !== w.text).length;
            if (words.length && off > 0) {
              console.error(`FAIL ${slot.slug ?? slot.id} .text: quitar los espacios deja ${off}/${words.length} palabras del karaoke sin alinear. Nada escrito.`);
              process.exit(1);
            }
            const antes = words.filter((w) => before.slice(w.charStart, w.charEnd) !== w.text).length;
            console.log(`  [espacios] ${slot.slug ?? slot.id}: ${before.length - after.length} caracteres menos; karaoke ${antes} -> 0 desalineadas.`);
          }
          fields[field] = after;
          swaps += countQuotes(after);
        }
        // Los ESPEJOS del cuerpo. `audioSegments[].text` y `audioFragments[].text`
        // guardan la oración tal como se narró, así que tras migrar el cuerpo
        // se quedan con las comillas viejas: el 2026-08-21 el A1 de España
        // quedó con el cuerpo en curvas y sus 13 segmentos en rectas. No se
        // ven en el lector, pero son la misma frase escrita de dos maneras.
        //
        // El mapeo es posicional y no una sustitución a ciegas: un segmento
        // puede abrir comilla y cerrarla en el siguiente. Como este modo ya
        // garantiza que el cuerpo nuevo mide lo mismo que el viejo, el tramo
        // equivalente de un fragmento es el MISMO rango de índices.
        if (typeof slot.text === "string") {
          // El cuerpo de referencia es el nuevo si esta tanda lo cambia, y el
          // que ya está en la base si el cuerpo se migró antes que sus espejos.
          const after = typeof fields.text === "string" ? fields.text : slot.text;
          // `canon` sustituye cada comilla por un carácter neutro y NO la borra,
          // así que conserva la longitud: el índice hallado sobre el cuerpo
          // canonizado es ya el índice real. (Restando posiciones como si canon
          // borrara, el tramo salía corrido un carácter y no migraba nada.)
          const canonAfter = canon(after);
          for (const key of ["audioSegments", "audioFragments"] as const) {
            const arr = slot[key] as Array<Record<string, unknown>> | null;
            if (!Array.isArray(arr)) continue;
            let changed = false;
            const next = arr.map((item) => {
              const t = typeof item.text === "string" ? item.text : null;
              if (!t || !countQuotes(t)) return item;
              const ct = canon(t);
              const at = canonAfter.indexOf(ct);
              if (at < 0 || canonAfter.indexOf(ct, at + 1) >= 0) return item; // ausente o ambiguo
              const cand = after.slice(at, at + t.length);
              if (cand.length !== t.length || canon(cand) !== ct || cand === t) return item;
              changed = true;
              swaps += countQuotes(cand);
              return { ...item, text: cand };
            });
            if (changed) (fields as Record<string, unknown>)[key] = next;
          }
        }
        if (Object.keys(fields).length) plan.push({ id: slot.id, slug: slot.slug ?? slot.id, fields, swaps });
      }
      const total = plan.reduce((n, x) => n + x.swaps, 0);
      console.log(`[typography-only] ${plan.length}/${stories.length} historias con comillas que cambiar (${total} comillas).`);
      if (dry) { for (const x of plan) console.log(`  · ${x.slug} [${Object.keys(x.fields).join(", ")}]`); console.log("--dry: no DB write."); return; }
      for (const x of plan) {
        await prisma.journeyStory.update({ where: { id: x.id }, data: x.fields });
        console.log(`  ✓ ${x.slug} [${Object.keys(x.fields).join(", ")}]`);
      }
      console.log(`[typography-only] ${plan.length} historias actualizadas.`);
    } finally {
      await prisma.$disconnect();
    }
    return;
  }

  // ── MODO SOLO-TÍTULO ─────────────────────────────────────────
  //
  // Cambia el `title` y NADA más. Nace del tope de 26 caracteres
  // (`TITLE_MAX_CHARS`, 2026-09-04): 110 títulos ya guardados lo superan y
  // salen cortados con puntos suspensivos en la tarjeta del path, pero por la
  // vía normal no se pueden arreglar. El gate canónico exige que la historia
  // ENTERA cumpla el estándar de hoy, y estas se escribieron con el anterior:
  // de 42 candidatas, 34 fallaban por vocabulario ya enseñado, cuerpo largo o
  // rotación de arco. Deuda propia, ajena al título.
  //
  // ESTO NO RELAJA EL GATE DONDE OCURRE EL CAMBIO. El título nuevo pasa por
  // `validateGeneratedStory`, el mismo validador de siempre, y se exigen sus
  // checks `title-*` en verde (largo, patrones prohibidos, lo que se añada
  // mañana). Lo que se levanta es el juicio sobre el resto del cuerpo, que
  // aquí no se toca ni un carácter: se comprueba campo a campo contra la base
  // y a la primera diferencia no se escribe nada.
  //
  // AUDIO: rechaza toda historia narrada. El título se lee en la narración
  // (`buildAlignmentText` lo antepone al cuerpo), así que cambiarlo dejaría a
  // la voz diciendo el título viejo. Esas se arreglan al re-narrar, no aquí.
  if (titleOnly) {
    if (!journeyId) { console.error("FAIL: --title-only requiere --journey <id>."); process.exit(2); }
    const prisma = new PrismaClient();
    try {
      const plan: { id: string; slug: string; antes: string; ahora: string }[] = [];
      const problemas: string[] = [];
      for (const d of stories) {
        const slot = await prisma.journeyStory.findFirst({
          where: { journeyId, topic: d.topic, slotIndex: d.slotIndex },
          select: { id: true, slug: true, title: true, text: true, synopsis: true, vocab: true,
                    arcType: true, audioUrl: true, audioWordTimings: true },
        });
        if (!slot) { problemas.push(`sin slot para ${d.topic}#${d.slotIndex}`); continue; }
        const nombre = slot.slug ?? slot.id;

        if (slot.audioUrl || slot.audioWordTimings) {
          problemas.push(`${nombre}: ya está narrada; el título se oye en el audio`);
          continue;
        }
        // Todo lo que no sea el título tiene que llegar idéntico.
        const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
        for (const campo of ["text", "synopsis", "vocab", "arcType"] as const) {
          if (d[campo] !== undefined && !igual(d[campo], slot[campo])) {
            problemas.push(`${nombre}: .${campo} no coincide con la base; --title-only solo cambia el título`);
          }
        }
        if (d.slug !== undefined && d.slug !== slot.slug) {
          problemas.push(`${nombre}: el slug cambiaría (${slot.slug} -> ${d.slug}); las URLs guardadas dejarían de resolver`);
        }
        if (typeof d.title !== "string" || !d.title.trim()) { problemas.push(`${nombre}: falta el título nuevo`); continue; }
        if (d.title === slot.title) continue; // nada que hacer

        // El título nuevo pasa por el validador canónico; se exigen sus checks de título.
        const r = await validateGeneratedStory(
          { ...d, title: d.title, slug: slot.slug ?? undefined },
          { language: ctx.language, level: ctx.level, variant: ctx.variant } as never
        );
        const malos = r.checks.filter((c) => c.id.startsWith("title-") && c.status === "fail");
        if (malos.length) {
          for (const c of malos) problemas.push(`${nombre}: [${c.id}] ${c.detail ?? c.label}`);
          continue;
        }
        plan.push({ id: slot.id, slug: nombre, antes: slot.title ?? "", ahora: d.title });
      }

      // Un título repetido dentro del journey confunde igual que uno cortado.
      const hermanas = await prisma.journeyStory.findMany({
        where: { journeyId, id: { notIn: plan.map((p) => p.id) } }, select: { title: true },
      });
      const ocupados = new Set(hermanas.map((h) => (h.title ?? "").trim().toLowerCase()).filter(Boolean));
      for (const p of plan) {
        if (ocupados.has(p.ahora.trim().toLowerCase())) problemas.push(`${p.slug}: "${p.ahora}" ya es el título de otra historia del journey`);
      }

      if (problemas.length) {
        console.error(`✗ [title-only] ${problemas.length} problema(s). NOTHING WRITTEN.`);
        for (const p of problemas) console.error(`   FAIL ${p}`);
        process.exit(1);
      }
      console.log(`[title-only] ${plan.length}/${stories.length} títulos que cambiar.`);
      for (const p of plan) console.log(`  · ${p.slug}: "${p.antes}" (${p.antes.length}) -> "${p.ahora}" (${p.ahora.length})`);
      if (dry) { console.log("--dry: no DB write."); return; }
      for (const p of plan) {
        await prisma.journeyStory.update({ where: { id: p.id }, data: { title: p.ahora } });
        console.log(`  ✓ ${p.slug}`);
      }
      console.log(`[title-only] ${plan.length} títulos actualizados.`);
    } finally {
      await prisma.$disconnect();
    }
    return;
  }

  // ── GATE: canonical validator, in-process, zero tolerance ──
  // Each story is validated against its already-validated SIBLINGS in this
  // batch (vocab-repetition, arcType-rotation, opening-rhythm, motif and
  // anchor cross-story checks). Topic-by-topic saves put all 3 in one file,
  // so this enforces intra-topic dedup with no manual step.
  const allTitles: string[] = stories.map((s: any) => s.title);

  // Vocabulario que YA enseñan OTROS journeys del mismo idioma. Sin esto cada
  // historia se valida sola y nadie ve que el nivel entero está reenseñando lo
  // anterior: las tres primeras del A1 brasileño repetían el 60% del A0
  // (2026-08-18). Se excluye el journey propio, cuya repetición interna ya la
  // vigila `vocab-repetition`.
  const { taughtElsewhere, taughtSameType } = await (async () => {
    if (!journeyId) return { taughtElsewhere: [] as string[], taughtSameType: [] as string[] };
    const p2 = new PrismaClient();
    try {
      const mio = await p2.journey.findUnique({ where: { id: journeyId }, select: { language: true, typeSlug: true, variant: true } });
      if (!mio) return { taughtElsewhere: [] as string[], taughtSameType: [] as string[] };
      const otras = await p2.journeyStory.findMany({
        where: {
          journey: { language: mio.language, status: { not: "archived" } },
          journeyId: { not: journeyId },
        },
        select: { vocab: true, journey: { select: { typeSlug: true, levels: true, variant: true } } },
      });
      const out = new Set<string>();
      const duro = new Set<string>();
      // La capa PORTABLE se reabre entre journeys (decision del 2026-08-23,
      // montando el Traveler IT A1). El A0 se lleva casi todos los verbos,
      // adjetivos, adverbios y expresiones del idioma, y sin ellos un nivel
      // posterior solo puede ensenar sustantivos pegados a su escena, que por
      // construccion no reaparecen nunca: la escalera de recirculacion se
      // vuelve aritmeticamente imposible y la prosa se deforma para alojar lo
      // raro que queda libre.
      //
      // La decision estaba en memoria y en el brief, pero NO en el codigo: el
      // 2026-09-01, escribiendo el A2 latam, de 41 palabras corrientes de la
      // escena habia 39 bloqueadas y lo que quedaba libre era "pecera",
      // "abaco", "cernidor" y "grapadora". De ahi salieron frases que no
      // ocurren, solo alojan una palabra ("bosqueja el reflejo"). El prefiltro
      // reabre 1.990 lemas, entre ellos apoyar, quedar, tomar, buscar,
      // dibujar y acercarse.
      //
      // Tiene que cubrir los DOS cubos: abrir solo el de tolerancia cero no
      // sirve de nada, porque `vocab-taught-elsewhere` (tope 2) sigue
      // bloqueando por la misma capa.
      //
      // Lo que NO se reabre: los sustantivos, los nombres de comida y las
      // piezas de la escena siguen a cero, y las historias del PROPIO journey
      // (mas abajo) tambien, portables incluidas: ahi repetir una palabra es
      // cobrarle dos veces al mismo lector.
      // LOS DOS CUBOS SE COMPARAN DENTRO DEL POOL DE VARIANTE. La regla de
      // cero solape es del 2026-08-18 y su premisa es "el lector ya la tiene en
      // su repaso". El 2026-08-20 la pestaña de journeys pasó a servir SOLO la
      // variante del alumno, y en ese emparejamiento España va sola. Desde
      // entonces la premisa es falsa para otra variante: a un alumno de España
      // se le estaban quitando las palabras del Traveler LATAM, que no puede
      // abrir. Mismo tipo y mismo pool: cero. Mismo pool y otro tipo: el tope
      // de dos por historia. Otro pool: no cuenta. Si no se sabe el pool,
      // cuenta como el mismo, que es el lado seguro.
      const miPool = variantPool(mio.variant);
      const mismoPool = (v?: string | null) => {
        const suyo = variantPool(v);
        if (!miPool || !suyo) return true;
        return miPool === suyo;
      };
      const PORTABLES = new Set(["verb", "adjective", "adverb", "expression"]);
      const miNivel = (ctx.level ?? "").toLowerCase();
      for (const r of otras) {
        if (!mismoPool(r.journey?.variant)) continue;
        const mismoTipo = !!mio.typeSlug && r.journey?.typeSlug === mio.typeSlug;
        const mismoNivel = (r.journey?.levels ?? []).some(
          (l) => String(l).toLowerCase() === miNivel
        );
        for (const v of ((r.vocab as Array<{ word?: unknown; type?: unknown }> | null) ?? [])) {
          if (!v?.word) continue;
          const portable = PORTABLES.has(String(v.type ?? "").toLowerCase());
          // CAPA PORTABLE: se reabre entre journeys del mismo tipo, decision
          // del 2026-08-23.
          // La portable se exime SIEMPRE, venga del tipo que venga: asi
          // estaba antes del 2026-09-01 y al condicionarla a `mismoTipo`
          // se colo una regresion que dejo en rojo historias ya guardadas.
          if (portable) continue;
          // CAPA ANCLADA: se reabre entre NIVELES del mismo tipo (2026-09-01).
          //
          // El mismo argumento que abrio la portable, medido en el A2 latam:
          // con la anclada a cero contra todo el tipo, los temas 1 a 4 gastaron
          // 260 plazas y dejaron seco el pozo de sustantivos. En la sexta
          // historia seguida las palabras que la escena pedia (mesa, cena,
          // lampara, ciudad, luz) estaban todas gastadas por el A0 y el A1, y
          // lo unico que quedaba libre no cabia en la escena: la prosa se
          // dobla para alojar la palabra, que es el defecto que el usuario
          // caza siempre y con razon.
          //
          // Lo que NO cambia: dentro del MISMO nivel sigue a cero, y dentro
          // del propio journey tambien (mas abajo). Ahi repetir es cobrarle
          // dos veces al mismo lector. Entre niveles no: quien hace el A2 no
          // tiene por que haber hecho el A0.
          if (!portable && mismoTipo && !mismoNivel) continue;
          (mismoTipo ? duro : out).add(String(v.word));
        }
      }
      // ...y el vocabulario de las historias YA GUARDADAS de ESTE journey que
      // no vienen en este fichero. `vocab-repetition` solo compara contra lo
      // que se valida en la misma tanda, así que una palabra enseñada tema a
      // tema en tandas distintas pasaba sin que saltara nada: el 2026-08-19 el
      // A1 brasileño tenía `segundo` en tres historias y otras ocho repetidas
      // en dos. Al lector le sale dos veces la misma tarjeta.
      const enTanda = new Set(stories.map((s: any) => `${s.topic}#${s.slotIndex}`));
      const propias = await p2.journeyStory.findMany({
        where: { journeyId },
        select: { topic: true, slotIndex: true, vocab: true },
      });
      for (const r of propias) {
        if (enTanda.has(`${r.topic}#${r.slotIndex}`)) continue;
        for (const v of ((r.vocab as Array<{ word?: unknown }> | null) ?? []))
          if (v?.word) duro.add(String(v.word));
      }
      return { taughtElsewhere: [...out], taughtSameType: [...duro] };
    } catch { return { taughtElsewhere: [] as string[], taughtSameType: [] as string[] }; }
    finally { await p2.$disconnect(); }
  })();
  if (taughtSameType.length || taughtElsewhere.length) {
    console.log(
      `vocab ya enseñado: ${taughtSameType.length} lemas del mismo tipo (tope 0) · ` +
        `${taughtElsewhere.length} de otros tipos (tope 2 por historia)`
    );
  }

  const priorSummaries: ExistingStorySummary[] = [];
  const results: Array<{ d: any; ok: boolean; fails: string[]; warns: string[] }> = [];
  for (const d of stories) {
    const payload = { title: d.title, synopsis: d.synopsis, text: d.text, vocab: d.vocab, arcType: d.arcType };
    const r = await validateGeneratedStory(payload as any, {
      language: ctx.language, level: ctx.level, variant: ctx.variant, topic: d.topic,
      journeyTitles: allTitles.filter((t) => t !== d.title),
      existing: [...priorSummaries],
      taughtElsewhere,
      taughtSameType,
    });
    priorSummaries.push(summarize(d));
    const hardFails = r.checks.filter((c) => c.status === "fail" && !(narrator && NARRATOR_EXEMPT.has(c.id)));
    const warnsExtra: string[] = [];
    // Distribution, re-measured on the blocks the reader ACTUALLY renders.
    //
    // This is the one piece of the narrator profile that earns its keep. The
    // canonical vocab-distribution check counts pills per AUTHORED paragraph,
    // but the reader throws narrated prose's "\n\n" away and re-groups it into
    // 3-sentence blocks (src/lib/readerParagraphs); so in narrator mode that
    // check measures a structure nobody sees. Same rule, right object.
    //
    // CALIBRATION IS THE CANONICAL ONE, not a homegrown "max 3": cluster =
    // some block empty while another carries 6+, ceiling = 30% of the story's
    // items in a single block. Measured with the reader's own function so the
    // rule cannot drift from the render.
    if (narrator) {
      // A0 bodies are short and the reader groups them into fewer 3-sentence
      // blocks, so a single block naturally carries a larger share of the ~24
      // pills. Gold A0 tops out near 38%; give the floor a calibrated cap.
      const isA0 = (ctx.level ?? "").toUpperCase() === "A0";
      const blockCap = isA0 ? 0.45 : 0.3;
      const blocks = renderedParagraphs(String(d.text));

      // LA PRESENTACIÓN NO COMPARTE BLOQUE CON EL DIÁLOGO (2026-08-18).
      //
      // El lector tira los "\n\n" de la prosa narrada y reagrupa el texto de
      // TRES frases en tres. Si la presentación del personaje ocupa una sola
      // frase, el bloque se completa con las dos siguientes, que suelen ser
      // diálogo: en pantalla, "Na barraca está Bruna, uma professora de surfe"
      // salía pegado a "Primeira vez?". El usuario lo vio en la primera
      // historia de Florianópolis y preguntó qué había pasado.
      //
      // La regla: si el primer bloque PRESENTA a alguien (nombre seguido de un
      // sintagma que dice qué es), ese bloque no puede llevar habla citada.
      // Abrir directamente con diálogo es legítimo y no dispara nada.
      const primerBloque = blocks[0] ?? "";
      const presenta = /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+,\s+(um|uma)\s+\w+|\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+\s+é\s+(um|uma)\s+\w+/.test(primerBloque);
      if (presenta && /[“”]/.test(primerBloque)) {
        hardFails.push({
          id: "narrator-intro-block-shared", label: "", status: "fail",
          detail:
            "El primer bloque del lector mezcla la presentación del personaje con " +
            "diálogo. El lector agrupa de tres frases en tres, así que la " +
            "presentación tiene que ocupar ese bloque entera: dale tres frases " +
            "de narración antes de la primera línea citada.",
        } as never);
      }

      const vocab = (d.vocab ?? []) as any[];
      const perBlock = blocks.map((b) => vocab.filter((v) => b.includes(v.surface ?? v.word)).length);
      const worst = perBlock.length ? Math.max(...perBlock) : 0;
      const empty = perBlock.filter((n) => n === 0).length;
      const maxPct = vocab.length > 0 ? worst / vocab.length : 0;
      if (empty > 0 && worst >= 6 && !isA0) {
        hardFails.push({ id: "narrator-block-cluster", label: "", status: "fail",
          detail: `pills cluster: ${empty} rendered paragraph(s) with none while another carries ${worst}. Per-block: [${perBlock.join(", ")}]` } as any);
      } else if (maxPct > blockCap) {
        hardFails.push({ id: "narrator-block-distribution", label: "", status: "fail",
          detail: `${worst}/${vocab.length} items (${(maxPct * 100).toFixed(0)}%) land in one rendered paragraph (max 30%). Per-block: [${perBlock.join(", ")}]` } as any);
      }
      if (empty > 0) warnsExtra.push(`[narrator-empty-blocks] ${empty} rendered paragraph(s) with no vocab: [${perBlock.join(", ")}]`);
    }
    const exempted = r.checks.filter((c) => c.status === "fail" && narrator && NARRATOR_EXEMPT.has(c.id));
    const fails = hardFails.map((c) => `[${c.id}] ${c.detail ?? c.label}`);
    const warns = r.checks.filter((c) => c.status === "warn").map((c) => `[${c.id}] ${c.detail ?? c.label}`);
    warns.push(...warnsExtra);
    if (exempted.length) warns.push(...exempted.map((c) => `[narrator-exempt: ${c.id}]`));
    results.push({ d, ok: hardFails.length === 0, fails, warns });
    const tag = hardFails.length === 0 ? "OK  " : "FAIL";
    console.log(`\n=== ${tag} ${d.topic}#${d.slotIndex} "${d.title}"${narrator ? " [narrator]" : ""}  pass=${r.summary.pass} warn=${r.summary.warn} fail=${r.summary.fail}`);
    for (const f of fails) console.log("   FAIL " + f);
    for (const w of warns) console.log("   warn " + w);
  }

  // ── GATE DE LOTE: nadie habla en todo el lote ──────────────────
  //
  // POR QUÉ (2026-08-14). El spec pide que la prosa narrada lleve habla citada
  // breve, pero los tres checks que miran diálogo están EXENTOS en perfil
  // narrador porque asumen turnos "Personaje: línea". Resultado: entraron dos
  // journeys COMPLETOS sin una sola línea hablada en 21 historias (portugués
  // A0 Traveler y español México A0 Traveler). Cada historia pasaba sola; el
  // defecto solo existía a nivel de conjunto, que es justo lo que ningún check
  // por historia puede ver.
  //
  // Umbral calibrado con los journeys buenos, no inventado: italiano A0 20/21
  // (95%), alemán C1 18/21 (86%), Colombia C1 18/21 (86%), España A0 14/19
  // (74%). El suelo se pone en 50%, muy por debajo del peor bueno, para que
  // solo salte ante un lote mudo de verdad. Una historia suelta sin voz sigue
  // siendo legítima (el validador la marca como `warn`, no como fallo).
  const narradas = results.filter((r) => !/^\s*[A-ZÁÉÍÓÚÑÜ][\wáéíóúñçüö' ]{1,20}:\s/m.test(r.d.text ?? ""));
  if (narradas.length >= 3) {
    const conVoz = narradas.filter((r) => /[«»“”""„"]|(^|\n)\s*[-—–]\s+\S/.test(r.d.text ?? ""));
    const pct = Math.round((conVoz.length / narradas.length) * 100);
    if (pct < 50) {
      console.error(
        `\n✗ LOTE MUDO: solo ${conVoz.length}/${narradas.length} historias narradas (${pct}%) tienen habla citada.\n` +
        `  El registro narrado del spec es prosa en tercera persona CON habla citada breve dentro de los\n` +
        `  párrafos del narrador. Un lote donde casi nadie habla se lee como un informe, no como una historia.\n` +
        `  Referencia de los journeys buenos: italiano A0 95%, alemán C1 86%, Colombia C1 86%, España A0 74%.\n` +
        `  Da voz a los personajes secundarios: una línea corta entrecomillada por historia basta.\n` +
        `  NOTHING WRITTEN.`
      );
      process.exit(1);
    }
  }

  const anyFail = results.some((r) => !r.ok);
  if (anyFail) {
    console.error(`\n✗ CANONICAL VALIDATION FAILED (${results.filter((r) => !r.ok).length}/${results.length} stories). NOTHING WRITTEN.`);
    process.exit(1);
  }
  console.log(`\n✓ All ${results.length} stories pass the canonical validator (${ctx.language} ${ctx.level} ${ctx.variant}).`);

  // ── CANDADO DE CIERRE DE TEMA (2026-09-05) ─────────────────────
  //
  // No se guardan historias de un tema mientras el ANTERIOR del journey no
  // tenga un cierre registrado y vigente en scripts/tema-cierres.json. Vigente
  // quiere decir que el hash del cierre cuadra con lo que hay hoy en la base:
  // si el texto del tema cerrado cambio despues, el cierre caduca solo.
  //
  // Mismo patron que la muestra de narracion: sin variable de escape, y el
  // error escupe el comando que falta. POR QUE: "listo" era una frase del chat
  // y no un registro, asi que un tema pasaba por cerrado sin que nadie hubiera
  // corrido las comprobaciones. Corre tambien en --dry: validar el tema
  // siguiente antes de cerrar el anterior es justo el orden que esto impide.
  if (journeyId) {
    const p4 = new PrismaClient();
    try {
      const j4 = await p4.journey.findUnique({ where: { id: journeyId }, select: { topics: true } });
      const filas4 = await p4.journeyStory.findMany({
        where: { journeyId },
        select: { topic: true, slotIndex: true, title: true, text: true, vocab: true },
      });
      const porTema = new Map<string, HistoriaCierre[]>();
      for (const f of filas4) porTema.set(f.topic, [...(porTema.get(f.topic) ?? []), f as HistoriaCierre]);
      const bloqueo = candadoCierrePrevio({
        journeyId,
        topicsOrden: j4?.topics ?? [],
        temasEnTanda: [...new Set(stories.map((s: any) => String(s.topic)))],
        historiasPorTema: porTema,
      });
      if (bloqueo) {
        console.error(`\n✗ CANDADO DE CIERRE DE TEMA. NOTHING WRITTEN.\n`);
        console.error(`  ${bloqueo}`);
        console.error(
          `\n  Un tema se cierra antes de empezar el siguiente, y el cierre lo escribe un\n` +
          `  script que corrio las comprobaciones, no una frase. No hay variable de escape.`
        );
        process.exit(1);
      }
    } finally { await p4.$disconnect(); }
  }

  // ── GATE DE JOURNEY: lo que solo se ve mirando las 21 juntas ────
  //
  // POR QUÉ (2026-08-23). El validador canónico juzga una historia suelta, y
  // por eso pasaron en verde tres reglas que son de conjunto: los siete
  // personajes del Traveler DE A0 entraban sin decir QUÉ SON (tres con su
  // presentación después de su primera línea citada), 14 de 21 abrían con la
  // misma forma, y `Die zwei` sustituyó a los nombres en 13. Ninguna historia
  // era mala por sí sola.
  //
  // Un check que no sabe medir el idioma del journey devuelve `not-implemented`
  // y BLOQUEA igual que un fallo: pasar en vacío es lo que ya costó dos veces
  // (`narrator-intro-block-shared` busca `um/uma`, `body-cefr-a0-grammar` solo
  // conoce el español).
  if (journeyId) {
    const p3 = new PrismaClient();
    let todas: JourneyStoryInput[] = [];
    const base: JourneyStoryInput[] = [];
    let realPeople: string[] | undefined;
    try {
      const enTanda = new Map<string, any>(stories.map((d: any) => [`${d.topic}#${d.slotIndex}`, d]));
      // EN ORDEN DE LECTURA. Sin ordenar, "la primera historia en que sale un
      // personaje" era la que devolviera antes la base, y el check de
      // presentacion senalaba la 19 para los siete.
      const j3 = await p3.journey.findUnique({ where: { id: journeyId }, select: { topics: true } });
      const orden = j3?.topics ?? [];
      const filas = (await p3.journeyStory.findMany({
        where: { journeyId }, select: { slug: true, title: true, text: true, vocab: true, topic: true, slotIndex: true },
      })).sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
      const vistos = new Set<string>();
      for (const f of filas) {
        const k = `${f.topic}#${f.slotIndex}`;
        vistos.add(k);
        const d = enTanda.get(k);
        const text = d ? String(d.text) : String(f.text ?? "");
        if (!text.trim()) continue;
        todas.push({ slug: d?.slug ?? f.slug ?? k, title: d?.title ?? f.title ?? "", text,
                     vocab: (d?.vocab ?? f.vocab) as never, language: ctx.language, level: ctx.level,
                     topic: f.topic });
        // El MISMO conjunto sin la edición encima, para poder medir el antes.
        // Solo las filas que ya existen: una historia que solo está en la
        // tanda es contenido nuevo y no tiene "antes" contra el que comparar.
        if (String(f.text ?? "").trim()) {
          base.push({ slug: f.slug ?? k, title: f.title ?? "", text: String(f.text),
                      vocab: f.vocab as never, language: ctx.language, level: ctx.level, topic: f.topic });
        }
      }
      for (const [k, d] of enTanda) if (!vistos.has(k))
        todas.push({ slug: d.slug ?? k, title: d.title, text: String(d.text), vocab: d.vocab,
                     language: ctx.language, level: ctx.level });
      // Personas REALES: el check de personajes no puede medir sin ellas, y sin
      // la lista devuelve `not-implemented`, que bloquea igual que un fallo.
      // `BetaSignup` no guarda el nombre, solo el correo, asi que el nombre se
      // saca de la parte local (`hannah.mueller@…` -> Hannah, Mueller). Es una
      // aproximacion, pero es la unica senal de identidad que hay en la tabla.
      realPeople = (await p3.betaSignup.findMany({ select: { email: true } }))
        .flatMap((b) => String(b.email ?? "").split("@")[0].split(/[._\-+0-9]+/))
        .filter((w) => w.length >= 3)
        .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    } finally { await p3.$disconnect(); }

    // EL GATE YA NO SE SALTA CON EL JOURNEY A MEDIAS (2026-09-05).
    //
    // Antes, por debajo de siete historias no se medía NADA, así que las tres
    // primeras de un journey no pasaban por ninguna regla de conjunto y el
    // defecto aparecía cuando ya había 21 escritas. Ahora los checks
    // prefix-safe (los que no se arreglan añadiendo historias) corren con las
    // que haya, y los de conjunto devuelven `pending-set`: quedan LISTADOS,
    // que es lo contrario de saltárselos en silencio. Con siete o más, el
    // conjunto se juzga entero, exactamente como hasta hoy.
    {
      const completo = todas.length >= 7;
      const jc = validateJourneyStories(todas, {
        language: ctx.language, level: ctx.level, realPeople, conjuntoCompleto: completo,
      });
      const malos = jc.filter((c) => c.status === "fail" || c.status === "not-implemented");
      const enEspera = jc.filter((c) => c.status === "pending-set");
      console.log(`\n── gate de journey (${todas.length} historias${completo ? "" : ", conjunto incompleto"}) ──`);
      for (const c of jc) console.log(`   ${c.status === "pass" ? "ok  " : c.status === "fail" ? "FAIL" : c.status === "pending-set" ? "en espera" : "SIN IMPLEMENTAR"} [${c.id}] ${c.detail ?? ""}`);
      if (enEspera.length) {
        console.log(`\n   ${enEspera.length} regla(s) de conjunto en espera de que el journey este completo:`);
        for (const c of enEspera) console.log(`     [${c.id}]`);
        console.log(`   No estan aprobadas; estan sin juzgar. Se cierran con el journey delante.`);
      }
      if (malos.length && !noRegression) {
        console.error(`\n✗ GATE DE JOURNEY: ${malos.length} regla(s) de conjunto sin cumplir. NOTHING WRITTEN.`);
        console.error(`   Si el journey ya arrastraba estos fallos de antes de la regla, --no-regression`);
        console.error(`   mide el conjunto antes y despues y solo deja pasar lo que no los empeore.`);
        process.exit(1);
      }
      if (malos.length && noRegression) {
        // Medir el ANTES con el mismo checker y el mismo contexto: la unica
        // diferencia entre los dos conjuntos es la edicion.
        if (base.length !== todas.length) {
          console.error(`\n✗ --no-regression no aplica: la tanda añade historias nuevas (${todas.length} ahora, ${base.length} en la base).`);
          console.error(`   El trinquete solo sirve para EDITAR lo que ya existe. NOTHING WRITTEN.`);
          process.exit(1);
        }
        const antes = validateJourneyStories(base, { language: ctx.language, level: ctx.level, realPeople });
        const porId = new Map(antes.map((c) => [c.id, c]));
        const slugs = todas.map((t) => t.slug);
        const peores = malos.filter((c) => empeora(porId.get(c.id), c, slugs));
        console.log(`\n── trinquete (--no-regression) ──`);
        for (const c of malos) {
          const a = porId.get(c.id);
          const veredicto = empeora(a, c, slugs) ? "EMPEORA" : a?.status === "pass" ? "?" : "igual o mejor";
          console.log(`   ${veredicto.padEnd(14)} [${c.id}] antes: ${a?.status ?? "sin medir"}`);
        }
        if (peores.length) {
          console.error(`\n✗ TRINQUETE: ${peores.length} regla(s) de conjunto que la edicion EMPEORA. NOTHING WRITTEN.`);
          for (const c of peores) {
            console.error(`   [${c.id}]`);
            console.error(`     antes:  ${porId.get(c.id)?.detail ?? "(pasaba)"}`);
            console.error(`     ahora:  ${c.detail ?? ""}`);
          }
          process.exit(1);
        }
        console.log(`\n⚠ GATE DE JOURNEY: ${malos.length} regla(s) siguen sin cumplirse, y siguen ahi despues`);
        console.log(`  de esta edicion. Pasan por el trinquete porque la edicion no las empeora, NO`);
        console.log(`  porque esten arregladas. El journey sigue debiendo esa pasada.`);
      }
    }
  }

  if (dry) { console.log("--dry: no DB write."); return; }

  // ── WRITE (only reached when every story is green) ──
  const prisma = new PrismaClient();
  try {
    for (const { d } of results) {
      const slot = await prisma.journeyStory.findFirst({ where: { journeyId, topic: d.topic, slotIndex: d.slotIndex } });
      if (!slot) { console.log(`  NO slot for ${d.topic}#${d.slotIndex} (skipped)`); continue; }
      const slug = d.slug || slugify(d.title);
      await prisma.journeyStory.update({
        where: { id: slot.id },
        data: {
          title: d.title, slug, text: d.text, vocab: d.vocab,
          arcType: d.arcType, synopsis: d.synopsis,
          // Contadores derivados. NADIE los escribía: 293 de 564 historias del
          // catálogo los tenían en null, incluidas las 21 del A1 de España, y
          // cualquier informe que los use miente sin avisar. Se cuentan igual
          // que en el validador (`countWords`, src/lib/validateGeneratedStory)
          // para que el número signifique lo mismo en los dos sitios.
          wordCount: String(d.text ?? "").trim().split(/\s+/).filter(Boolean).length,
          vocabCount: Array.isArray(d.vocab) ? d.vocab.length : 0,
          ...(publish ? { status: "published" } : {}),
        },
      });
      console.log(`  saved ${d.topic}#${d.slotIndex} -> ${slug}${publish ? " (published)" : ""}`);

      // SINCRONIZAR EL TEXTO DE LOS FRAGMENTOS DE AUDIO.
      //
      // `audioFragments` congela el texto de cada párrafo cuando se mide. Si la
      // historia se reescribe después, re-tirar un fragmento vuelve a narrar la
      // frase VIEJA, porque el generador lee ese campo y no el cuerpo. Pasó el
      // 2026-08-17: se reescribió "Bia sobe a escada..." y la toma nueva
      // repetía la frase que se acababa de cambiar.
      //
      // Va aquí y no en el script de medición porque tocar ese texto ES
      // contenido de historia, y el contenido solo entra por este camino.
      const fragmentos = slot.audioFragments as Array<{ index: number; text?: string }> | null;
      if (Array.isArray(fragmentos) && fragmentos.length > 0) {
        const parrafos = String(d.text ?? "").split(/\n\s*\n/).map((x: string) => x.trim()).filter(Boolean);
        if (fragmentos.length === parrafos.length + 1) {
          let tocados = 0;
          const nuevos = [...fragmentos]
            .sort((a, b) => a.index - b.index)
            .map((f, i) => {
              const esperado = i === 0 ? String(d.title).trim() : parrafos[i - 1];
              // OJO: solo se toca `text`. `renderedText` es el testigo de lo que
              // el mp3 DICE y no lo escribe nadie salvo el render y el empalme;
              // pisarlo aquí dejaría la fila afirmando que el audio está al día.
              if (esperado && String(f.text ?? "").trim() !== esperado) { tocados++; return { ...f, text: esperado }; }
              return f;
            });
          if (tocados > 0) {
            await prisma.journeyStory.update({ where: { id: slot.id }, data: { audioFragments: nuevos as never } });
            console.log(`     ${tocados} fragmento(s) de audio re-sincronizados con el texto nuevo`);
            // Normaliza igual que `scripts/_audioDrift.ts`: la base guarda
            // comillas curvas y los ficheros de origen las llevan rectas, así
            // que sin normalizar el aviso salta en CADA guardado y deja de
            // significar nada. Un aviso que siempre suena no avisa.
            const normTxt = (x: string) => x.trim().replace(/[“”«»"]/g, "").replace(/\s+/g, " ").replace(/[.]+$/, "");
            const desfasados = nuevos.filter((f) => {
              const r = (f as { renderedText?: string }).renderedText;
              return typeof r === "string" && normTxt(r) !== normTxt(String(f.text ?? ""));
            }).length;
            if (desfasados > 0) {
              console.log(`     AVISO: ${desfasados} fragmento(s) con audio DESFASADO (el mp3 dice otra cosa). Re-tíralos antes de publicar.`);
            }
          }
        } else {
          console.log(`     aviso: ${fragmentos.length} fragmentos frente a ${parrafos.length + 1} párrafos; el audio quedó desfasado del texto`);
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error(e); process.exit(1); });
