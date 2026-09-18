// Solo lectura. Cuantos usuarios guardan palabras y practican, sobre los que
// leen historias. Excluye cuentas internas via getInternalUserIds().
import { PrismaClient } from "../src/generated/prisma";
import { createClerkClient } from "@clerk/backend";
const isInternalDomain = (e: string) => e.endsWith("@digitalpolyglot.com"); // copia de src/lib/internalAccounts.ts (server-only)
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const prisma = new PrismaClient();

// Misma definicion que getInternalUserIds() (src/lib/metricsAccess.ts), que
// no se puede importar desde un script porque arrastra `server-only`.
async function getInternalUserIds(): Promise<string[]> {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const members = await prisma.studioMember.findMany({ select: { email: true } });
  const extra = (process.env.METRICS_INTERNAL_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const emails = new Set([...members.map((m) => m.email.trim().toLowerCase()), ...extra]);
  const ids = new Set<string>();
  let offset = 0;
  for (;;) {
    const page = await clerk.users.getUserList({ limit: 100, offset });
    for (const u of page.data) {
      const meta = (u.publicMetadata ?? {}) as Record<string, unknown>;
      const mails = u.emailAddresses.map((e) => e.emailAddress.toLowerCase());
      if (meta.analyticsExcluded === true || mails.some((m) => emails.has(m) || isInternalDomain(m))) ids.add(u.id);
    }
    if (page.data.length < 100) break;
    offset += 100;
  }
  return [...ids];
}

async function main() {
  const internal = new Set(await getInternalUserIds());
  const ext = (id: string) => !internal.has(id);

  // Lectores: usuarios con al menos una historia completada (audio_complete o
  // journey_story_read), y cuantas historias distintas.
  const reads = await prisma.userMetric.groupBy({
    by: ["userId", "storySlug"],
    where: { eventType: { in: ["audio_complete", "journey_story_read"] } },
  });
  const storiesByUser = new Map<string, Set<string>>();
  for (const r of reads) {
    if (!ext(r.userId)) continue;
    if (!storiesByUser.has(r.userId)) storiesByUser.set(r.userId, new Set());
    storiesByUser.get(r.userId)!.add(r.storySlug);
  }
  const opened = await prisma.userMetric.groupBy({ by: ["userId"], where: { eventType: "story_opened" } });
  const openers = new Set(opened.map((o) => o.userId).filter(ext));

  const favs = await prisma.favorite.groupBy({ by: ["userId"], _count: { _all: true } });
  const favByUser = new Map(favs.filter((f) => ext(f.userId)).map((f) => [f.userId, f._count._all]));
  const favStories = await prisma.favorite.groupBy({ by: ["userId", "storySlug"] });
  const favStoriesByUser = new Map<string, number>();
  for (const f of favStories) if (ext(f.userId)) favStoriesByUser.set(f.userId, (favStoriesByUser.get(f.userId) ?? 0) + 1);

  const practice = await prisma.userMetric.findMany({
    where: { eventType: { in: ["practice_session_started", "practice_session_completed"] } },
    select: { userId: true, eventType: true, metadata: true },
  });
  const bySource: Record<string, Set<string>> = {};
  const sessionsByUser = new Map<string, number>();
  let started = 0, completed = 0;
  for (const p of practice) {
    if (!ext(p.userId)) continue;
    const src = String((p.metadata as any)?.source ?? "unknown");
    if (p.eventType === "practice_session_started") {
      started++;
      sessionsByUser.set(p.userId, (sessionsByUser.get(p.userId) ?? 0) + 1);
      (bySource[src] ??= new Set()).add(p.userId);
    } else completed++;
  }

  const readers = [...storiesByUser.keys()];
  const savers = readers.filter((u) => favByUser.has(u));
  const practicers = readers.filter((u) => sessionsByUser.has(u));
  const hubPracticers = readers.filter((u) => bySource["mobile_practice"]?.has(u));
  const totalStories = readers.reduce((a, u) => a + storiesByUser.get(u)!.size, 0);
  const totalFavs = readers.reduce((a, u) => a + (favByUser.get(u) ?? 0), 0);
  const totalFavStories = readers.reduce((a, u) => a + (favStoriesByUser.get(u) ?? 0), 0);
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "-");

  console.log("| Metrica | Valor |");
  console.log("|---|---|");
  console.log(`| Usuarios externos que abrieron una historia | ${openers.size} |`);
  console.log(`| ... que terminaron al menos una (lectores) | ${readers.length} |`);
  console.log(`| Historias terminadas (distintas por usuario, suma) | ${totalStories} |`);
  console.log(`| Lectores que guardaron alguna palabra | ${savers.length} (${pct(savers.length, readers.length)}) |`);
  console.log(`| Palabras guardadas por los lectores | ${totalFavs} |`);
  console.log(`| Palabras guardadas por historia terminada | ${(totalFavs / Math.max(1, totalStories)).toFixed(2)} |`);
  console.log(`| Historias terminadas con alguna palabra guardada | ${pct(totalFavStories, totalStories)} |`);
  console.log(`| Lectores con alguna sesion de practica (cualquier puerta) | ${practicers.length} (${pct(practicers.length, readers.length)}) |`);
  console.log(`| Lectores que practicaron desde el HUB (mobile_practice) | ${hubPracticers.length} (${pct(hubPracticers.length, readers.length)}) |`);
  for (const [src, users] of Object.entries(bySource)) console.log(`| Usuarios con sesion desde \`${src}\` | ${[...users].filter((u) => storiesByUser.has(u)).length} |`);
  console.log(`| Sesiones iniciadas / completadas | ${started} / ${completed} (${pct(completed, started)}) |`);
  console.log(`| Sesiones por practicante | ${(started / Math.max(1, sessionsByUser.size)).toFixed(1)} |`);
  const favCounts = savers.map((u) => favByUser.get(u)!).sort((a, b) => a - b);
  const median = favCounts[Math.floor(favCounts.length / 2)] ?? 0;
  const top5 = favCounts.slice(-5).reduce((a, b) => a + b, 0);
  console.log(`| Palabras guardadas por lector que guarda: mediana / top 5 suman | ${median} / ${top5} de ${totalFavs} |`);
  console.log(`| Lectores que guardan 1-5 / 6-20 / >20 palabras | ${favCounts.filter((n) => n <= 5).length} / ${favCounts.filter((n) => n > 5 && n <= 20).length} / ${favCounts.filter((n) => n > 20).length} |`);
  console.log(`| Practicantes del HUB que ademas guardan palabras | ${hubPracticers.filter((u) => favByUser.has(u)).length} de ${hubPracticers.length} |`);
  console.log(`| Lectores que NO guardan nada y practican solo al fin de historia | ${readers.filter((u) => !favByUser.has(u) && bySource["mobile_story_practice"]?.has(u)).length} |`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
