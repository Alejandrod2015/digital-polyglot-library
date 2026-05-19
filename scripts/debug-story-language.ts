// Verifica que resolveStoryLanguageMap devuelva el idioma correcto
// para los slugs que aparecen en el dashboard actual.

import { books } from "@/data/books";
import { prisma } from "@/lib/prisma";
import { getStandaloneStoriesBySlugs } from "@/lib/standaloneStories";

const SLUGS = [
  "dia-de-muertos-el-puente-entre-dos-mundos",
  "il-pranzo-di-famiglia",
  "sonntag-in-prenzlauer-berg",
  "cacio-e-pepe-a-trastevere-2",
  "asado-y-misterio-en-la-costanera",
  "trastevere-al-tramonto",
  "quartieri-spagnoli-pizza-margherita-5",
  "cacio-e-pepe-a-trastevere",
];

function normalize(value: string): string {
  const v = value.trim().toLowerCase();
  if (v.startsWith("es") || v === "spanish") return "es";
  if (v.startsWith("it") || v === "italian" || v === "italiano") return "it";
  if (v.startsWith("de") || v === "german" || v === "deutsch") return "de";
  if (v.startsWith("fr") || v === "french") return "fr";
  if (v.startsWith("pt") || v === "portuguese") return "pt";
  if (v.startsWith("en") || v === "english") return "en";
  return v.slice(0, 2);
}

async function main() {
  const out = new Map<string, string>();
  const slugSet = new Set(SLUGS);

  for (const book of Object.values(books)) {
    const lang = (book as { language?: string }).language;
    if (!lang) continue;
    for (const story of book.stories) {
      if (slugSet.has(story.slug)) {
        out.set(story.slug, normalize(lang));
      }
    }
  }

  const unresolved = SLUGS.filter((s) => !out.has(s));
  const [userStories, standaloneStories] = await Promise.all([
    prisma.userStory.findMany({
      where: { slug: { in: unresolved } },
      select: { slug: true, language: true },
    }),
    getStandaloneStoriesBySlugs(unresolved),
  ]);

  for (const s of userStories) {
    if (s.language) out.set(s.slug, normalize(s.language));
  }
  for (const s of standaloneStories) {
    const lang = (s as { language?: string | null }).language;
    if (lang && !out.has(s.slug)) out.set(s.slug, normalize(lang));
  }

  console.log("\n== Resolución de idioma por slug ==");
  for (const slug of SLUGS) {
    const lang = out.get(slug) ?? "(no resuelto)";
    console.log(`  ${slug.padEnd(50)} -> ${lang}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
