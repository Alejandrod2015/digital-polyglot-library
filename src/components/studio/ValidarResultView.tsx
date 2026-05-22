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

function humanize(check: Check): Humanized {
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
          <h3 className="mb-2 text-sm font-bold text-rose-200">
            Arregla esto antes de subir
          </h3>
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
