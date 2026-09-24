/**
 * Auditoria del catalogo: en que fase real esta cada journey vivo o en borrador.
 *
 *   npx tsx scripts/auditoriaCatalogo.ts
 *   npx tsx scripts/auditoriaCatalogo.ts --libres   (solo los borradores sin audio)
 *
 * Por que existe: el 2026-09-21 recomende tres veces seguidas sobre un estado
 * que no era el real. Lei la columna de historias PUBLICADAS de journeysTable
 * como si fuera las escritas y di por vacios dos borradores que tenian sus 21
 * historias y 400 ejercicios hechos. El dato existia; lo que faltaba era
 * mirarlo. Ninguna recomendacion sobre que journey retomar se hace a ojo: sale
 * de aqui.
 *
 * No sustituye a journeysTable.ts, que es la tabla de ESTADO del catalogo.
 * Esta mide FASE: cuanto le falta a cada journey para publicarse.
 *
 * QUIEN MANDA (2026-09-24): la fase no puede decir "5-publicar" de un journey
 * que `publishJourney.ts` rechaza. Antes lo decia: la columna "Audio" contaba
 * la NARRACION (`audioUrl`) y nadie miraba el audio de PRACTICA, asi que el
 * spanish/mexico relationships a0 salia listo para publicar mientras el gate
 * lo bloqueaba en las 21 historias por falta de `wordClipUrl` y `clipUrl`.
 * Ahora hay dos capas:
 *   1. Columna "Clips": clips de practica que EXIGE el gate contra los que hay
 *      (wordClipUrl en cada `meaning_in_context`, clipUrl en cada `fill_blank`).
 *      Es la misma senal que la columna Clips de journeysTable, en ratio.
 *   2. Confirmacion: todo journey que las cuentas dejarian en "5-publicar" se
 *      pasa por `publishJourney.ts --dry`, que es EL gate. Si el gate bloquea,
 *      la fila dice "5-BLOQUEADO" y se imprime el motivo. La auditoria no
 *      reimplementa el gate: le pregunta. Solo paga ese subproceso (~8 s) el
 *      punado de journeys que estan al final de la cadena.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { execFileSync } from "node:child_process";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const SOLO_LIBRES = process.argv.includes("--libres");

type Fila = {
  id: string;
  estado: string; etiqueta: string;
  hist: number; texto: number; temas: number;
  ej: number; sets: number; glosas: number; portadas: number; audio: number;
  clipsOk: number; clipsReq: number;
  fase: string;
};

type Base = Omit<Fila, "fase" | "estado" | "etiqueta" | "id">;

/**
 * El primer paso de la cadena que aun no esta hecho, medido contra lo que
 * EXIGE publishJourney.ts: las 21 con texto y titulo, set de practica en las
 * 21, portada en las 21, narracion en las 21 y el audio de practica completo.
 * Los umbrales de portadas y de sets eran "> 0" y dejaban pasar un journey a
 * medias; ahora son las 21, como el gate.
 */
function fase(f: Base, live: boolean): string {
  if (live) return "publicado";
  if (f.texto < 21) return "1-texto";
  if (f.ej === 0 || f.sets < 21) return "2-practica";
  if (f.portadas < 21) return "3-portadas";
  if (f.audio < 21) return "4-narracion";
  // 0/0 no es un hueco: si un set no tiene ejercicios de significado ni de
  // hueco, el gate no exige clips. Esos casos caen en la confirmacion.
  if (f.clipsOk < f.clipsReq) return "5-clips";
  return "6-publicar";
}

