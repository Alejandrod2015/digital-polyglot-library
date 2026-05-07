import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
config({ path: ".env.local" });
config({ path: ".env" });

type Segment = { text: string; voice?: string };

async function main() {
  const prisma = new PrismaClient();

  // Filtrar en JS: el filtro `{ not: undefined }` sobre Json no funciona
  // como esperaríamos en Prisma. Traemos todas las stories y filtramos.
  const allStories = await prisma.journeyStory.findMany({
    select: {
      slug: true,
      title: true,
      voiceId: true,
      dialogueSpec: true,
      audioStatus: true,
      journey: { select: { language: true, variant: true, name: true } },
    },
  });
  const stories = allStories.filter(
    (s) => s.voiceId || (s.dialogueSpec && Array.isArray(s.dialogueSpec) && s.dialogueSpec.length > 0)
  );

  // Map voiceId → { count, languages: Set, variants: Set, sampleStories: string[] }
  type VoiceUsage = {
    count: number;
    languages: Set<string>;
    variants: Set<string>;
    sampleStories: string[];
  };
  const usage = new Map<string, VoiceUsage>();

  function bump(voiceId: string, language: string, variant: string | null, slug: string) {
    let u = usage.get(voiceId);
    if (!u) {
      u = { count: 0, languages: new Set(), variants: new Set(), sampleStories: [] };
      usage.set(voiceId, u);
    }
    u.count += 1;
    if (language) u.languages.add(language);
    if (variant) u.variants.add(variant);
    if (u.sampleStories.length < 3 && !u.sampleStories.includes(slug)) {
      u.sampleStories.push(slug);
    }
  }

  for (const s of stories) {
    const language = (s.journey?.language ?? "?").toLowerCase();
    const variant = s.journey?.variant ?? null;
    if (s.voiceId) bump(s.voiceId, language, variant, s.slug ?? s.title);
    if (Array.isArray(s.dialogueSpec)) {
      for (const seg of s.dialogueSpec as Segment[]) {
        if (seg && typeof seg.voice === "string" && seg.voice.trim()) {
          bump(seg.voice.trim(), language, variant, s.slug ?? s.title);
        }
      }
    }
  }

  const sorted = Array.from(usage.entries()).sort((a, b) => b[1].count - a[1].count);

  console.log(`\n${sorted.length} distinct voiceIds across ${stories.length} stories:\n`);
  for (const [voiceId, u] of sorted) {
    const langs = Array.from(u.languages).join(",");
    const variants = Array.from(u.variants).join(",") || "-";
    const samples = u.sampleStories.join(", ");
    console.log(`  ${voiceId}`);
    console.log(`    count=${u.count}  langs=${langs}  variants=${variants}`);
    console.log(`    e.g.: ${samples}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
