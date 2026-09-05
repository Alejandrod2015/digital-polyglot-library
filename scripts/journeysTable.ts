/**
 * TABLA CANÓNICA DE JOURNEYS (estándar acordado con el usuario 2026-07-26).
 * Cuando el usuario pida "la tabla de journeys", correr ESTO y pegar SU salida.
 * Componer una tabla a mano está PROHIBIDO (ver la sección "Pedir una vez" de
 * .claude/CLAUDE.md y el skill /tabla): había ocho scripts de tabla en
 * scripts/ porque cada chat se fabricó el suyo, y una tabla escrita a ojo no
 * se distingue de una inventada.
 *
 * CLASIFICACIÓN (regla dura del proyecto): live (active) + draft, y NUNCA
 * archived salvo que se pida a propósito con --archived.
 *
 *   npx tsx scripts/journeysTable.ts                   todos los journeys
 *   npx tsx scripts/journeysTable.ts --journey <id>    uno, por temas y por historias
 *   npx tsx scripts/journeysTable.ts --archived        incluye los archivados
 *
 * Columnas (catálogo): Estado | Journey | Idioma/Variante | Nivel | Estructura |
 *           Estilo | %Citado | No nativos | Voz narrador | Voz práctica |
 *           Hist. pub | Narración | Covers | Ambient | Clips práctica
 *
 * Columnas (un journey): por TEMA, cuántas historias del tema están escritas
 *           con vocab, con glosas tap, con práctica, con audio y con portada;
 *           por HISTORIA, arco, palabras, % citado, vocab, solape con otros
 *           journeys y con este, cobertura de glosas, portables y ancladas,
 *           encuentros antes y después, escalera, fragmentos de audio, portada.
 *
 * Las columnas de estructura y ambient vienen de _journeysTable2 y
 * _journeysTable3, y las dos tablas por journey de _journeyTable, _tablasJourney,
 * _a2Tablas y _ptJourneyTable, borrados el 2026-09-05 tras migrarlas aquí.
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { APPROVED_VOICES } from "../src/lib/approvedVoices";
import { extractStoryPlainText, findSpeakerLabelRanges } from "../src/lib/storyPlainText";
const p = new PrismaClient();

const W = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const arg = (n: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
};
const flag = (n: string) => process.argv.includes(`--${n}`);

/** live + draft, y archived SOLO si se pide. Regla dura del proyecto. */
const ESTADOS = (): ("active" | "draft" | "archived")[] =>
  flag("archived") ? ["active", "draft", "archived"] : ["active", "draft"];

/**
 * Los cuatro estilos de comillas del corpus: angulares «» (ES/IT), bajas
 * alemanas „…" (el A0 alemán cierra con la recta ASCII), curvas “” (parte de
 * Colombia) y rectas "". Se aplican EN ESTE ORDEN y cada cita encontrada se
 * borra del cuerpo antes de pasar al siguiente estilo, porque si no la recta
 * ASCII se empareja con el cierre de una cita alemana y mide el texto que hay
 * ENTRE dos citas en vez de la cita. Emparejar solo las rectas de forma ingenua
 * daba 7,0% en vez del 19,3% real en el journey alemán A0.
 */
const QUOTE_STYLES: RegExp[] = [
  /«[^»]*»/g,
  /„[^„“”"]*["“”]/g,
  /“[^“”]*”/g,
  /"[^"\n]*"/g,
];

/**
 * Palabras de habla de personaje y total narrado de UNA historia.
 *
 * El corpus escribe el diálogo de DOS formas y hay que sumar las dos:
 *   - prosa con habla citada dentro del párrafo del narrador;
 *   - bloques `Personaje: línea` (el molde conversacional v2-2026-06).
 * Contar solo las comillas medía 0,0% en journeys escritos en bloques y los
 * hacía pasar por mudos cuando eran los que MÁS diálogo tenían (el Traveler
 * es/spain a2 daba 0,0% con 253 turnos y 62% de habla). Las etiquetas de
 * personaje no se narran, así que salen del numerador Y del denominador.
 *
 * Los turnos de bloque se descuentan del cuerpo antes de buscar comillas, para
 * no contar dos veces una cita que viva dentro de un turno.
 */
