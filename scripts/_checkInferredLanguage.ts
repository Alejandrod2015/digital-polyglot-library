// Comprueba, contra la base real, a cuántas altas sin idioma declarado les
// podemos deducir uno por lo que abrieron. Sólo lee.
//   npx tsx scripts/_checkInferredLanguage.ts
import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();

import { canonicalLanguageName as toName } from "../src/lib/languageNames";

async function main() {
  const since = new Date(Date.now() - 30 * 86400000);
  const events = await p.userMetric.findMany({
    where: {
      createdAt: { gte: since },
      eventType: { in: ["story_opened", "audio_play", "audio_complete", "audio_pause", "continue_listening"] },
    },
    select: { userId: true, storySlug: true },
  });
  const resume = await p.continueListeningEntry.findMany({
    where: { lastPlayedAt: { gte: since } },
    select: { userId: true, storySlug: true },
  });

  const byUser = new Map<string, Set<string>>();
  for (const r of [...events, ...resume]) {
    if (!r.storySlug) continue;
    const s = byUser.get(r.userId) ?? new Set<string>();
    s.add(r.storySlug);
    byUser.set(r.userId, s);
  }
  const slugs = Array.from(new Set(Array.from(byUser.values()).flatMap((s) => Array.from(s))));

  const [cat, jou, sta, usr] = await Promise.all([
    p.catalogStory.findMany({ where: { slug: { in: slugs } }, select: { slug: true, language: true, book: { select: { language: true } } } }),
    p.journeyStory.findMany({ where: { slug: { in: slugs } }, select: { slug: true, journey: { select: { language: true } } } }),
    p.standaloneStory.findMany({ where: { OR: [{ slug: { in: slugs } }, { id: { in: slugs } }] }, select: { id: true, slug: true, language: true } }),
    p.userStory.findMany({ where: { slug: { in: slugs } }, select: { slug: true, language: true } }),
  ]);
  const lang = new Map<string, string>();
  const put = (s: string | null, l?: string | null) => {
    const n = toName(l);
    if (s && n && !lang.has(s)) lang.set(s, n);
  };
  for (const r of cat) put(r.slug, r.language ?? r.book?.language);
  for (const r of jou) put(r.slug, r.journey?.language);
  for (const r of sta) { put(r.slug, r.language); put(r.id, r.language); }
  for (const r of usr) put(r.slug, r.language);

  console.log(`usuarios con actividad en 30d: ${byUser.size}`);
  console.log(`slugs distintos: ${slugs.length} · con idioma resuelto: ${lang.size}\n`);

  let conIdioma = 0;
  for (const [userId, set] of byUser) {
    const langs = Array.from(new Set(Array.from(set).map((s) => lang.get(s)).filter(Boolean))) as string[];
    if (langs.length) conIdioma += 1;
    console.log(`  ${userId.slice(0, 22).padEnd(22)} ${set.size} historias → ${langs.join("/") || "(sin resolver)"}`);
  }
  console.log(`\n→ a ${conIdioma} de ${byUser.size} se les puede deducir el idioma`);
}

main().finally(() => p.$disconnect());
