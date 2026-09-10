import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";
const p = new PrismaClient();
(async () => {
  const grupos: [string, { language: string; variant: string; levels: string[] }][] = [
    ["ES Spain B1", { language: "spanish", variant: "spain", levels: ["b1"] }],
    ["ES Latam B1", { language: "spanish", variant: "latam", levels: ["b1"] }],
    ["ES Spain B2", { language: "spanish", variant: "spain", levels: ["b2"] }],
    ["ES Latam B2", { language: "spanish", variant: "latam", levels: ["b2"] }],
    ["PT Brazil B1", { language: "portuguese", variant: "brazil", levels: ["b1"] }],
  ];
  let total = 0;
  for (const [n, w] of grupos) {
    const st = await p.journeyStory.findMany({
      where: { journey: { name: "Traveler", language: w.language, variant: w.variant, levels: { has: w.levels[0] }, status: { not: "archived" } } },
      select: { title: true, text: true, audioUrl: true },
    });
    const chars = st.reduce((a, s) => a + (s.title ?? "").length + extractStoryPlainText(String(s.text ?? "")).length, 0);
    const con = st.filter((s) => (s.audioUrl ?? "").trim()).length;
    total += chars;
    console.log(`${n}: ${st.length} historias · ${chars.toLocaleString()} chars · ya narradas ${con}`);
  }
  console.log(`TOTAL escrito: ${total.toLocaleString()} chars`);
  await p.$disconnect();
})();
