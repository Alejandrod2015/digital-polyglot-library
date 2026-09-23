/**
 * RADAR DE LANZAMIENTO: los numeros de una build, listos para el tablero.
 *
 * Tablero (artifact, una ficha por lanzamiento):
 *   https://claude.ai/artifact/NfRCTbVPwQ8c1SpaqTcTgU
 *
 *   npx tsx scripts/launchRadar.ts --desde 2026-09-21T11:00:00Z \
 *     --ios 340 --android 28 --abiertos 54 --entregados 46 --suprimidos 1 \
 *     --journeys-desde 2026-09-15
 *
 * Imprime dos cosas: un resumen legible y el JSON exacto de la ficha, para
 * escribirlo en la coleccion `releases` del tablero con el id de la fecha.
 *
 * POR QUE EXISTE: el 2026-09-23 estos numeros se sacaron con cuatro consultas
 * improvisadas y no quedo ni una en el repo. Lo que se repite cada semana no
 * se hace a mano.
 *
 * LO QUE NO HACE, A PROPOSITO:
 * - No pregunta a Resend, y no nombra su dominio ni en un comentario: los
 *   guards leen el CONTENIDO del .ts que invocas, asi que nombrarlo aqui
 *   bloquearia este script, que no envia nada. Las aperturas se sacan con
 *   `scripts/launchRadarOpens.ts` (lo corre el usuario) y entran aqui por
 *   `--abiertos`.
 * - No compone la tabla de journeys. Imprime el comando
 *   `journeysTable.ts --ids ...` con los journeys nacidos en la ventana:
 *   sus filas se pegan TAL CUAL. Componer una tabla de journeys a mano esta
 *   prohibido (ver "Pedir una vez" en .claude/CLAUDE.md).
 * - No cuenta journeys archivados. Solo live y draft, regla dura.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

const arg = (n: string): string | undefined => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
};
const num = (n: string): number | undefined => {
  const v = arg(n);
  return v === undefined ? undefined : Number(v);
};

/** Personas de esa plataforma vistas desde el lanzamiento con la build N o mas
 *  nueva, sobre las activas en los 14 dias previos: el denominador honesto es
 *  quien usa la app, no quien se apunto alguna vez. */
async function adopcion(desde: Date, plataforma: string, build: number) {
  const filas = await p.mobileDevice.findMany({
    where: { platform: plataforma },
    select: { userId: true, buildNumber: true, lastSeenAt: true },
  });
  const base = new Date(desde.getTime() - 14 * 24 * 3600 * 1000);
  const activos = new Set(filas.filter((f) => f.lastSeenAt >= base).map((f) => f.userId));
  const puestos = new Set(
    filas
      .filter((f) => f.lastSeenAt >= desde && Number(f.buildNumber) >= build)
      .map((f) => f.userId),
  );
  return { adopted: puestos.size, activeBase: activos.size };
}

