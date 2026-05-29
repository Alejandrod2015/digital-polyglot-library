"use client";

import { useState } from "react";

type CheckStatus = "pass" | "fail" | "warn";

type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
};

type Summary = { pass: number; warn: number; fail: number };

type Parsed = { title?: string; arcType?: string } | null | undefined;

type Props = {
  ok: boolean;
  checks: Check[];
  summary: Summary;
  parsed?: Parsed;
  existingCount?: number;
  /** "needs_review" / "completed" / "failed". Overrides derived banner so a
   *  failed run reads "Falló" even si ok=false. */
  status?: string;
  /** Timestamp + context (level / topic / createdAt) usado por history. */
  meta?: { topic?: string | null; level?: string | null; createdAt?: string };
  /** Error técnico (cuando la corrida no terminó). */
  errorMessage?: string | null;
  /** Texto crudo pegado por la trabajadora. Si el JSON falló parseo,
   *  intentamos extraer el título igual para identificar la corrida. */
  rawInput?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────
// Traducción al español + sugerencias concretas por checkId.
// Cada fail/warn dice (a) QUÉ está mal en una sola línea y (b) QUÉ HACER.
// ─────────────────────────────────────────────────────────────────────────

type Humanized = { text: string; hint?: string };

const PASS_LABELS: Record<string, string> = {
  "json-parse": "JSON bien formado",
  "title-length": "Largo del título correcto",
  "title-banned-patterns": "Título sin patrones prohibidos",
  "title-uniqueness": "Título único en el tema",
  "synopsis-length": "Largo de sinopsis correcto",
  "body-no-html": "Cuerpo en texto plano (sin HTML)",
  "body-narrator-opening": "Narrador abre con oración completa",
  "body-word-count": "Largo del cuerpo correcto",
  "speakers-count": "Al menos 2 personajes con nombre",
  "speaker-lines": "Al menos 4 turnos de diálogo",
  "body-no-banned-tokens": "Cuerpo sin sonidos ni stage-directions",
  "arctype-valid": "arcType válido",
  "arctype-rotation": "arcType rota bien respecto a historias recientes",
  "vocab-count": "Cantidad de vocab correcta (18-22)",
  "vocab-definitions": "Definiciones bien formadas",
  "vocab-types": "Tipos de vocab válidos",
  "vocab-in-body": "Vocab presente en el cuerpo",
  "vocab-no-same-root": "Sin duplicados por raíz en el vocab",
  "vocab-no-cognates": "Sin cognados transparentes",
  "vocab-distribution": "Vocab repartido por párrafos",
  "names-match": "Personajes de sinopsis aparecen en el cuerpo",
  "vocab-cross-story": "Vocab sin repetir de historias previas",
  "names-cross-story": "Nombres de personajes no usados antes",
};

export function humanize(check: Check): Humanized {
  const detail = check.detail ?? "";
  const id = check.id;
  const isWarn = check.status === "warn";

  if (check.status === "pass") {
    return { text: PASS_LABELS[id] ?? check.label };
  }

  // Extrae primer número del detail (e.g. "5 words" → 5)
  const num = parseInt(detail.match(/\d+/)?.[0] ?? "", 10);
  const numStr = Number.isFinite(num) ? `${num}` : "?";

  switch (id) {
    case "json-parse":
      return {
        text: "No se pudo leer el JSON",
        hint: "Pega solo el bloque que empieza con { y termina con }, sin texto extra antes o después. Si hay ```json al inicio, quítalo.",
      };
    case "title-length":
      return {
        text: `El título tiene ${numStr} palabras (debe ser 2 a 6)`,
        hint: "Recorta o expande hasta el rango.",
      };
    case "title-banned-patterns":
      return {
        text: "El título cae en un patrón prohibido",
        hint: "Evita 'A day in...', 'The story of...' y palabras como mystery, secret, escape, forbidden, stolen. Usa un ancla cultural concreta (barrio, plato, lugar nombrado).",
      };
    case "title-topic-match":
      return {
        text: "El título no menciona el tema de la historia",
        hint: `Para temas como airport-transit, accommodation-stays o health-wellbeing, el título debe contener una palabra que indique el venue (aeropuerto, terminal, hotel, hospital, etc.) o el nombre de un lugar real (Galeão, Barajas, Ezeiza, Santos Dumont…). Si el título nombra una plaza, parque o mercado sin relación al tema, el aprendiz se confunde antes de empezar a leer. Detalle: ${detail}`,
      };
    case "title-language-consistency":
      return {
        text: "El título usa caracteres de otro idioma",
        hint: `Detectado: ${detail}. Verifica si es intencional (un toponimo como "São Paulo" en historia ES sí está bien, pero "Praça Mauá" en lugar de "Plaza Mauá" probablemente no).`,
      };
    case "title-region-mismatch":
      return {
        text: "El título usa una ciudad fuera de la región del journey",
        hint: `Los journeys "ES · Traveler · LATAM" deben tener anchors dentro de Latinoamérica (Coyoacán, Barranco, Mérida, Palermo, Cartagena, Lima, Caracas, etc.). Reemplaza el lugar por uno latinoamericano que tenga sentido para la historia. ${detail}`,
      };
    case "title-anchor-repetition":
      return {
        text: "El anchor del título ya se usó en otras historias del journey",
        hint: `Si el mismo barrio aparece muchas veces, el journey se siente como una sola zona en vez de un recorrido por LATAM. Rota a otra ciudad o barrio reconocible. Detalle: ${detail}`,
      };
    case "title-template-monotony":
      return {
        text: "El título usa la misma plantilla que la mayoría del journey",
        hint: `Mucho "X en Y" hace el journey monótono. Prueba otras estructuras: fragmento temporal ("Antes de las dos"), día + persona ("Jueves con doña Luz"), verbo en gerundio ("Mientras gira el trompo"), "para X" ("Pan de yuca para Ana"), o una mini-oración ("Ya no quedan velas"). ${detail}`,
      };
    case "title-formula-default":
      return {
        text: "El título cae en la fórmula default \"X en/de/del Y\"",
        hint: `Es el patrón que ChatGPT produce por inercia. Reescribe con otra estructura: fragmento temporal ("Antes de las dos"), día + persona ("Jueves con doña Luz"), verbo en gerundio ("Mientras gira el trompo"), "para X" ("Pan de yuca para Ana"), o mini-oración ("Ya no quedan velas"). ${detail}`,
      };
    case "title-anchor-recognizability":
      return {
        text: "El anchor del título puede ser muy obscuro para A1/A2",
        hint: `El aprendiz inglés-nativo de A1/A2 no reconoce micro-barrios. Prefiere la ciudad o un barrio famoso (Coyoacán, La Candelaria, Miraflores, San Telmo, Palermo, Mérida, Oaxaca, Valparaíso, La Paz, Cartagena). Detalle: ${detail}`,
      };
    case "body-consecutive-narrators":
      return {
        text: "Dos párrafos de narrador seguidos sin diálogo entre ellos",
        hint: `Después del opening, los beats del narrador no se apilan: van entre turnos de diálogo. Combina los dos párrafos en uno, o muévelos a antes/después del siguiente Speaker:. ${detail}`,
      };
    case "opening-ficha-tecnica":
      return {
        text: "El opening parece ficha técnica de personajes",
        hint: `El opening declara las relaciones ("Elena es la madre de..." / "María estudia en...") en vez de mostrarlas en acción. Reescribe esas oraciones como gestos: por ejemplo "Elena sirve café a sus dos hijos" en vez de "Elena es la madre de María y Pablo". ${detail}`,
      };
    case "body-sensory-overload":
      return {
        text: "El cuerpo mezcla demasiadas categorías sensoriales",
        hint: `Una historia se queda mejor con UNA seña sensorial dominante (solo el olor, solo el sonido, solo la luz). Si el texto mezcla 3 o más, ninguna aterriza. Identifica la más fuerte para la atmósfera y recorta las otras. ${detail}`,
      };
    case "synopsis-opening-duplicate":
      return {
        text: "La sinopsis y el opening del cuerpo describen la misma escena",
        hint: `La sinopsis es metadata interna — el lector NUNCA la ve. No es para describir la escena (eso lo hace el opening del cuerpo); es para resumir el conflicto/tensión de la historia (gancho de arco). Reescribe la sinopsis como un hook: qué tensión se explora, no qué pasa visualmente. ${detail}`,
      };
    case "vocab-pedagogical-redundancy":
      return {
        text: "El vocab incluye palabras A0 universales que desperdician slot",
        hint: `Partes del cuerpo básicas (ojos, mano, cabeza), pronombres, números 1-10, colores primarios, saludos — el aprendiz inglés-nativo los tiene del primer curso. Cambia esos items por algo con más valor pedagógico: una expresión multi-palabra ("con prisa", "al fin", "otra vez"), un sustantivo regional/concreto del topic, o una construcción verbal no-obvia (ponerse a, hacer falta). ${detail}`,
      };
    case "vocab-min-expressions":
      return {
        text: "El vocab tiene muy pocas expresiones multi-palabra",
        hint: `Una lista de 18-22 items con cero expressions es estructuralmente desbalanceada: solo se enseñan sustantivos atómicos. Mínimo 2 items con type="expression". Las expresiones lexicalizadas ("con prisa", "al fin", "otra vez", "dar vuelta", "echar un ojo", "que le vaya bien") enseñan estructuras del habla cotidiana que los sustantivos sueltos no pueden. ${detail}`,
      };
    case "opening-city-without-country":
      return {
        text: "El opening nombra una ciudad LATAM sin el país",
        hint: `En A1, el aprendiz inglés-nativo no sabe que Coyoacán es Ciudad de México, Barranco es Lima, San Telmo es Buenos Aires. Agrega el país en la primera o segunda oración del opening: "En Coyoacán, Ciudad de México,..." o "Es lunes en Bogotá, Colombia,...". ${detail}`,
      };
    case "body-idiomatic-untaught":
      return {
        text: "El cuerpo usa modismos coloquiales sin enseñarlos en el vocab",
        hint: `Las expresiones idiomáticas (X manda, está padre, no manches, echar un ojo, tomar el pelo, costar un ojo de la cara, bárbaro…) tienen un significado que el aprendiz inglés-nativo no deduce del sentido literal. En A1/A2 cualquier modismo debe agregarse al vocab como type="expression" o eliminarse del cuerpo. ${detail}`,
      };
    case "dialogue-treasure-hunt-opening":
      return {
        text: "El diálogo abre buscando objetos en vez de plantear stakes",
        hint: `Los primeros turnos del diálogo no son para ubicar tazas ni cucharas. Mueve esa logística al narrador. El primer Speaker: debe entrar con algo que tenga peso (una pregunta incómoda, una respuesta que esconde algo, una decisión pendiente). ${detail}`,
      };
    case "dialogue-bare-imperative":
      return {
        text: "Imperativo breve aislado cierra un turno de diálogo",
        hint: `ElevenLabs renderea "Trae los vasos." (imperativo solo, en punto, ≤4 palabras) con entonación de pregunta. Pasa en cualquier voz y modelo (probado A–L). Arregla con: segunda oración corta ("Trae los vasos. Gracias."), vocativo + cierre ("Come, mija. El caldo se enfría."), o reformula como pregunta/declarativa ("¿Me traes los vasos?" / "Necesito los vasos."). ${detail}`,
      };
    case "title-uniqueness":
      return {
        text: "Título demasiado parecido a otro ya publicado en este tema",
        hint: detail.replace(/^Overlap with/i, "Coincide con") || "Cambia palabras hasta que la coincidencia con cualquier título existente sea menor al 50%.",
      };
    case "synopsis-length":
      return {
        text: `La sinopsis tiene ${numStr} palabras (debe ser 45 a 90)`,
        hint: "Ajusta hasta el rango.",
      };
    case "body-no-html":
      return {
        text: "El cuerpo tiene HTML o markdown",
        hint: `Quita los tags. El cuerpo debe ser texto plano con párrafos separados por línea vacía y líneas de diálogo con formato 'Nombre: ...'.${detail ? ` Detectado: ${detail.replace(/^Found tag:\s*/i, "")}` : ""}`,
      };
    case "body-narrator-opening":
      return {
        text: "El narrador no abre con una oración completa",
        hint: "El primer párrafo debe ser narración (no diálogo) y debe ser una oración con verbo y punto final, no un fragmento como 'Samstagnachmittag in Berlin.'.",
      };
    case "body-word-count":
      return isWarn
        ? {
            text: `El cuerpo tiene ${numStr} palabras (un poco fuera del objetivo 220-280)`,
            hint: "No bloquea, pero conviene ajustarlo si tienes tiempo.",
          }
        : {
            text: `El cuerpo tiene ${numStr} palabras (fuera del rango permitido 180-320)`,
            hint: "Ajusta el largo. Lo ideal son 220-280 palabras.",
          };
    case "speakers-count":
      return {
        text: "Hay menos de 2 personajes con nombre en el diálogo",
        hint: "Agrega un segundo personaje con nombre y al menos una línea con formato 'Nombre: ...'.",
      };
    case "speaker-lines":
      return {
        text: `Faltan turnos de diálogo (hay ${numStr}, mínimo 4)`,
        hint: "Agrega más líneas con formato 'Nombre: ...' entre los párrafos del narrador.",
      };
    case "body-no-banned-tokens":
      return {
        text: "El cuerpo tiene sonidos o stage-directions que el audio no puede pronunciar",
        hint: `Elimina cosas como haha, hmm, oh, ay, ugh, wow, (laughs), [ríe], *pause*. Expresa la emoción con palabras reales (por ejemplo 'qué rico', 'qué lástima').${detail ? ` Detectado: ${detail.replace(/^Matched:\s*/i, "")}` : ""}`,
      };
    case "arctype-valid":
      return {
        text: `El arcType "${detail}" no está en la lista permitida`,
        hint: "Usa uno de: white-lie, last-minute-decision, return-after-years, unspoken-subtext, plan-falls-short, late-reveal, small-stake, open-ending, daily-encounter.",
      };
    case "arctype-rotation":
      return check.status === "fail"
        ? {
            text: "No puedes usar 'daily-encounter' tres veces seguidas en el mismo tema",
            hint: `${detail.replace(/^Recent:\s*/i, "Arcos recientes: ")}. La siguiente historia debe usar otro arco (white-lie, late-reveal, small-stake, etc.).`,
          }
        : {
            text: "Este arcType ya se usó en una historia reciente del tema",
            hint: `${detail.replace(/^Recent:\s*/i, "Arcos recientes: ")}. Conviene rotar a otro, aunque no bloquea subida.`,
          };
    case "vocab-count":
      return {
        text: `El vocab tiene ${numStr} items (debe ser 18 a 22)`,
        hint: "Agrega o quita items hasta el rango.",
      };
    case "vocab-definitions":
      return {
        text: "Algunas definiciones tienen problemas de formato",
        hint: `Reglas: 8-14 palabras, máximo 120 caracteres, no empezar con 'Refers to', 'Describes', 'Used to', 'Used for' o 'Said when', y sin em-dash (—). Items con problemas: ${detail}`,
      };
    case "vocab-types":
      return {
        text: "Hay tipos de vocab inválidos",
        hint: `Solo se permiten: verb, noun, adjective, adverb, expression, slang, preposition. Items afectados: ${detail}`,
      };
    case "vocab-in-body":
      return {
        text: "Algunas palabras del vocab no aparecen en el cuerpo",
        hint: `Cada palabra debe aparecer literalmente en el cuerpo. Si la forma flexionada difiere del lemma, usa el campo 'surface' con la forma exacta del cuerpo. Faltan: ${detail}`,
      };
    case "vocab-no-same-root":
      return {
        text: "Hay items de vocab que comparten raíz",
        hint: `Elige uno por raíz, no ambos (por ejemplo el verbo o el sustantivo, no los dos). Duplicados: ${detail}`,
      };
    case "vocab-no-cognates":
      return {
        text: "Hay cognados transparentes en el vocab",
        hint: `Quita palabras que cualquiera entiende sin saber el idioma. Detectados: ${detail}`,
      };
    case "vocab-distribution":
      return isWarn
        ? {
            text: "Vocab algo concentrado en pocos párrafos",
            hint: `Distribuye 3-5 items por párrafo. ${detail}`,
          }
        : {
            text: "Vocab clusterizado (algún párrafo con 0 y otro con 6 o más)",
            hint: `Redistribuye para que cada párrafo tenga 3-5 items. ${detail}`,
          };
    case "names-match":
      return {
        text: "Hay nombres en la sinopsis que no aparecen en el cuerpo",
        hint: `${detail.replace(/^In synopsis only:\s*/i, "Solo en sinopsis: ")}. Renombra para que coincidan o quita los que no estén en el cuerpo.`,
      };
    case "vocab-cross-story":
      return {
        text: "Algunas palabras del vocab ya se enseñan en otra historia del mismo tema",
        hint: `Cambia esas palabras por sinónimos aún no usados. Repetidas: ${detail}`,
      };
    case "names-cross-story":
      return {
        text: "Algunos nombres de personajes ya se usaron en otra historia del tema",
        hint: `Cambia los nombres por otros del mismo registro cultural. Repetidos: ${detail}`,
      };
    case "vocab-level-frequency": {
      // detail formato: "N fuera de LEVEL: word1 (LV) → repl1, word2 (LV) → repl2, ..."
      // Extraemos el LEVEL target del label (e.g. "...A1 lexical frequency...")
      const lvMatch = check.label.match(/\b([ABC][12])\b/);
      const tgt = lvMatch?.[1] ?? "el nivel";
      return {
        text: isWarn
          ? `Hay palabras del vocab un poco por encima de ${tgt}`
          : `Hay palabras del vocab fuera de nivel ${tgt}`,
        hint:
          `Cambia las palabras marcadas por sus equivalentes ${tgt} sugeridos a la derecha de la flecha (→). ` +
          `Si la sugerencia no encaja con el contexto, elige otra palabra de nivel ${tgt} con sentido similar. ` +
          `Detalle: ${detail}`,
      };
    }
    case "body-level-frequency": {
      const lvMatch = check.label.match(/\b([ABC][12])\b/);
      const tgt = lvMatch?.[1] ?? "el nivel";
      return {
        text: isWarn
          ? `El cuerpo usa un registro un poco por encima de ${tgt}`
          : `El cuerpo usa demasiado vocabulario fuera de nivel ${tgt}`,
        hint:
          `Reescribe las frases del cuerpo que contienen las palabras marcadas, reemplazándolas por sus equivalentes ${tgt} (sugeridos con →). ` +
          `Mantén el sentido pero baja el registro. ` +
          `Detalle: ${detail}`,
      };
    }
    default:
      return { text: check.label, hint: detail || undefined };
  }
}

/** Intenta extraer el campo title del JSON crudo cuando el parseo falló.
 *  Heurística simple: busca `"title": "..."`. Devuelve null si no encuentra. */
function extractFallbackTitle(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const m = raw.match(/"title"\s*:\s*"([^"]+)"/);
  return m ? m[1].trim() : null;
}

