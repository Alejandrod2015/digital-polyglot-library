// Sube un nivel los journeys cuyo contenido mide por encima de su etiqueta
// (medicion del 2026-09-10: sonda de gramatica por idioma + lectura). El
// portugues va aparte, en su propio chat.
//
//   npx tsx scripts/_subeNivel.ts <deshacer.json>            en seco (por defecto)
//   npx tsx scripts/_subeNivel.ts <deshacer.json> --aplicar  escribe
//
// Que migra, segun el inventario de consumidores del nivel:
//   - Journey.levels y JourneyStory.level de cada journey, en la misma transaccion.
//   - UserMetric de checkpoints de tema (metadata.levelId y storySlug "nivel:tema").
//   - UserMetric de practica de tema (practice_session_completed, metadata.levelId).
//   - UserMetric de valoracion de practica de tema (storySlug "topic:<id>:<nivel>:...").
//   - StoryPracticeExercise.cefr de los ejercicios de esas historias, si la columna existe.
// El progreso por historia (progressKey "standalone:<slug>") no lleva nivel: no se toca.
// Deja en <deshacer.json> los valores originales de cada fila que cambia.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

// El orden importa: el IT A1 deja libre el peldano a1 antes de que suba el IT A0.
const MOVES = [
  { id: "cmt5wqsf7000032ghesowd0jy", from: "a1", to: "a2", label: "IT Traveler A1 (draft)" },
  { id: "cmss0fkc40007j8dub1zpa1kc", from: "a0", to: "a1", label: "IT Traveler A0 (live)" },
  { id: "cmrr5hnbl000032k1esry5n8g", from: "a0", to: "a1", label: "ES Friends A0 Espana (live)" },
  { id: "cmrrqjd2n000032nvnp2tryzg", from: "a0", to: "a1", label: "ES Traveler A0 Mexico (live)" },
  { id: "cmt5vx8du000732fjgkwi59ks", from: "a0", to: "a1", label: "ES Friends A0 Argentina (draft)" },
  { id: "cmt09ehi60000320qf9efrypu", from: "a0", to: "a1", label: "FR Expat A0 (draft)" },
];
const CHECKPOINT_EVENTS = ["journey_topic_checkpoint_complete", "path_topic_checkpoint_complete", "atlas_topic_checkpoint_complete"];
const aplicar = process.argv.includes("--aplicar");
const undoPath = process.argv[2];

type Meta = Record<string, unknown>;

