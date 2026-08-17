import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findMany({
    where: { journey: { language: { equals: "portuguese", mode: "insensitive" } }, status: "published" },
    select: { slug: true, title: true, text: true, audioUrl: true, audioSegments: true },
  });
  for (const needle of ["De frente para a janela", "atravessa a areia"]) {
    console.log(`\n═══ "${needle}"`);
    for (const x of s) {
      if (!x.text?.includes(needle)) continue;
      console.log(`  historia: ${x.title} (${x.slug})`);
      const idx = x.text.indexOf(needle);
      console.log(`  contexto: …${x.text.slice(Math.max(0, idx - 160), idx + 220).replace(/\n/g, " ⏎ ")}…`);
      const segs = (x.audioSegments as unknown as Array<{ text?: string; start?: number; end?: number }> | null) ?? [];
      console.log(`  segmentos de audio: ${segs.length}`);
      segs.forEach((sg, i) => {
        if (sg.text && (sg.text.includes(needle) || (i > 0 && segs[i - 1]?.text?.includes(needle)))) {
          console.log(`     [${i}] ${sg.start ?? "?"}-${sg.end ?? "?"}s :: ${sg.text.slice(0, 90)}`);
        }
      });
    }
  }
})().finally(() => p.$disconnect());