function spokenWords(raw: string | null): { spoken: number; total: number } {
  const t = extractStoryPlainText(raw ?? "");
  if (!t.trim()) return { spoken: 0, total: 0 };

  const ranges = findSpeakerLabelRanges(t);
  let spoken = 0, labelWords = 0, rest = "", cursor = 0;
  for (const r of ranges) {
    const nl = t.indexOf("\n", r.end);
    const lineEnd = nl === -1 ? t.length : nl;
    spoken += W(t.slice(r.end, lineEnd));
    labelWords += W(t.slice(r.start, r.end));
    rest += t.slice(cursor, r.start);
    cursor = lineEnd;
  }
  rest += t.slice(cursor);

  for (const re of QUOTE_STYLES) {
    const found = rest.match(re) ?? [];
    spoken += found.reduce((n, q) => n + W(q.replace(/[«»„“”"]/g, "")), 0);
    rest = rest.replace(re, " ");
  }
  return { spoken, total: W(t) - labelWords };
}

/**
 * NO NATIVOS: número de PERSONAJES distintos escritos como no nativos de la
 * región del idioma del journey, o como aprendices de ese idioma. Regla dura
 * (usuario 2026-08-17): el objetivo es 0 en todas las filas. Ver CLAUDE.md
 * § "Todos los personajes son nativos".
 *
 * Es un conteo de PERSONAJES, no de historias: Nadia aparece en las 21 del
 * Expat y cuenta 1. Va curado a mano a propósito, porque el gate léxico
 * (`body-non-native-character`) no puede cazar las infracciones de PREMISA:
 * el Expat DE da 0/21 historias con marcador y sin embargo tiene 2 personajes
 * no nativos (Nadia tiene Visum y Aufenthaltstitel, Mira pregunta "sprechen
 * Sie Deutsch?"). Solo la lectura humana los ve.
 *
 * Auditado 2026-08-17 sobre los 16 journeys live+draft; reindexado por ID el
 * 2026-08-21. La clave es el `Journey.id` y no idioma/variante/nombre porque
 * ese texto NO identifica un journey: los dos Expat alemanes C1 (Berlín y
 * Hamburgo) comparten idioma, variante, nombre y nivel, y mientras Hamburgo se
 * llamó "Hanseat" la colisión no se veía. Con clave de texto, además, cada
 * renombrado dejaba la entrada huérfana y la fila pasaba a decir 0, que es
 * peor que no decir nada.
 *
 * Para refrescar: se cuentan leyendo las historias del journey; el gate léxico
 * solo da pistas. Si un journey de la tabla no está aquí, sale 0 SIN haberlo
 * medido.
 */
const NON_NATIVE_CHARS: Record<string, { n: number; who: string }> = {
  cmr92f0qz000032ff1dfd4fgx: { n: 2, who: "Nadia (21 hist., premisa), Mira (1)" },  // Expat de/de c1 (Berlín)
  cmrdbz11t000032asrvo832i9: { n: 2, who: "Nora (21 hist., premisa), Sofia (1)" },  // Expat de/de c1 (Hamburgo)
  cmroo4w4v0000324ow1o9qlcp: { n: 1, who: "Nadia (5 hist.)" },                      // Friends de/de c1
  cmsvz6mz9000732gsgsfer0ko: { n: 1, who: "Irene (21 hist., premisa)" },            // Traveler es/spain a1
  cmrr5hnbl000032k1esry5n8g: { n: 1, who: "Lucía (2 hist.)" },                      // Friends es/spain a0
  cmqrtaj1p000032qtda86z6um: { n: 1, who: "Ana (3 hist.)" },                        // Traveler es/latam a0
  cmrrqjd2n000032nvnp2tryzg: { n: 1, who: "Sofía (1 hist.)" },                      // Traveler es/mexico a0
  cmss0fkc40007j8dub1zpa1kc: { n: 1, who: "Irene (1 hist.)" },                      // Traveler it/italy a0
};
const nonNative = (id: string) => NON_NATIVE_CHARS[id] ?? { n: 0, who: "" };

const vname = (id?: string | null) => {
  if (!id) return "-";
  const note = (APPROVED_VOICES as Record<string, { note: string }>)[id]?.note;
  return note ? note.split(/[(—]/)[0].trim() : `${id.slice(0, 8)} (no aprob.)`;
};
const mode = (arr: (string | null)[]) => {
  const m = new Map<string, number>();
  arr.filter(Boolean).forEach((v) => m.set(v!, (m.get(v!) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

async function main() {
  const js = await p.journey.findMany({
    where: { status: { in: ESTADOS() } }, // live + draft; archived solo con --archived
    select: {
      id: true, name: true, language: true, variant: true, status: true, levels: true,
      topics: true, storiesPerTopic: true,
      stories: {
        select: {
          status: true, audioUrl: true, coverUrl: true, cast: true, text: true,
          dialogueSpec: true, voiceId: true, practiceVoiceId: true, ambientTag: true,
          practiceSet: { select: { exercises: { select: { payload: true } } } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { language: "asc" }, { name: "asc" }],
  });
  console.log(
    flag("archived")
      ? "AVISO: incluye ARCHIVED porque se pidio con --archived. Sin ese flag, solo live + draft."
      : "live + draft (los archivados quedan fuera; --archived los incluye)"
  );
  console.log("Estado|Journey|Idioma/Var|Nivel|Estructura|Estilo|%Citado|NoNativos|Voz narrador|Voz práctica|Hist.pub|Narr|Covers|Ambient|Clips");
  const notas: string[] = [];
  for (const j of js) {
    const S = j.stories;
    const pub = S.filter((s) => s.status === "published").length;
    const narr = S.filter((s) => (s.audioUrl ?? "").trim()).length;
    const cov = S.filter((s) => (s.coverUrl ?? "").trim()).length;
    let clips = 0;
    for (const s of S) for (const ex of s.practiceSet?.exercises ?? []) {
      const ac = (ex.payload as { audioClip?: { clipUrl?: string; wordClipUrl?: string } } | null)?.audioClip;
      if (ac?.clipUrl) clips++;
      if (ac?.wordClipUrl) clips++;
    }
    const multi = S.filter((s) => (s.cast && Object.keys(s.cast as object).length) || s.dialogueSpec).length;
    const estilo = S.length === 0 ? "-" : multi === 0 ? "narrador" : multi === S.length ? "multivoz" : `mixto(${multi}/${S.length})`;
    // Se agregan las palabras crudas de todo el journey, no el promedio de los
    // porcentajes por historia: si no, una historia corta pesa igual que una larga.
    const sp = S.map((s) => spokenWords(s.text));
    const spoken = sp.reduce((n, x) => n + x.spoken, 0);
    const totalW = sp.reduce((n, x) => n + x.total, 0);
    const citado = totalW === 0 ? "-" : `${((spoken / totalW) * 100).toFixed(1)}`;
    const est = j.status === "active" ? "LIVE" : j.status === "draft" ? "DRAFT" : "ARCHIVED";
    // Estructura (de _journeysTable2): niveles x temas x historias por tema. Es
    // lo que separa un draft con la forma de hoy (1x7x3) de uno archivado.
    const estructura = `${j.levels.length}x${j.topics.length}x${j.storiesPerTopic}`;
    // Ambient (de _journeysTable3): historias con etiqueta de ambiente.
    const amb = S.filter((s) => (s.ambientTag ?? "").trim()).length;
    const nn = nonNative(j.id);
    // El estado desempata las dos filas que comparten tipo, idioma, variante y
    // nivel (los dos Expat alemanes C1: Berlín live, Hamburgo draft).
    if (nn.n) notas.push(`${est} ${j.name} ${j.language}/${j.variant} ${j.levels.join("/")}: ${nn.who}`);
    console.log(`${est}|${j.name}|${j.language}/${j.variant}|${j.levels.join("/") || "-"}|${estructura}|${estilo}|${citado}|${nn.n}|${vname(mode(S.map((s) => s.voiceId)))}|${vname(mode(S.map((s) => s.practiceVoiceId)))}|${pub}/${S.length}|${narr}|${cov}|${amb}/${S.length}|${clips}`);
  }
  if (notas.length) {
    console.log(`\nNo nativos (regla dura: el objetivo es 0). Quiénes son:`);
    for (const n of notas) console.log(`  - ${n}`);
  }
  await p.$disconnect();
}
/**
 * LAS DOS TABLAS DE UN JOURNEY: por temas (etapas del pipeline) y por historias
 * (vocabulario y escalera). Es la union de lo que hacian _journeyTable,
 * _tablasJourney, _a2Tablas y _ptJourneyTable, sin lo que cada una tenia de
 * hardcodeado (el nombre de un personaje, un bundle concreto, un fichero de
 * revision de una sola tanda).
 *
 * Las glosas se leen de la BASE (`dp_tap_glosses_v1`), no del directorio
 * `src/data/tapGlosses` que ya no existe: la version que leia el directorio
 * daba 0 aunque las glosas estuvieran escritas, y una tabla que informa de
 * menos es tan falsa como una que informa de mas.
 */
async function tablaDeUnJourney(id: string) {
  const j = await p.journey.findUnique({
    where: { id },
    select: { name: true, language: true, variant: true, levels: true, status: true,
              topics: true, storiesPerTopic: true },
  });
  if (!j) throw new Error(`no encuentro el journey ${id}`);
  if (j.status === "archived" && !flag("archived"))
    throw new Error(
      `el journey ${id} esta ARCHIVED. Si de verdad lo quieres, pidelo con --archived; ` +
      `si no, la tabla no lo cuenta (regla dura de clasificacion).`
    );

  const orden = j.topics;
  const filas = (await p.journeyStory.findMany({
    where: { journeyId: id },
    select: { id: true, slug: true, title: true, text: true, vocab: true, topic: true,
              slotIndex: true, status: true, arcType: true, audioUrl: true,
              audioFragments: true, coverUrl: true },
  })).sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  const etiquetas = new Map(
    (await p.topic.findMany({ where: { slug: { in: orden } }, select: { slug: true, label: true } }))
      .map((t) => [t.slug, t.label])
  );
  const conPractica = new Set(
    (await p.storyPracticeSet.findMany({
      where: { storyId: { in: filas.map((r) => r.id) } }, select: { storyId: true },
    })).map((x) => x.storyId)
  );

  // Glosas: primero las filas de contexto por historia, y de ahi el bundle al
  // que pertenece este journey (el mas frecuente). Con el bundle se saca el
  // mapa global de formas, que es contra el que se mide la cobertura.
  const slugs = filas.map((r) => r.slug).filter((s): s is string => Boolean(s));
  const filasGlosa = await p.tapGlossSet.findMany({
    where: { slug: { in: slugs } }, select: { slug: true, bundle: true, glosses: true },
  });
  const conContexto = new Set(
    filasGlosa.filter((r) => Object.keys((r.glosses ?? {}) as object).length > 0).map((r) => r.slug)
  );
  const bundle = mode(filasGlosa.map((r) => r.bundle));
  const formasBundle = new Set<string>();
  if (bundle)
    for (const r of await p.tapGlossSet.findMany({ where: { bundle }, select: { glosses: true } }))
      for (const k of Object.keys((r.glosses ?? {}) as object)) formasBundle.add(k.toLowerCase());

  // Vocab que ya enseñan OTROS journeys del mismo idioma (sin los archivados) y
  // el que este journey repite dentro de si mismo.
  const otras = await p.journeyStory.findMany({
    where: { journey: { language: j.language, status: { not: "archived" } }, journeyId: { not: id } },
    select: { vocab: true },
  });
  const fuera = new Set<string>();
  for (const r of otras)
    for (const v of ((r.vocab as Array<{ word?: unknown }> | null) ?? []))
      if (v?.word) fuera.add(String(v.word).toLowerCase());
  const cuenta = new Map<string, number>();
  for (const r of filas)
    for (const v of ((r.vocab as Array<{ word?: unknown }> | null) ?? [])) {
      if (!v?.word) continue;
      const w = String(v.word).toLowerCase();
      cuenta.set(w, (cuenta.get(w) ?? 0) + 1);
    }

  const escritas = filas.filter((r) => String(r.text ?? "").trim());
  const tok = (t: string) => new Set((t.toLowerCase().match(/\p{L}+/gu) ?? []));
  const cuerpos = escritas.map((s) => tok(String(s.text)));
  const clave = (v: { word?: unknown; surface?: unknown }) =>
    String(v?.surface ?? v?.word ?? "").toLowerCase();
  const TAPPABLE = /[\p{L}\p{N}][\p{L}\p{N}'-]*/gu;

  console.log(`### ${j.name} ${j.language}/${j.variant} ${j.levels.join("/")} · ${j.status} · ${orden.length}x${j.storiesPerTopic}\n`);

  console.log("| # | Tema | Escritas+vocab | Glosas tap | Práctica | Audio | Cover |");
  console.log("|---|---|---|---|---|---|---|");
  const T = [0, 0, 0, 0, 0];
  orden.forEach((t, i) => {
    const g = filas.filter((r) => r.topic === t);
    const esc = g.filter((r) => String(r.text ?? "").trim() && ((r.vocab as unknown[]) ?? []).length >= 20).length;
    const gl = g.filter((r) => r.slug && conContexto.has(r.slug)).length;
    const pr = g.filter((r) => conPractica.has(r.id)).length;
    const au = g.filter((r) => (r.audioUrl ?? "").trim()).length;
    const co = g.filter((r) => (r.coverUrl ?? "").trim()).length;
    T[0] += esc; T[1] += gl; T[2] += pr; T[3] += au; T[4] += co;
    const n = g.length;
    console.log(`| ${i + 1} | ${etiquetas.get(t) ?? t} | ${esc}/${n} | ${gl}/${n} | ${pr}/${n} | ${au}/${n} | ${co}/${n} |`);
  });
  console.log(`| | **journey** | **${T[0]}/${filas.length}** | **${T[1]}/${filas.length}** | **${T[2]}/${filas.length}** | **${T[3]}/${filas.length}** | **${T[4]}/${filas.length}** |`);

  console.log("\n| # | Tema | Historia | Arco | Pal. | %Citado | Vocab | Ya en otro journey | Ya en este | Glosas | Portables | Ancladas | Vistas antes | Vuelven después | Escalera | Frag | Cover |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  const escaleras: number[] = [];
  filas.forEach((s, i) => {
    const tema = etiquetas.get(s.topic) ?? s.topic;
    if (!String(s.text ?? "").trim()) {
      console.log(`| ${i + 1} | ${tema} | (vacía) #${s.slotIndex} | - | - | - | - | - | - | - | - | - | - | - | - | - | - |`);
      return;
    }
    const texto = String(s.text);
    const sp = spokenWords(texto);
    const voc = (s.vocab as Array<{ word?: unknown; surface?: unknown }>) ?? [];
    const off = voc.filter((v) => fuera.has(String(v?.word ?? "").toLowerCase())).map((v) => String(v?.word));
    const rep = voc.filter((v) => (cuenta.get(String(v?.word ?? "").toLowerCase()) ?? 0) > 1).map((v) => String(v?.word));
    const formas = new Set<string>();
    for (const src of [String(s.title ?? ""), extractStoryPlainText(texto)])
      for (const m of src.match(TAPPABLE) ?? []) formas.add(m.toLowerCase());
    const conGlosa = [...formas].filter((f) => formasBundle.has(f)).length;
    const idx = escritas.findIndex((x) => x.id === s.id);
    let port = 0, anc = 0, antes = 0, despues = 0, suma = 0;
    for (const v of voc) {
      const k = clave(v);
      const donde = cuerpos.map((c, n) => (c.has(k) ? n : -1)).filter((n) => n >= 0);
      suma += donde.length;
      if (donde.length > 1) port++; else anc++;
      if (donde.some((n) => n < idx)) antes++;
      if (donde.some((n) => n > idx)) despues++;
    }
    const escalera = voc.length ? suma / voc.length : 0;
    escaleras.push(escalera);
    const frag = Array.isArray(s.audioFragments) ? (s.audioFragments as unknown[]).length : 0;
    console.log(
      `| ${i + 1} | ${tema} | [${s.title}](http://localhost:3000/stories/${s.slug}) | ${s.arcType ?? "-"} | ` +
      `${W(texto)} | ${sp.total ? Math.round((sp.spoken / sp.total) * 100) : 0}% | ${voc.length} | ` +
      `${off.join(", ") || "0"} | ${rep.join(", ") || "0"} | ${conGlosa}/${formas.size} | ${port} | ${anc} | ` +
      `${antes} | ${despues} | ${escalera.toFixed(2)} | ${frag || (s.audioUrl ? "NO" : "-")} | ${s.coverUrl ? "sí" : "no"} |`
    );
  });
  const media = escaleras.length ? escaleras.reduce((a, b) => a + b, 0) / escaleras.length : 0;
  console.log(`| | **journey** | | | | | | | | | | | | | **${media.toFixed(2)}** | | |`);
  console.log(`\nhistorias con texto ${escritas.length}/${filas.length} · publicadas ${filas.filter((r) => r.status === "published").length}` +
    `${bundle ? ` · bundle de glosas ${bundle}` : " · sin bundle de glosas"}`);
  await p.$disconnect();
}

const unJourney = arg("journey");
(unJourney ? tablaDeUnJourney(unJourney) : main())
  .catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
