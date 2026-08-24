/**
 * Tabla de feedback de la beta, con todo lo necesario para actuar sobre cada
 * fila SIN volver a la base a mano.
 *
 *   npx tsx scripts/feedbackTable.ts            # todas las filas
 *   npx tsx scripts/feedbackTable.ts --status new
 *   npx tsx scripts/feedbackTable.ts --kind bug
 *
 * Por qué existe: el mensaje de un tester no se puede triar solo. "Las mismas
 * historias volvían" no dice nada hasta que ves que ese tester es principiante,
 * que abrió dos historias C1 y que nunca terminó un audio. Las tres cosas viven
 * en tres tablas distintas (`BetaFeedback`, `BetaSignup`, `UserMetric`), así que
 * la tabla las junta: perfil declarado + lo que el mensaje dice + lo que la
 * telemetría dice que hizo de verdad.
 *
 * El diagnóstico de cada fila se guarda en `BetaFeedback.adminNotes`, para que
 * la tabla se regenere con él y no viva solo en un chat.
 */
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

/** Eventos que cuentan como "terminó el audio" (misma regla que journeyProgress). */
const AUDIO_DONE = ["audio_complete", "continue_listening_progress"];

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function cell(value: unknown): string {
  const text = value === null || value === undefined || value === "" ? "-" : String(value);
  return text.replace(/\r?\n/g, " / ").replace(/\|/g, "\\|").trim();
}

async function main() {
  const status = arg("status");
  const kind = arg("kind");

  const rows = await prisma.betaFeedback.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(kind ? { kind } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      signup: {
        select: {
          firstName: true,
          email: true,
          targetLanguage: true,
          targetVariant: true,
          currentLevel: true,
          platform: true,
          clerkUserId: true,
          motivation: true,
          applicationReason: true,
        },
      },
      release: { select: { version: true } },
    },
  });

  const userIds = rows
    .map((row) => row.signup?.clerkUserId)
    .filter((id): id is string => Boolean(id));

  const metrics = userIds.length
    ? await prisma.userMetric.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, eventType: true, storySlug: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // Slug de historia -> journey (idioma, variante, nivel). Es la pieza que
  // convierte "abrió tal historia" en "estaba leyendo un C1".
  const journeyBySlug = new Map<string, string>();
  const journeyStories = await prisma.journeyStory.findMany({
    select: { slug: true, journey: { select: { name: true, variant: true, levels: true } } },
  });
  for (const story of journeyStories) {
    if (!story.slug) continue;
    const level = (story.journey.levels ?? []).join("/").toUpperCase();
    journeyBySlug.set(story.slug, `${story.journey.name} ${story.journey.variant} ${level}`);
  }

  const usoPorUsuario = new Map<string, string>();
  for (const userId of new Set(userIds)) {
    const míos = metrics.filter((metric) => metric.userId === userId);
    const abiertas = míos.filter((metric) => metric.eventType === "story_opened");
    const audios = míos.filter((metric) => AUDIO_DONE.includes(metric.eventType));
    const prácticas = míos.filter((metric) => metric.eventType === "practice_session_completed");
    const últimas = Array.from(new Set(abiertas.map((metric) => metric.storySlug ?? "?")))
      .slice(-3)
      .map((slug) => `${slug}${journeyBySlug.has(slug) ? ` (${journeyBySlug.get(slug)})` : ""}`);
    usoPorUsuario.set(
      userId,
      [
        `${abiertas.length} abiertas`,
        `${audios.length} audios terminados`,
        `${prácticas.length} prácticas`,
        últimas.length ? `últimas: ${últimas.join("; ")}` : "sin lecturas",
      ].join(" · ")
    );
  }

  const header = [
    "Fecha",
    "Tester",
    "Perfil",
    "Tipo",
    "Nota",
    "Qué dice",
    "Qué hizo de verdad",
    "Build",
    "Estado",
    "Diagnóstico",
  ];
  console.log(`| ${header.join(" | ")} |`);
  console.log(`|${header.map(() => "---").join("|")}|`);

  for (const row of rows) {
    const signup = row.signup;
    const uso = signup?.clerkUserId ? usoPorUsuario.get(signup.clerkUserId) : null;
    console.log(
      `| ${[
        cell(row.createdAt.toISOString().slice(0, 10)),
        cell(`${signup?.firstName ?? "?"}<br>${row.email}`),
        cell(
          [
            signup?.targetLanguage,
            signup?.targetVariant,
            signup?.currentLevel,
            signup?.platform,
          ]
            .filter(Boolean)
            .join(" · ")
        ),
        cell(row.kind),
        cell(row.rating === null ? "-" : `${row.rating}/10`),
        cell(row.message),
        cell(uso ?? "sin telemetría (no hay clerkUserId)"),
        cell(
          [row.platform, row.appVersion, row.buildNumber, row.screen].filter(Boolean).join(" · ")
        ),
        cell(row.release ? `${row.status} (${row.release.version})` : row.status),
        cell(row.adminNotes),
      ].join(" | ")} |`
    );
  }

  console.log(`\n${rows.length} filas.`);
  await prisma.$disconnect();
}

main();
