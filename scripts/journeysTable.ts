/**
 * TABLA CANÓNICA DE JOURNEYS (estándar acordado con el usuario 2026-07-26).
 * Cuando el usuario pida "la tabla de journeys", correr ESTO y devolver TODAS
 * las columnas. Solo live (active) + draft; NUNCA archived.
 *
 *   npx tsx scripts/journeysTable.ts
 *
 * Columnas: Estado | Journey | Idioma/Variante | Nivel | Estilo | %Citado |
 *           No nativos | Voz narrador | Voz práctica | Hist. pub | Narración |
 *           Covers | Clips práctica
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { APPROVED_VOICES } from "../src/lib/approvedVoices";
import { extractStoryPlainText, findSpeakerLabelRanges } from "../src/lib/storyPlainText";
const p = new PrismaClient();

const W = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

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
    where: { status: { in: ["active", "draft"] } }, // live + draft; NUNCA archived
    select: {
      id: true, name: true, language: true, variant: true, status: true, levels: true,
      stories: {
        select: {
          status: true, audioUrl: true, coverUrl: true, cast: true, text: true,
          dialogueSpec: true, voiceId: true, practiceVoiceId: true,
          practiceSet: { select: { exercises: { select: { payload: true } } } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { language: "asc" }, { name: "asc" }],
  });
  console.log("Estado|Journey|Idioma/Var|Nivel|Estilo|%Citado|NoNativos|Voz narrador|Voz práctica|Hist.pub|Narr|Covers|Clips");
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
    const est = j.status === "active" ? "LIVE" : "DRAFT";
    const nn = nonNative(j.id);
    // El estado desempata las dos filas que comparten tipo, idioma, variante y
    // nivel (los dos Expat alemanes C1: Berlín live, Hamburgo draft).
    if (nn.n) notas.push(`${est} ${j.name} ${j.language}/${j.variant} ${j.levels.join("/")}: ${nn.who}`);
    console.log(`${est}|${j.name}|${j.language}/${j.variant}|${j.levels.join("/") || "-"}|${estilo}|${citado}|${nn.n}|${vname(mode(S.map((s) => s.voiceId)))}|${vname(mode(S.map((s) => s.practiceVoiceId)))}|${pub}/${S.length}|${narr}|${cov}|${clips}`);
  }
  if (notas.length) {
    console.log(`\nNo nativos (regla dura: el objetivo es 0). Quiénes son:`);
    for (const n of notas) console.log(`  - ${n}`);
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
