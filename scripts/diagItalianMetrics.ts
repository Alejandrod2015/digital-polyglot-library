import { config } from "dotenv";
import { PrismaClient } from "/Users/alejandrodelcarpio/digital-polyglot-library/src/generated/prisma";

config({ path: "/Users/alejandrodelcarpio/digital-polyglot-library/.env" });

const prisma = new PrismaClient();
const userId = "user_33kGTw6oo7WW2spchkl7y52txtK";

async function main() {
  // 1. UserMetric rows that count toward audioFinished
  const completion = await prisma.userMetric.findMany({
    where: { userId, eventType: { in: ["audio_complete", "continue_listening"] } },
    select: { id: true, eventType: true, storySlug: true, bookSlug: true, value: true, metadata: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(`audio_complete + continue_listening rows: ${completion.length}`);
  for (const r of completion.slice(0, 30)) {
    const meta = r.metadata as any;
    const progressKey = meta?.progressKey || (r.bookSlug && r.bookSlug !== "polyglot" ? `${r.bookSlug}:${r.storySlug}` : `(none):${r.storySlug}`);
    const progressSec = meta?.progressSec;
    const audioDurationSec = meta?.audioDurationSec;
    console.log(`  ${r.createdAt.toISOString()}  ${r.eventType.padEnd(20)} pk=${progressKey}  ${progressSec ?? "?"}/${audioDurationSec ?? "?"}s`);
  }

  // 2. All Italian story slugs to filter
  const italianSlugs = await prisma.journeyStory.findMany({
    where: { journey: { language: { equals: "italian", mode: "insensitive" } }, slug: { not: null } },
    select: { slug: true },
  });
  const italianSlugSet = new Set(italianSlugs.map(r => r.slug?.trim()).filter(Boolean) as string[]);
  console.log(`\nItalian story slugs: ${italianSlugSet.size}`);

  // 3. Filter to italian-only
  const italian = completion.filter(r => r.storySlug && italianSlugSet.has(r.storySlug));
  console.log(`audio_complete + continue_listening for italian stories: ${italian.length}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
