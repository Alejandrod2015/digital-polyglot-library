/**
 * cierraTema: "listo" deja de ser una frase y pasa a ser un REGISTRO (I3).
 *
 *   npx tsx scripts/cierraTema.ts <journeyId> <tema> --plan <plan.json>
 *   npx tsx scripts/cierraTema.ts --json <fichero> --plan <plan.json> [--lang ES] [--level a2]
 *
 * Corre TODAS las comprobaciones aplicables a un tema y, solo si pasan todas,
 * escribe una entrada en scripts/tema-cierres.json con el hash del contenido de
 * las tres historias. Ese registro es lo que mira el candado de saveStory.ts
 * antes de dejar guardar el tema siguiente: si el texto del tema cerrado
 * cambia, el hash deja de cuadrar y el cierre caduca solo.
 *
 * QUE COMPRUEBA
 *   - EL PLAN (--plan, obligatorio): tipo, nivel, variante, registro, espina y,
 *     por cada una de las tres, que quiere, que se lo impide, que le cuesta y
 *     que cambia. Sin plan, o con un campo vacio, el tema NO cierra y el error
 *     dice cual falta. El plan se guarda dentro de la entrada del registro;
 *   - el validador canonico (validateGeneratedStory) sobre las tres, en seco y
 *     cada una contra sus hermanas, que es como las juzga saveStory;
 *   - guiones largos y emojis en titulo y cuerpo, que en la base no los mira
 *     ningun lint de ficheros;
 *   - LOS TICS del tema, que ninguna historia por separado delata y que solo se
 *     ven leyendo las tres seguidas: un verbo de acotacion que se come el resto
 *     y tres arranques iguales BLOQUEAN; la estructura clonada, la densidad de
 *     los niveles bajos y el registro repetido tres temas seguidos AVISAN;
 *   - acotacion: cuanta habla citada lleva al narrador al lado (solo avisa, no
 *     bloquea: la regla no tiene gate y decir lo contrario seria mentir);
 *   - la escalera de vocab del tema, informativa: la de verdad es del journey
 *     entero y por eso sale como pendiente de conjunto.
 *
 * EL MODO --json existe para poder probar el cierre con fixtures donde no hay
 * base de datos. El fichero puede ser un array de historias, o un objeto
 * { journeyId, topic, language, level, variant, stories: [...] }.
 */
// Neutraliza el guard `server-only`, igual que saveStory.ts: el validador
// canonico importa el juez CEFR, que lo usa. Tiene que ir ANTES del import del
// validador, que es lo que dispara la cadena.
import { createRequire } from "module";
const __req = createRequire(__filename);
try {
  const p = __req.resolve("server-only");
  (__req as unknown as { cache: Record<string, unknown> }).cache[p] = {
    id: p, filename: p, loaded: true, exports: {},
  };
} catch { /* noop */ }

import * as fs from "fs";
import {
  validateGeneratedStory, extractStoryMotifs, extractProperNouns,
  type ExistingStorySummary,
} from "@/lib/validateGeneratedStory";
import { validateJourneyStories } from "@/lib/validateJourneyStories";
import {
  hashTema, escribirCierre, leerRegistro, claveCierre, faltaEnPlan,
  type Cierre, type HistoriaCierre, type PlanTema,
} from "./temaCierres";

type Historia = HistoriaCierre & {
  slug?: string | null;
  synopsis?: string | null;
  arcType?: string | null;
};

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

/** El mismo resumen entre hermanas que arma saveStory antes de validar. */
function resumen(d: Historia): ExistingStorySummary {
  const names = new Set<string>();
  for (const line of String(d.text ?? "").split(/\r?\n/)) {
    const m = line.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñü]+):\s/);
    if (m) names.add(m[1]);
  }
  for (const n of extractProperNouns(String(d.text ?? ""))) names.add(n);
  const primerParrafo = String(d.text ?? "").split(/\n{2,}/)[0] ?? "";
  return {
    title: String(d.title ?? ""),
    arcType: d.arcType ?? null,
    vocabLemmas: ((d.vocab as Array<{ word?: unknown }>) ?? []).map((v) => String(v?.word ?? "")),
    characterNames: [...names],
    openingFirstSentence: (primerParrafo.split(/(?<=[.!?])\s/)[0] ?? primerParrafo).trim(),
    motifTags: extractStoryMotifs(String(d.text ?? "")),
  };
}