// ─────────────────────────────────────────────────────────────────────────

export default function ValidarResultView({
  ok,
  checks,
  parsed,
  existingCount,
  status,
  meta,
  errorMessage,
  rawInput,
}: Props) {
  const [showOk, setShowOk] = useState(false);

  const fails = checks.filter((c) => c.status === "fail");
  const warns = checks.filter((c) => c.status === "warn");
  const passes = checks.filter((c) => c.status === "pass");

  const jsonBroken = checks.some(
    (c) => c.id === "json-parse" && c.status === "fail"
  );
  const fallbackTitle = !parsed?.title ? extractFallbackTitle(rawInput) : null;

  const banner =
    status === "failed" || errorMessage
      ? {
          label: "Falló",
          sub: "La validación no se pudo completar",
          chip: "bg-rose-500/20 text-rose-200 border-rose-500/40",
        }
      : ok
        ? {
            label: "Lista para subir",
            sub: warns.length
              ? `Todo en orden. ${warns.length} aviso${warns.length === 1 ? "" : "s"} menor${warns.length === 1 ? "" : "es"} opcional${warns.length === 1 ? "" : "es"} más abajo.`
              : "Todo en orden. Puedes subir esta historia al Studio.",
            chip: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
          }
        : {
            label: "No lista",
            sub: `${fails.length} ${fails.length === 1 ? "cosa por arreglar" : "cosas por arreglar"} antes de subir`,
            chip: "bg-amber-500/20 text-amber-200 border-amber-500/40",
          };

  return (
    <div className="space-y-3">
      {/* ─── HERO: título grande + meta + banner ─── */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {parsed?.title ? (
              <h2 className="text-xl font-bold leading-tight text-white">
                {parsed.title}
              </h2>
            ) : fallbackTitle ? (
              <div>
                <h2 className="text-xl font-bold leading-tight text-amber-200">
                  {fallbackTitle}
                </h2>
                <div className="mt-0.5 text-[11px] text-amber-300/70">
                  Título extraído del texto crudo (el JSON tiene errores)
                </div>
              </div>
            ) : jsonBroken ? (
              <h2 className="text-xl font-bold leading-tight text-rose-200">
                JSON no leíble
              </h2>
            ) : errorMessage ? (
              <h2 className="text-xl font-bold leading-tight text-rose-200">
                Error técnico
              </h2>
            ) : (
              <h2 className="text-xl font-bold leading-tight text-neutral-400">
                Sin título
              </h2>
            )}

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-400">
              {meta?.level && (
                <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono uppercase tracking-wide">
                  {meta.level}
                </span>
              )}
              {meta?.topic && <span>{meta.topic}</span>}
              {parsed?.arcType && (
                <span className="rounded bg-neutral-800 px-1.5 py-0.5">
                  arco: {parsed.arcType}
                </span>
              )}
              {typeof existingCount === "number" && existingCount > 0 && (
                <span className="text-neutral-500">
                  comparado vs {existingCount} historia{existingCount === 1 ? "" : "s"} del tema
                </span>
              )}
              {meta?.createdAt && (
                <span className="ml-auto text-neutral-500">
                  {new Date(meta.createdAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${banner.chip}`}
          >
            {banner.label}
          </span>
          <span className="text-xs text-neutral-300">{banner.sub}</span>
        </div>
      </div>

      {/* ─── Error técnico (cuando aplica) ─── */}
      {errorMessage && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          <span className="font-semibold">Error técnico:</span> {errorMessage}
        </div>
      )}

      {/* ─── FAILS: qué arreglar (primero, accionable) ─── */}
      {fails.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-rose-200">
              Arregla esto antes de subir
            </h3>
            <CopyChatGPTPromptButton
              checks={fails}
              level={meta?.level ?? null}
              parsed={parsed}
            />
          </div>
          <ol className="space-y-2">
            {fails.map((c, i) => {
              const h = humanize(c);
              return (
                <li
                  key={c.id}
                  className="flex items-start gap-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-50"
                >
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/30 text-xs font-bold">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-medium leading-snug">{h.text}</div>
                    {h.hint && (
                      <div className="text-xs leading-relaxed text-rose-200/90">
                        <span className="font-semibold text-rose-300">Cómo arreglar:</span> {h.hint}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* ─── WARNS: avisos (no bloquean) ─── */}
      {warns.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-bold text-amber-200">
            Avisos {warns.length === 1 ? "(opcional)" : "(opcionales)"}: no bloquean subida
          </h3>
          <ul className="space-y-2">
            {warns.map((c) => {
              const h = humanize(c);
              return (
                <li
                  key={c.id}
                  className="flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-50"
                >
                  <span className="mt-0.5 text-base leading-none">⚠</span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-medium leading-snug">{h.text}</div>
                    {h.hint && (
                      <div className="text-xs leading-relaxed text-amber-200/90">
                        <span className="font-semibold text-amber-300">Sugerencia:</span> {h.hint}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ─── PASSES (colapsados) ─── */}
      {passes.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowOk(!showOk)}
            className="flex w-full items-center justify-between gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-left text-sm text-emerald-200 hover:bg-emerald-500/10"
          >
            <span>
              <span className="font-bold">✓ {passes.length} verificacion{passes.length === 1 ? "" : "es"} más están bien</span>
              <span className="ml-2 text-xs text-emerald-300/70">
                (clic para {showOk ? "ocultar" : "ver detalle"})
              </span>
            </span>
            <span
              className="text-emerald-300/70"
              style={{
                transform: showOk ? "rotate(180deg)" : "none",
                transition: "transform 120ms",
              }}
            >
              ▾
            </span>
          </button>
          {showOk && (
            <ul className="mt-2 space-y-1">
              {passes.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-1.5 text-xs text-emerald-200/90"
                >
                  <span className="font-bold text-emerald-400">✓</span>
                  <span>{humanize(c).text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ─── Empty state: no había ningún check ─── */}
      {checks.length === 0 && !errorMessage && (
        <div className="rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-3 text-xs text-neutral-500">
          No hay verificaciones registradas para esta corrida.
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// "Copiar prompt para ChatGPT" button. Takes the failed checks + parsed
// story payload and bundles a single paste-able instruction so the
// worker can hand it to ChatGPT and get a corrected story back.
// ───────────────────────────────────────────────────────────────────────────

type ParsedForPrompt =
  | {
      title?: string;
      synopsis?: string;
      text?: string;
      vocab?: { word: string; definition: string }[];
    }
  | null
  | undefined;

function buildChatGPTPrompt(
  fails: Check[],
  level: string | null | undefined,
  parsed: ParsedForPrompt,
): string {
  const lv = (level ?? "").toUpperCase();
  const fixes = fails
    .map((c, i) => {
      const h = humanize(c);
      const head = `${i + 1}. ${h.text}`;
      const body = h.hint ? `\n   • ${h.hint}` : "";
      return head + body;
    })
    .join("\n");
  const intro = lv
    ? `Estas son las correcciones que necesita esta historia (nivel ${lv}) según mi validador. Aplica TODAS y devuélveme la historia completa en el MISMO formato JSON original (title, synopsis, arcType, text, vocab[]). No expliques, solo el JSON.`
    : `Estas son las correcciones que necesita esta historia según mi validador. Aplica TODAS y devuélveme la historia completa en el MISMO formato JSON original.`;
  const vocabBlock = parsed?.vocab?.length
    ? `\n\nVocab actual:\n${parsed.vocab
        .map((v) => `- ${v.word}: ${v.definition}`)
        .join("\n")}`
    : "";
  const storyBlock = parsed
    ? `\n\nHistoria actual:\n\nTítulo: ${parsed.title ?? "—"}\n\nSinopsis: ${parsed.synopsis ?? "—"}\n\nCuerpo:\n${parsed.text ?? "—"}${vocabBlock}`
    : "";
  return `${intro}\n\nCorrecciones:\n${fixes}${storyBlock}\n\nRegenera la historia entera con todas las correcciones aplicadas. Devuelve SOLO el JSON.`;
}

function CopyChatGPTPromptButton({
  checks,
  level,
  parsed,
}: {
  checks: Check[];
  level: string | null | undefined;
  parsed: ParsedForPrompt;
}) {
  const [copied, setCopied] = useState(false);
  if (checks.length === 0) return null;
  const handleCopy = async () => {
    const text = buildChatGPTPrompt(checks, level, parsed);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: open a window so worker can copy manually
      const w = window.open("", "_blank");
      if (w) {
        w.document.body.innerText = text;
      }
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-md border border-rose-400/50 bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-500/25"
      title="Copia un prompt con todas las correcciones para pegarlo en ChatGPT"
    >
      {copied ? "Copiado ✓" : "Copiar prompt para ChatGPT"}
    </button>
  );
}