async function main() {
  if (!undoPath || undoPath.startsWith("--")) throw new Error("uso: _subeNivel.ts <deshacer.json> [--aplicar]");
  const problemas: string[] = [];
  const plan: Array<{ move: (typeof MOVES)[number]; journey: any; historias: number; metricas: Array<{ id: string; storySlug: string; metadata: Meta | null; nuevoSlug: string; nuevaMeta: Meta | null }>; ejercicios: number | string }> = [];
  const movingIds = new Set(MOVES.map((m) => m.id));

  for (const move of MOVES) {
    const j = await p.journey.findUnique({ where: { id: move.id }, select: { id: true, name: true, language: true, variant: true, typeSlug: true, levels: true, status: true, nextJourneyId: true } });
    if (!j) { problemas.push(`${move.label}: no existe`); continue; }
    if (j.levels.length !== 1 || j.levels[0] !== move.from) problemas.push(`${move.label}: levels=${JSON.stringify(j.levels)}, se esperaba ["${move.from}"]`);
    const niveles = await p.journeyStory.groupBy({ by: ["level"], where: { journeyId: j.id }, _count: true });
    const ajenos = niveles.filter((n) => n.level !== move.from);
    if (ajenos.length) problemas.push(`${move.label}: historias con nivel distinto de ${move.from}: ${JSON.stringify(ajenos)}`);
    const historias = niveles.reduce((n, x) => n + x._count, 0);

    // Choque de peldano: otro journey del mismo (idioma, variante, tipo) ya en el nivel destino y que no se mueve.
    const vecinos = await p.journey.findMany({ where: { language: j.language, variant: j.variant, typeSlug: j.typeSlug, status: { in: ["active", "draft"] }, id: { not: j.id } }, select: { id: true, levels: true, status: true } });
    for (const v of vecinos) {
      const vaciaDestino = MOVES.some((m) => m.id === v.id && m.from === move.to);
      if (v.levels.includes(move.to) && !vaciaDestino) problemas.push(`${move.label}: choca con ${v.id} (${v.status}) que ya es ${move.to}`);
    }

    // Metricas que guardan el nivel.
    const ptr = (key: string) => ({ path: ["variantId"], equals: key });
    const checkpoints = await p.userMetric.findMany({ where: { eventType: { in: CHECKPOINT_EVENTS }, metadata: ptr(j.id) }, select: { id: true, storySlug: true, metadata: true } });
    const practicas = await p.userMetric.findMany({ where: { eventType: "practice_session_completed", metadata: ptr(j.id) }, select: { id: true, storySlug: true, metadata: true } });
    const valoraciones = await p.userMetric.findMany({ where: { storySlug: { startsWith: `topic:${j.id}:${move.from}:` } }, select: { id: true, storySlug: true, metadata: true } });
    const metricas: (typeof plan)[number]["metricas"] = [];
    for (const r of [...checkpoints, ...practicas, ...valoraciones]) {
      const meta = (r.metadata && typeof r.metadata === "object" ? { ...(r.metadata as Meta) } : null);
      let cambia = false;
      if (meta && meta.levelId === move.from) { meta.levelId = move.to; cambia = true; }
      let nuevoSlug = r.storySlug;
      if (r.storySlug.startsWith(`${move.from}:`)) { nuevoSlug = `${move.to}:${r.storySlug.slice(move.from.length + 1)}`; cambia = true; }
      if (r.storySlug.startsWith(`topic:${j.id}:${move.from}:`)) { nuevoSlug = r.storySlug.replace(`topic:${j.id}:${move.from}:`, `topic:${j.id}:${move.to}:`); cambia = true; }
      if (cambia) metricas.push({ id: r.id, storySlug: r.storySlug, metadata: (r.metadata as Meta) ?? null, nuevoSlug, nuevaMeta: meta });
    }
    // Filas de la web que guardaron el slug del journey en vez del id: solo se cuentan.
    const porSlug = await p.userMetric.count({ where: { eventType: { in: [...CHECKPOINT_EVENTS, "practice_session_completed"] }, metadata: { path: ["variantId"], string_starts_with: `${j.language.slice(0, 2)}-` } } }).catch(() => -1);
    if (porSlug > 0) problemas.push(`${move.label}: hay ${porSlug} metricas con variantId tipo slug; revisar a mano`);

    let ejercicios: number | string = "n/a";
    try { ejercicios = await (p as any).storyPracticeExercise.count({ where: { set: { story: { journeyId: j.id } } } }); } catch (e) { ejercicios = "sin columna/relacion"; }

    plan.push({ move, journey: j, historias, metricas, ejercicios });
  }

  // Cadena nextJourneyId despues del cambio.
  const nivelTras = async (id: string | null) => {
    if (!id) return null;
    const m = MOVES.find((x) => x.id === id);
    if (m) return m.to;
    const o = await p.journey.findUnique({ where: { id }, select: { levels: true } });
    return o?.levels[0] ?? "?";
  };

  console.log(`| Journey | Nivel | Historias | Métricas de usuario que cambian | Ejercicios (cefr) | Siguiente journey tras el cambio |`);
  console.log(`|---|---|---|---|---|---|`);
  for (const x of plan) {
    const sig = x.journey.nextJourneyId ? `${x.journey.nextJourneyId} (${x.move.to} -> ${await nivelTras(x.journey.nextJourneyId)})` : "-";
    console.log(`| ${x.move.label} | ${x.move.from} -> ${x.move.to} | ${x.historias} | ${x.metricas.length} | ${x.ejercicios} | ${sig} |`);
  }
  const quienApunta = await p.journey.findMany({ where: { nextJourneyId: { in: [...movingIds] } }, select: { id: true, name: true, language: true, variant: true, levels: true, nextJourneyId: true } });
  for (const q of quienApunta) console.log(`apunta aqui: ${q.language} ${q.name} ${q.variant} ${q.levels} -> ${q.nextJourneyId} (que pasa a ${MOVES.find((m) => m.id === q.nextJourneyId)?.to})`);

  if (problemas.length) { console.log(`\nPROBLEMAS (${problemas.length}), nada escrito:`); problemas.forEach((x) => console.log(" - " + x)); process.exit(1); }

  const deshacer = plan.map((x) => ({ journeyId: x.move.id, from: x.move.from, to: x.move.to, metricas: x.metricas.map((m) => ({ id: m.id, storySlug: m.storySlug, metadata: m.metadata })) }));
  fs.writeFileSync(undoPath, JSON.stringify(deshacer, null, 1));
  console.log(`\nregistro para deshacer: ${undoPath}`);
  if (!aplicar) { console.log("EN SECO: no se ha escrito nada. Repetir con --aplicar."); return; }

  await p.$transaction(async (tx) => {
    for (const x of plan) {
      await tx.journey.update({ where: { id: x.move.id }, data: { levels: [x.move.to] } });
      await tx.journeyStory.updateMany({ where: { journeyId: x.move.id, level: x.move.from }, data: { level: x.move.to } });
      for (const m of x.metricas) await tx.userMetric.update({ where: { id: m.id }, data: { storySlug: m.nuevoSlug, metadata: (m.nuevaMeta ?? undefined) as any } });
      // StoryPracticeExercise.cefr NO se toca: esta null en todo el catalogo y nadie
      // lo lee. La primera pasada lo relleno y hubo que devolverlo a null.
    }
  }, { timeout: 120_000 });
  console.log("APLICADO.");
}
main().finally(() => p.$disconnect());