// Los caracteres se construyen por codigo: escribirlos aqui romperia la misma
// regla que este check hace cumplir.
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const GUIONES = new RegExp(`[${EM}${EN}]`, "g");
const EMOJI = /\p{Extended_Pictographic}/gu;

/** Proporcion de parrafos citados que llevan narracion al lado. */
function acotacion(textos: string[]): { citados: number; conNarrador: number } {
  const CITA = /“([^”]+)”/;
  let citados = 0, conNarrador = 0;
  for (const t of textos) {
    const ps = t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    ps.forEach((x, i) => {
      if (!CITA.test(x)) return;
      citados++;
      const propia = x.replace(new RegExp(CITA.source, "g"), " ").trim().split(/\s+/).filter(Boolean).length >= 2;
      const previa = i > 0 && !ps[i - 1].includes("“");
      if (propia || previa) conNarrador++;
    });
  }
  return { citados, conNarrador };
}

// ── EL DETECTOR DE TICS ──────────────────────────────────────────────────
//
// Todo lo de aqui se mide sobre las TRES historias juntas. Es a proposito: un
// tic no se ve en una historia, se ve en el tema. El validador canonico juzga
// cada historia y por eso estos defectos le pasan por debajo enteros.

/** Los parrafos de un texto, sin lineas vacias. */
const parrafosDe = (t: string) =>
  t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);

