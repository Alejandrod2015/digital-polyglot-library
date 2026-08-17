import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

async function run() {
  const js = await prisma.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    include: { stories: { select: { status: true, audioUrl: true } } },
  });
  for (const j of js) {
    const a = j as unknown as Record<string, unknown>;
    const pub = j.stories.filter((s) => s.status === "published");
    const withAudio = pub.filter((s) => s.audioUrl).length;
    console.log(
      [
        (a.status as string).padEnd(7),
        String(a.id).padEnd(26),
        String(a.language ?? a.languageCode ?? "?").padEnd(4),
        String(a.variant ?? "-").padEnd(8),
        JSON.stringify(a.levels).padEnd(10),
        String(a.name ?? a.title ?? a.slug ?? "?").padEnd(34),
        `pub=${pub.length}/${j.stories.length} audio=${withAudio}`,
      ].join("  "),
    );
  }
  console.log("\ncampos de Journey:", Object.keys(js[0] ?? {}).join(", "));
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