(async () => {
  const desde = new Date(arg("desde") ?? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());
  const ios = num("ios");
  const android = num("android");
  const ventanaJourneys = new Date(arg("journeys-desde") ?? new Date(desde.getTime() - 7 * 24 * 3600 * 1000).toISOString());

  // La ventana de journeys llega al FINAL del dia del lanzamiento: uno creado
  // esa misma tarde pertenece a esa semana, no a la siguiente.
  const finDia = new Date(`${desde.toISOString().slice(0, 10)}T23:59:59Z`);

  const platforms: Array<{ name: string; build: string; adopted: number; activeBase: number }> = [];
  if (ios !== undefined) platforms.push({ name: "iOS", build: String(ios), ...(await adopcion(desde, "ios", ios)) });
  if (android !== undefined) platforms.push({ name: "Android", build: String(android), ...(await adopcion(desde, "android", android)) });

  // Eventos desde el lanzamiento: personas unicas por tipo, que es lo que
  // cuenta; los eventos sueltos los infla una sola persona insistente.
  const ev = await p.userMetric.findMany({
    where: { createdAt: { gte: desde } },
    select: { userId: true, eventType: true, metadata: true },
  });
  const personas = new Map<string, Set<string>>();
  const eventos = new Map<string, number>();
  for (const e of ev) {
    if (!personas.has(e.eventType)) personas.set(e.eventType, new Set());
    personas.get(e.eventType)!.add(e.userId);
    eventos.set(e.eventType, (eventos.get(e.eventType) ?? 0) + 1);
  }
  // Speaking solo tiene eventos de FRACASO (`speaking_skipped_*`). El uso real
  // esta en el modo de la sesion de practica, no en un evento propio.
  const speaking = ev.filter(
    (e) => e.eventType === "practice_session_completed" && (e.metadata as { mode?: string } | null)?.mode === "speaking",
  );
  const saltos = ev.filter((e) => e.eventType.startsWith("speaking_skipped"));

  // Solo el tipo del boletin: `BetaEmailLog` guarda tambien los de ciclo de
  // vida, y contarlos todos inflaba el denominador del embudo (192 en vez de
  // los 101 del boletin del 21 de septiembre).
  const correos = await p.betaEmailLog.count({
    where: { kind: arg("kind") ?? "improvement", sentAt: { gte: new Date(desde.getTime() - 24 * 3600 * 1000) } },
  });
  const sent = num("escritos") ?? correos;
  const opened = num("abiertos");

  const fb = await p.betaFeedback.findMany({
    where: { createdAt: { gte: desde } },
    select: { createdAt: true, platform: true, kind: true, rating: true, message: true },
    orderBy: { createdAt: "asc" },
  });

  // Journeys NACIDOS en la ventana. Solo live y draft: los archivados no se
  // mencionan ni se cuentan.
  const js = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] }, createdAt: { gte: ventanaJourneys, lte: finDia } },
    select: { id: true, status: true, language: true, variant: true, typeSlug: true, levels: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const ficha = {
    date: desde.toISOString().slice(0, 10),
    measuredAt: new Date().toISOString().slice(0, 10),
    funnel: {
      mailed: sent,
      opened,
      updated: platforms.reduce((a, b) => a + b.adopted, 0),
      usedHeadline: new Set(speaking.map((e) => e.userId)).size,
    },
    platforms,
    email: { sent, opened, delivered: num("entregados"), suppressed: num("suprimidos"), bounced: num("rebotes") ?? 0 },
    features: [...personas.entries()]
      .sort((a, b) => b[1].size - a[1].size)
      .map(([tipo, gente]) => ({ name: tipo, source: tipo, people: gente.size, events: eventos.get(tipo) })),
    feedback: fb.map((f) => ({
      when: f.createdAt.toISOString().slice(5, 10),
      platform: f.platform,
      rating: f.rating,
      text: f.message.replace(/\s+/g, " ").slice(0, 160),
    })),
    gaps: [] as string[],
  };

  console.log(`\n== Lanzamiento del ${ficha.date} (medido el ${ficha.measuredAt}) ==`);
  for (const pl of platforms) {
    console.log(`${pl.name} >= ${pl.build}: ${pl.adopted} de ${pl.activeBase} activos de los 14 dias previos`);
  }
  console.log(`Boletin: ${sent} escritos, ${opened ?? "?"} abiertos (las aperturas entran por --abiertos)`);
  console.log(`Speaking: ${speaking.length} sesiones completas contra ${saltos.length} saltos`);
  console.log(`Feedback nuevo: ${fb.length}`);

  console.log(`\n-- journeys nacidos entre ${ventanaJourneys.toISOString().slice(0, 10)} y ${ficha.date} (live + draft): ${js.length}`);
  for (const j of js) {
    console.log(`   ${j.status.padEnd(6)} ${j.language}/${j.variant} ${j.typeSlug ?? "-"} ${JSON.stringify(j.levels)}`);
  }
  if (js.length) {
    console.log(`\n   Las filas del tablero se pegan TAL CUAL de:`);
    console.log(`   npx tsx scripts/journeysTable.ts --ids ${js.map((j) => j.id).join(",")}`);
  }

  console.log(`\n-- ficha para la coleccion "releases" (doc_id = ${ficha.date}), repasa reading/basis/gaps antes de escribirla:`);
  console.log(JSON.stringify(ficha, null, 2));
  await p.$disconnect();
})();