/** Primera palabra util, en minusculas y sin la puntuacion de apertura. */
function primeraPalabra(s: string): string {
  const m = s.trim().replace(/^[^\p{L}\p{N}]+/u, "").match(/^[\p{L}\p{N}']+/u);
  return m ? m[0].toLowerCase() : "";
}

/**
 * (a) ACOTACION DOMINANTE. El verbo que va justo detras de la cita. Si uno solo
 * se lleva mas del 40% de las acotaciones y hay al menos 5 en el tema, el
 * narrador tiene un tic y se nota leyendo las tres seguidas.
 *
 * Caso real (2026-09-05): "añade" y "remata" cerraban 8 de las 9 historias del
 * B1 de España; cada historia pasaba sola y el tema sonaba a plantilla.
 */
const VERBO_TRAS_CITA = new RegExp(`[${String.fromCharCode(0x201d)}"],\\s*([a-záéíóúñ]+)`, "g");
const TOPE_ACOTACION_DOMINANTE = 0.40;
const MINIMO_ACOTACIONES = 5;

function verbosDeAcotacion(textos: string[]): { total: number; cuenta: Map<string, number> } {
  const cuenta = new Map<string, number>();
  let total = 0;
  for (const t of textos)
    for (const m of t.matchAll(VERBO_TRAS_CITA)) {
      total++;
      cuenta.set(m[1], (cuenta.get(m[1]) ?? 0) + 1);
    }
  return { total, cuenta };
}

/**
 * (b) ARRANQUES REPETIDOS. Dos formas del mismo tic: las tres historias
 * abriendo con la misma palabra, y una palabra que abre mas del 60% de los
 * parrafos del tema (la trampa "Manon + verbo" de feedback_stories_need_stakes).
 */
const TOPE_ARRANQUE_PARRAFOS = 0.60;
const MINIMO_PARRAFOS = 5;

/**
 * (d2) SEGUIDILLA. La cara opuesta de la densidad: narracion en rafagas de
 * oraciones de 3 o 4 palabras ("El dia es largo. Se quema un dedo. Rompe un
 * vaso.") tampoco suena a historia. Se mide SOLO la narracion (las citas
 * fuera: el dialogo corto es normal). Avisa, no bloquea: el remate final en
 * dos golpes es un recurso legitimo; la rafaga sostenida no.
 */
const TOPE_SEGUIDILLA = 0.5;
function seguidillaNarrada(textos: string[]): { cortas: number; total: number } {
  let cortas = 0, total = 0;
  for (const t of textos) {
    const narr = t.replace(/“[^”]*”|"[^"]*"/g, "");
    for (const o of narr.split(/(?<=[.!?…])\s+|\n+/)) {
      const n = (o.match(/[\p{L}\p{N}']+/gu) ?? []).length;
      if (!n) continue;
      total++;
      if (n <= 4) cortas++;
    }
  }
  return { cortas, total };
}

/** (d) DENSIDAD. Palabras por oracion, sobre las tres juntas. */
function palabrasPorOracion(textos: string[]): { media: number; oraciones: number } {
  let palabras = 0, oraciones = 0;
  for (const t of textos)
    for (const o of t.split(/(?<=[.!?…])\s+|\n+/)) {
      const n = (o.match(/[\p{L}\p{N}']+/gu) ?? []).length;
      if (!n) continue;
      oraciones++;
      palabras += n;
    }
  return { media: oraciones ? palabras / oraciones : 0, oraciones };
}

/**
 * El techo de densidad por nivel. En niveles bajos la frase larga no se
 * "simplifica" apretando: se recortan HECHOS. Por eso esto avisa en vez de
 * bloquear, que la salida correcta es tirar un suceso, no partir una oracion.
 */
const TECHO_DENSIDAD: Record<string, number> = { a0: 9, a1: 11, a2: 13 };

/**
 * (e) REGISTRO REPETIDO. Los dos temas cerrados justo antes en el mismo
 * journey. Tres temas seguidos con el mismo registro declarado no es un tono,
 * es la ausencia de una decision.
 */
function registrosPrevios(journeyId: string, topic: string, cuantos = 2): string[] {
  const reg = leerRegistro();
  return Object.entries(reg)
    .filter(([k, v]) => k.startsWith(`${journeyId}#`) && k !== claveCierre(journeyId, topic) && v.plan?.registro)
    .sort((a, b) => String(b[1].cerrado).localeCompare(String(a[1].cerrado)))
    .slice(0, cuantos)
    .map(([, v]) => String(v.plan!.registro).trim().toLowerCase());
}

/** Encuentros por plaza dentro del tema. La escalera de verdad es del journey. */
function escaleraDelTema(hs: Historia[]): { media: number; plazas: number } {
  const tok = (t: string) => new Set((t.toLowerCase().match(/\p{L}+/gu) ?? []));
  const cuerpos = hs.map((s) => tok(String(s.text ?? "")));
  let suma = 0, plazas = 0;
  for (const s of hs)
    for (const v of ((s.vocab as Array<{ word?: unknown; surface?: unknown }>) ?? [])) {
      const k = String(v?.surface ?? v?.word ?? "").toLowerCase();
      if (!k) continue;
      plazas++;
      suma += cuerpos.filter((c) => c.has(k)).length;
    }
  return { media: plazas ? suma / plazas : 0, plazas };
}

async function desdeBase(journeyId: string, topic: string) {
  const { config } = await import("dotenv");
  config({ path: ".env.local", quiet: true });
  config({ path: ".env", quiet: true });
  const { PrismaClient } = await import("../src/generated/prisma");
  const p = new PrismaClient();
  try {
    const j = await p.journey.findUnique({
      where: { id: journeyId },
      select: { language: true, variant: true, levels: true, topics: true, storiesPerTopic: true },
    });
    if (!j) throw new Error(`no encuentro el journey ${journeyId}`);
    if (!j.topics.includes(topic))
      throw new Error(`el tema "${topic}" no es de este journey. Sus temas: ${j.topics.join(", ")}`);
    const filas = await p.journeyStory.findMany({
      where: { journeyId, topic },
      select: { slug: true, title: true, text: true, vocab: true, topic: true, slotIndex: true,
                synopsis: true, arcType: true },
      orderBy: { slotIndex: "asc" },
    });
    const total = await p.journeyStory.count({ where: { journeyId, text: { not: null } } });
    // Personas REALES, igual que en saveStory: sin la lista el check de
    // personajes no puede medir y devuelve `not-implemented`, que bloquea.
    const realPeople = (await p.betaSignup.findMany({ select: { email: true } }))
      .flatMap((b) => String(b.email ?? "").split("@")[0].split(/[._\-+0-9]+/))
      .filter((w) => w.length >= 3)
      .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    return {
      historias: filas as Historia[],
      language: j.language, level: (j.levels ?? [])[0] ?? "", variant: j.variant ?? "",
      esperadas: j.storiesPerTopic ?? 3,
      historiasDelJourney: total,
      realPeople,
    };
  } finally {
    await p.$disconnect();
  }
}

function desdeJson(fichero: string) {
  const raw = JSON.parse(fs.readFileSync(fichero, "utf8"));
  const obj = Array.isArray(raw) ? { stories: raw } : raw;
  const historias = (obj.stories ?? []) as Historia[];
  return {
    historias,
    journeyId: arg("journey", obj.journeyId) ?? "",
    topic: arg("topic", obj.topic ?? historias[0]?.topic) ?? "",
    language: arg("lang", obj.language) ?? "ES",
    level: arg("level", obj.level) ?? "",
    variant: arg("variant", obj.variant) ?? "",
    esperadas: Number(obj.storiesPerTopic ?? 3),
    historiasDelJourney: Number(obj.historiasDelJourney ?? historias.length),
    realPeople: obj.realPeople as string[] | undefined,
  };
}

(async () => {
  const modoJson = process.argv.includes("--json");
  let journeyId: string, topic: string;
  let datos: {
    historias: Historia[]; language: string; level: string; variant: string;
    esperadas: number; historiasDelJourney: number; realPeople?: string[];
  };

  if (modoJson) {
    const d = desdeJson(arg("json")!);
    journeyId = d.journeyId; topic = d.topic; datos = d;
    if (!journeyId || !topic) {
      console.error("cierraTema: el fixture necesita journeyId y topic (en el fichero o con --journey/--topic).");
      process.exit(2);
    }
  } else {
    journeyId = process.argv[2]; topic = process.argv[3];
    if (!journeyId || !topic || journeyId.startsWith("--")) {
      console.error("uso: cierraTema.ts <journeyId> <tema> --plan <plan.json>");
      console.error("     cierraTema.ts --json <fichero> --plan <plan.json> [--lang ES] [--level a2] [--variant LATAM]");
      process.exit(2);
    }
    datos = await desdeBase(journeyId, topic);
  }

  const { historias, language, level, variant, esperadas, historiasDelJourney, realPeople } = datos;
  const conTexto = historias.filter((s) => String(s.text ?? "").trim());
  const fallos: string[] = [];
  const checks: string[] = [];
  const pendientes: string[] = [];
  const avisos: string[] = [];

  console.log(`\n── cierre del tema "${topic}" · journey ${journeyId} ──`);
  console.log(`   ${conTexto.length}/${esperadas} historias con texto · ${language} ${level} ${variant}`);

  if (conTexto.length < esperadas)
    fallos.push(`el tema tiene ${conTexto.length} historias con texto y necesita ${esperadas}`);

  // ── 0. EL PLAN. Sin el, el tema no cierra ────────────────────────────
  //
  // El plan se escribe ANTES de la primera linea de prosa y se le enseña al
  // usuario. Pedirlo aqui, al cerrar, es lo unico que impide que se invente
  // despues para justificar lo que ya salio.
  const ficheroPlan = arg("plan");
  let plan: PlanTema | undefined;
  if (!ficheroPlan) {
    fallos.push(
      "falta el PLAN del tema. Se escribe antes de la prosa y se pasa con --plan <plan.json>:\n" +
      "     { tipo, nivel, variante, registro, espina, historias: [{ slot, quiere, impide, cuesta, cambia, emocion } x3] }"
    );
    console.log("   [plan]      FALTA (--plan <plan.json>)");
  } else if (!fs.existsSync(ficheroPlan)) {
    fallos.push(`el plan ${ficheroPlan} no existe`);
    console.log(`   [plan]      no existe: ${ficheroPlan}`);
  } else {
    let crudo: unknown = null;
    try {
      crudo = JSON.parse(fs.readFileSync(ficheroPlan, "utf8"));
    } catch (e) {
      fallos.push(`el plan ${ficheroPlan} no es JSON valido: ${(e as Error).message}`);
    }
    const falta = crudo === null ? ["el plan entero"] : faltaEnPlan(crudo, esperadas);
    if (falta.length) {
      fallos.push(
        `el plan esta incompleto. Falta por escribir: ${falta.join(", ")}.\n` +
        "     Un campo vacio no es una decision: escribelo o el tema no cierra."
      );
      console.log(`   [plan]      INCOMPLETO: falta ${falta.join(", ")}`);
    } else {
      plan = crudo as PlanTema;
      console.log(`   [plan]      completo · tipo ${plan.tipo} · nivel ${plan.nivel} · registro "${plan.registro}"`);
      checks.push(`plan del tema completo (registro "${plan.registro}", espina "${plan.espina}")`);
    }
  }

  // ── 1. Validador canonico, en seco, cada una contra sus hermanas ──
  //
  // `--narrator` exime EXACTAMENTE los tres checks que saveStory exime en
  // perfil narrador, y ninguno mas: los tres leen turnos "Personaje: linea",
  // que la prosa narrada no tiene. Cierra con otra lista y el cierre pediria a
  // una historia narrada algo que el guardado no le pide.
  const narrador = process.argv.includes("--narrator");
  const EXENTOS_NARRADOR = new Set(["body-dialogue-ratio", "speakers-count", "speaker-lines"]);
  const previas: ExistingStorySummary[] = [];
  let okCanonico = 0;
  for (const d of conTexto) {
    // Una historia a la que le FALTA un campo (synopsis, vocab) es un fallo
    // del cierre, no un crash: el validador asume el objeto entero.
    const faltan = (["title", "synopsis", "text"] as const).filter(
      (campo) => typeof d[campo] !== "string" || !d[campo].trim()
    );
    if (faltan.length) {
      fallos.push(`"${String(d.title ?? d.slug ?? "?")}": sin ${faltan.join(", ")}; el validador canonico necesita la historia completa`);
      previas.push(resumen(d));
      continue;
    }
    const r = await validateGeneratedStory(
      { title: d.title, synopsis: d.synopsis, text: d.text, vocab: d.vocab, arcType: d.arcType } as never,
      {
        language, level, variant, topic,
        journeyTitles: conTexto.map((x) => String(x.title ?? "")).filter((t) => t !== d.title),
        existing: [...previas],
      } as never
    );
    previas.push(resumen(d));
    const malos = r.checks.filter(
      (c) => c.status === "fail" && !(narrador && EXENTOS_NARRADOR.has(c.id))
    );
    if (!malos.length) okCanonico++;
    else
      for (const c of malos)
        fallos.push(`[canonico ${d.topic}#${d.slotIndex}] ${c.id}: ${c.detail ?? c.label}`);
  }
  checks.push(`validador canonico: ${okCanonico}/${conTexto.length}${narrador ? " (perfil narrador)" : ""}`);
  console.log(`   [canonico]  ${okCanonico}/${conTexto.length} historias limpias${narrador ? " [narrator]" : ""}`);
  // El solape con OTROS journeys lo mide saveStory al guardar, con la base
  // delante. Aqui no se puede, y decir "limpio" seria decir de mas.
  pendientes.push("solape de vocab contra otros journeys (lo mide saveStory al guardar)");

  // ── 2. Guiones largos y emojis, en el CONTENIDO ──
  for (const d of conTexto) {
    const donde = `${d.topic}#${d.slotIndex}`;
    const texto = `${d.title ?? ""}\n${d.text ?? ""}\n${JSON.stringify(d.vocab ?? [])}`;
    const g = texto.match(GUIONES) ?? [];
    if (g.length) fallos.push(`[guiones] ${donde}: ${g.length} guion(es) largo(s) en el contenido`);
    const e = texto.match(EMOJI) ?? [];
    if (e.length) fallos.push(`[emojis] ${donde}: ${[...new Set(e)].join(" ")}`);
  }
  checks.push("sin guiones largos ni emojis en el contenido");
  console.log(`   [tipografia] guiones largos y emojis: ${fallos.some((f) => /^\[(guiones|emojis)\]/.test(f)) ? "HAY" : "limpio"}`);

  // ── 3. Acotacion. Solo avisa: la regla no tiene gate y fingir que si lo
  //      tiene seria justo lo que este trabajo vino a quitar de en medio.
  const ac = acotacion(conTexto.map((s) => String(s.text ?? "")));
  if (ac.citados) {
    const pct = Math.round((ac.conNarrador / ac.citados) * 100);
    console.log(`   [acotacion] ${pct}% de los parrafos citados llevan narrador al lado (${ac.conNarrador}/${ac.citados}); solo avisa`);
    checks.push(`acotacion ${pct}% (solo avisa)`);
  } else {
    console.log("   [acotacion] no hay parrafos con habla citada");
  }

  // ── 3b. LOS TICS DEL TEMA ────────────────────────────────────────────
  //
  // Se mide sobre las tres juntas porque es ahi donde existe el defecto. Dos
  // bloquean y tres avisan, y la diferencia no es de gravedad sino de arreglo:
  // lo que bloquea se arregla cambiando una palabra o una linea; lo que avisa
  // pide rehacer una escena, y esa decision es del que escribe.
  const textos = conTexto.map((s) => String(s.text ?? ""));

  // (a) Un verbo de acotacion que se come el tema.
  const va = verbosDeAcotacion(textos);
  if (va.total >= MINIMO_ACOTACIONES) {
    const [verbo, n] = [...va.cuenta.entries()].sort((x, y) => y[1] - x[1])[0];
    const cuota = n / va.total;
    console.log(`   [tics a]    acotacion dominante: "${verbo}" ${n}/${va.total} (${Math.round(cuota * 100)}%)`);
    if (cuota > TOPE_ACOTACION_DOMINANTE)
      fallos.push(
        `[tics] acotacion dominante: "${verbo}" cierra ${n} de las ${va.total} citas del tema ` +
        `(${Math.round(cuota * 100)}%, tope ${Math.round(TOPE_ACOTACION_DOMINANTE * 100)}%). ` +
        "Varia el verbo o quita la acotacion; leidas seguidas suenan a plantilla."
      );
    else checks.push(`acotacion dominante bajo tope ("${verbo}" ${Math.round(cuota * 100)}%)`);
  } else {
    console.log(`   [tics a]    ${va.total} acotaciones, menos de ${MINIMO_ACOTACIONES}: no se mide`);
  }

  // (b) Arranques repetidos, en las historias y en los parrafos.
  const primeras = textos.map((t) => primeraPalabra(t)).filter(Boolean);
  if (primeras.length === textos.length && textos.length >= 3 && new Set(primeras).size === 1)
    fallos.push(
      `[tics] las ${textos.length} historias del tema abren con la misma palabra ("${primeras[0]}"). ` +
      "Cambia el arranque de al menos una: es lo primero que lee quien abre el tema."
    );
  const aperturas = textos.flatMap((t) => parrafosDe(t).map(primeraPalabra)).filter(Boolean);
  if (aperturas.length >= MINIMO_PARRAFOS) {
    const cuenta = new Map<string, number>();
    for (const w of aperturas) cuenta.set(w, (cuenta.get(w) ?? 0) + 1);
    const [palabra, n] = [...cuenta.entries()].sort((x, y) => y[1] - x[1])[0];
    const cuota = n / aperturas.length;
    console.log(`   [tics b]    arranque de parrafo mas repetido: "${palabra}" ${n}/${aperturas.length} (${Math.round(cuota * 100)}%)`);
    if (cuota > TOPE_ARRANQUE_PARRAFOS)
      fallos.push(
        `[tics] "${palabra}" abre ${n} de los ${aperturas.length} parrafos del tema ` +
        `(${Math.round(cuota * 100)}%, tope ${Math.round(TOPE_ARRANQUE_PARRAFOS * 100)}%). ` +
        "Es la trampa del nombre propio seguido de verbo: rompe el patron."
      );
    else checks.push(`arranques de parrafo variados (mas repetido "${palabra}", ${Math.round(cuota * 100)}%)`);
  }

  // (c) Estructura clonada. Avisa: tres historias del mismo largo pueden ser
  //     casualidad, y quien lo arregla tiene que releer, no obedecer.
  const nParrafos = textos.map((t) => parrafosDe(t).length);
  if (nParrafos.length >= 3 && new Set(nParrafos).size === 1)
    avisos.push(
      `estructura clonada: las ${nParrafos.length} historias tienen ${nParrafos[0]} parrafos exactos. ` +
      "Leelas seguidas antes de darlas por buenas."
    );

  // (d) Densidad en niveles bajos, con el nivel que DECLARA el plan.
  const nivelPlan = String(plan?.nivel ?? level).trim().toLowerCase();
  const techo = TECHO_DENSIDAD[nivelPlan];
  if (techo) {
    const den = palabrasPorOracion(textos);
    console.log(`   [tics d]    densidad: ${den.media.toFixed(1)} palabras por oracion en ${den.oraciones} oraciones (techo ${techo} en ${nivelPlan})`);
    if (den.media > techo)
      avisos.push(
        `densidad alta para ${nivelPlan}: ${den.media.toFixed(1)} palabras por oracion (techo ${techo}). ` +
        "En niveles bajos se recortan HECHOS, no se aprietan frases: quita un suceso de la escena."
      );
    else checks.push(`densidad ${den.media.toFixed(1)} palabras por oracion (techo ${techo} en ${nivelPlan})`);

    // (d2) Seguidilla de oraciones cortas en la narracion.
    const seg = seguidillaNarrada(textos);
    if (seg.total >= 8) {
      const parte = seg.cortas / seg.total;
      console.log(`   [tics d2]   seguidilla: ${seg.cortas}/${seg.total} oraciones narradas de 4 palabras o menos (tope ${TOPE_SEGUIDILLA * 100}%)`);
      if (parte > TOPE_SEGUIDILLA)
        avisos.push(
          `seguidilla: ${Math.round(parte * 100)}% de la narracion son oraciones de 4 palabras o menos. ` +
          "No suena a historia: une con y/pero/porque/cuando, guarda el golpe corto para el remate."
        );
      else checks.push(`seguidilla ${seg.cortas}/${seg.total} oraciones cortas narradas`);
    }
  }

  // (e) Registro repetido tres temas seguidos.
  if (plan?.registro) {
    const previos = registrosPrevios(journeyId, topic);
    const mio = plan.registro.trim().toLowerCase();
    if (previos.length >= 2 && previos.every((r) => r === mio))
      avisos.push(
        `registro repetido: los dos temas anteriores de este journey tambien se cerraron con "${plan.registro}". ` +
        "Tres seguidos con el mismo tono no es una voz, es una decision que no se tomo."
      );
  }

  // ── 4. Escalera de vocab del tema, informativa ──
  const esc = escaleraDelTema(conTexto);
  console.log(`   [escalera]  ${esc.media.toFixed(2)} encuentros por plaza dentro del tema (${esc.plazas} plazas)`);
  pendientes.push(
    `escalera de recirculacion del journey (medida sobre las ${historiasDelJourney} historias escritas, ` +
    "se juzga con el journey completo)"
  );

  // ── 5. Gate de conjunto, con las historias que HAY ──
  //
  // Desde el 2026-09-05 el checker de journey no se salta con el conjunto a
  // medias: los checks prefix-safe (los que no se arreglan añadiendo
  // historias) corren sobre las tres del tema, y los de conjunto devuelven
  // `pending-set`, que aqui se imprime como pendiente. Un tema cerrado no es
  // un journey aprobado, y eso se dice, no se calla.
  const jc = validateJourneyStories(
    conTexto.map((s) => ({
      slug: String(s.slug ?? `${s.topic}#${s.slotIndex}`),
      title: String(s.title ?? ""),
      text: String(s.text ?? ""),
      vocab: s.vocab as never,
      language, level, topic: s.topic,
    })),
    { language, level, realPeople, conjuntoCompleto: false }
  );
  console.log("");
  for (const c of jc) {
    const marca = c.status === "pass" ? "ok  " : c.status === "fail" ? "FAIL"
      : c.status === "pending-set" ? "espera" : "SIN IMPLEMENTAR";
    console.log(`   [conjunto] ${marca} ${c.id} ${c.detail ?? ""}`);
    if (c.status === "fail") fallos.push(`[conjunto] ${c.id}: ${c.detail ?? c.label}`);
    else if (c.status === "pending-set") pendientes.push(`${c.id}: ${c.detail ?? ""}`);
    else if (c.status === "not-implemented") {
      // En modo fixture no hay base, y varios checks necesitan datos que solo
      // estan ahi (la lista de solicitantes, por ejemplo). Eso no se puede
      // llamar aprobado: se lista como pendiente, diciendo por que.
      if (modoJson) pendientes.push(`${c.id} (modo fixture, sin base de datos): ${c.detail ?? ""}`);
      else fallos.push(`[conjunto] ${c.id} no se pudo medir: ${c.detail ?? c.label}`);
    }
  }
  checks.push(`gate de conjunto sobre el tema: ${jc.filter((c) => c.status === "pass").length}/${jc.length} medidos y limpios`);

  console.log("");
  for (const a of avisos) console.log(`   aviso (no bloquea): ${a}`);
  for (const p of pendientes) console.log(`   pendiente de conjunto: ${p}`);

  if (fallos.length) {
    console.error(`\n✗ EL TEMA NO SE CIERRA: ${fallos.length} fallo(s). NADA ESCRITO EN EL REGISTRO.\n`);
    for (const f of fallos) console.error("   " + f);
    console.error("\n   Arregla la historia, no el gate. Cuando pase, vuelve a correr este comando.");
    process.exit(1);
  }

  const cierre: Cierre = {
    cerrado: new Date().toISOString(),
    hash: hashTema(conTexto),
    historias: conTexto.map((s) => `${s.topic}#${s.slotIndex} ${s.slug ?? s.title ?? ""}`.trim()),
    checks,
    pendientesDeConjunto: pendientes,
    plan,
    avisos: avisos.length ? avisos : undefined,
  };
  escribirCierre(journeyId, topic, cierre);
  console.log(`\n✓ TEMA CERRADO. Registrado en scripts/tema-cierres.json (hash ${cierre.hash}), con su plan.`);
  console.log("   Eso, y no una frase, es lo que hace que el tema cuente como listo.");
  if (avisos.length)
    console.log(`   Quedan ${avisos.length} aviso(s) guardados en el registro: no bloquean, pero no son "limpio".`);
})();
