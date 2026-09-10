/** SOLO LECTURA. Glosas de lugares en los bundles PT y frases de los ordinales ambiguos del a2. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";
const p = new PrismaClient();
const LUG = ["salvador", "recife", "campo", "grande", "porto", "alegre", "gramado", "petrópolis", "jericoacoara", "lençóis", "aquidauana", "noronha", "paraty", "curitiba", "brasília", "bonito", "belém", "manaus", "olinda", "fortaleza"];
(async () => {
  const gs = await p.tapGlossSet.findMany({ where: { slug: "", bundle: { startsWith: "portuguese" } }, select: { bundle: true, slugs: true, glosses: true } });
  for (const g of gs.sort((a, b) => a.bundle.localeCompare(b.bundle))) {
    const m = g.glosses as Record<string, { g?: string; t?: string }>;
    console.log(`== ${g.bundle}: ` + LUG.filter((l) => m[l]).map((l) => `${l}="${m[l].g}"(${m[l].t})`).join(" | "));
    if (g.bundle.endsWith("-a2") || g.bundle.endsWith("-a0")) {
      const st = await p.journeyStory.findMany({ where: { slug: { in: g.slugs } }, select: { slug: true, text: true } });
      for (const s of st) for (const frase of extractStoryPlainText(s.text ?? "").split(/(?<=[.!?”])\s+/))
        if (/\b(meia|quarta|quinta|oitava)\b/i.test(frase)) console.log(`   ${s.slug}: ${frase.trim().slice(0, 120)}`);
    }
  }
})().finally(() => p.$disconnect());