async function run() {
  const journeys: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, name, language, variant, "typeSlug", levels, topics, status
    FROM "dp_journeys_v1" WHERE status <> 'archived'
    ORDER BY language, variant, levels`);

  const filas: Fila[] = [];
  for (const j of journeys) {
    const s: any[] = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int n,
             count(*) FILTER (WHERE coalesce(text,'') <> '')::int texto,
             count("audioUrl")::int audio,
             count("coverUrl")::int portadas
      FROM "dp_journey_stories_v1" WHERE "journeyId" = $1`, j.id);
    const e: any[] = await prisma.$queryRawUnsafe(`
      SELECT count(ex.id)::int ej,
             count(DISTINCT ps.id)::int sets
      FROM "dp_journey_stories_v1" st
      LEFT JOIN "dp_story_practice_sets_v1" ps ON ps."storyId" = st.id
      LEFT JOIN "dp_story_practice_exercises_v1" ex ON ex."setId" = ps.id
      WHERE st."journeyId" = $1`, j.id);
    // Audio de PRACTICA, la regla literal del gate de publicacion: cada
    // `meaning_in_context` necesita wordClipUrl y cada `fill_blank`, clipUrl.
    // Cuenta TODOS los ejercicios del set, tambien los del pool, igual que el
    // gate; no se filtra por `featured`.
    const c: any[] = await prisma.$queryRawUnsafe(`
      SELECT count(*) FILTER (WHERE ex.type IN ('meaning_in_context','fill_blank'))::int req,
             count(*) FILTER (
               WHERE (ex.type = 'meaning_in_context'
                      AND coalesce(ex.payload->'audioClip'->>'wordClipUrl','') <> '')
                  OR (ex.type = 'fill_blank'
                      AND coalesce(ex.payload->'audioClip'->>'clipUrl','') <> ''))::int ok
      FROM "dp_journey_stories_v1" st
      JOIN "dp_story_practice_sets_v1" ps ON ps."storyId" = st.id
      JOIN "dp_story_practice_exercises_v1" ex ON ex."setId" = ps.id
      WHERE st."journeyId" = $1`, j.id);
    // Las glosas se cuentan por los SLUGS de las historias, no por el nombre del
    // bundle: el bundle se llama como le dio la gana al chat que lo creo, y
    // cruzarlo por nombre da cero en journeys que si tienen glosas.
    const g: any[] = await prisma.$queryRawUnsafe(`
      SELECT count(DISTINCT t.bundle)::int bundles
      FROM "dp_tap_glosses_v1" t
      WHERE EXISTS (
        SELECT 1 FROM "dp_journey_stories_v1" st
        WHERE st."journeyId" = $1 AND st.slug = ANY(t.slugs))`, j.id);

    const base: Base = {
      hist: s[0].n, texto: s[0].texto, temas: (j.topics ?? []).length,
      ej: e[0].ej, sets: e[0].sets, glosas: g[0].bundles,
      portadas: s[0].portadas, audio: s[0].audio,
      clipsOk: c[0].ok, clipsReq: c[0].req,
    };
    const live = j.status === "active";
    filas.push({
      id: j.id,
      estado: live ? "LIVE" : "draft",
      etiqueta: `${j.language}/${j.variant} ${j.typeSlug ?? j.name} ${(j.levels ?? []).join("/")}`,
      ...base, fase: fase(base, live),
    });
  }

  // Confirmacion contra el gate de verdad. Solo los candidatos a publicar.
  const motivos: string[] = [];
  for (const f of filas.filter((x) => x.fase === "6-publicar")) {
    let salida = "";
    let bloquea = false;
    try {
      salida = execFileSync("npx", ["tsx", "scripts/publishJourney.ts", f.id, "--dry"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (err: any) {
      bloquea = true;
      salida = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    }
    if (bloquea) {
      f.fase = "6-BLOQUEADO";
      // El gate imprime "BLOQUEADO (N):" y luego una linea por motivo. Se lee
      // el numero de la cabecera y la primera linea util; el detalle completo
      // sale corriendo el --dry a mano, que es lo que el motivo invita a hacer.
      const n = salida.match(/BLOQUEADO \((\d+)\)/)?.[1] ?? "?";
      const lineas = salida.split("\n").map((l) => l.trim())
        .filter((l) => l.length > 1 && !l.startsWith("journey:") && !l.startsWith("BLOQUEADO"));
      motivos.push(`${f.etiqueta} (${f.id}): el gate lo bloquea en ${n} sitios. ` +
        `Primero: ${lineas[0] ?? "(corre publishJourney.ts --dry para el detalle)"}`);
    }
  }

  const mostrar = SOLO_LIBRES ? filas.filter((f) => f.estado === "draft" && f.audio < 21) : filas;
  console.log("| Estado | Journey | Texto | Temas | Ejerc. | Sets | Glosas | Portadas | Narr | Clips | Fase |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const f of mostrar) {
    console.log(`| ${f.estado} | ${f.etiqueta} | ${f.texto}/21 | ${f.temas} | ${f.ej} | ${f.sets}/21 | ${f.glosas} | ${f.portadas}/21 | ${f.audio}/21 | ${f.clipsOk}/${f.clipsReq} | ${f.fase} |`);
  }
  console.log(`\n${mostrar.length} journeys (los archivados quedan fuera).`);
  console.log("Fase = el primer paso de la cadena que aun no esta hecho. Ver project_journey_pipeline_five_phases.");
  console.log("Narr = narracion de la historia (audioUrl). Clips = audio de practica que hay / que exige el gate.");
  if (motivos.length) {
    console.log("\nLas cuentas los daban por publicables y publishJourney.ts --dry los rechaza:");
    for (const m of motivos) console.log("  - " + m);
  }
  await prisma.$disconnect();
}

run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
