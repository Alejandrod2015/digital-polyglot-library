/** Contextos que ya no existen en el texto de su historia (texto reescrito). */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient(); const B = "spanish-traveler-latam-a2";
const norm = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/[“”„"«»]/g, '"').replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
(async () => {
  const rows = await p.tapGlossSet.findMany({ where: { bundle: B, NOT: { slug: "" } }, select: { slug: true, glosses: true } });
  const st = await p.journeyStory.findMany({ where: { slug: { in: rows.map((r) => r.slug!) } }, select: { slug: true, title: true, text: true } });
  const txt = new Map(st.map((s) => [s.slug!, norm(`${s.title}. ${s.text}`)]));
  let total = 0;
  for (const r of rows) {
    const t = txt.get(r.slug!); if (!t) continue;
    const g = (r.glosses ?? {}) as Record<string, any>;
    const malas = Object.entries(g).filter(([, v]) => v?.c?.es && !t.includes(norm(String(v.c.es))));
    const vivas = Object.keys(g).filter((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "iu").test(t));
    if (malas.length) { total += malas.length; console.log(`${r.slug}: ${malas.length} contextos muertos de ${vivas.length} palabras vivas`); console.log("   " + malas.map(([k]) => k).join(" ")); }
  }
  console.log(`\nTOTAL contextos muertos: ${total}`);
  await p.$disconnect();
})();
