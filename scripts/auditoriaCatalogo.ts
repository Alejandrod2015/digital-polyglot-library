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
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const SOLO_LIBRES = process.argv.includes("--libres");

type Fila = {
  estado: string; etiqueta: string;
  hist: number; texto: number; temas: number;
  ej: number; glosas: number; portadas: number; audio: number;
  fase: string;
};

function fase(f: Omit<Fila, "fase" | "estado" | "etiqueta">, live: boolean): string {
  if (live) return "publicado";
  if (f.texto < 21) return "1-texto";
  if (f.ej === 0) return "2-practica";
  if (f.portadas === 0) return "3-portadas";
  if (f.audio < 21) return "4-audio";
  return "5-publicar";
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
      SELECT count(ex.id)::int ej
      FROM "dp_journey_stories_v1" st
      LEFT JOIN "dp_story_practice_sets_v1" ps ON ps."storyId" = st.id
      LEFT JOIN "dp_story_practice_exercises_v1" ex ON ex."setId" = ps.id
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

    const base = {
      hist: s[0].n, texto: s[0].texto, temas: (j.topics ?? []).length,
      ej: e[0].ej, glosas: g[0].bundles, portadas: s[0].portadas, audio: s[0].audio,
    };
    const live = j.status === "active";
    filas.push({
      estado: live ? "LIVE" : "draft",
      etiqueta: `${j.language}/${j.variant} ${j.typeSlug ?? j.name} ${(j.levels ?? []).join("/")}`,
      ...base, fase: fase(base, live),
    });
  }

  const mostrar = SOLO_LIBRES ? filas.filter((f) => f.estado === "draft" && f.audio < 21) : filas;
  console.log("| Estado | Journey | Texto | Temas | Ejerc. | Glosas | Portadas | Audio | Fase |");
  console.log("|---|---|---|---|---|---|---|---|---|");
  for (const f of mostrar) {
    console.log(`| ${f.estado} | ${f.etiqueta} | ${f.texto}/21 | ${f.temas} | ${f.ej} | ${f.glosas} | ${f.portadas}/21 | ${f.audio}/21 | ${f.fase} |`);
  }
  console.log(`\n${mostrar.length} journeys (los archivados quedan fuera).`);
  console.log("Fase = el primer paso de la cadena que aun no esta hecho. Ver project_journey_pipeline_five_phases.");
  await prisma.$disconnect();
}

run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
