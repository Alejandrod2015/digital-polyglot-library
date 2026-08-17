import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const JOURNEY_ID = "cmqc6tojm000032el2ebwsgkn";

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();
}
// very common filler n-grams to ignore
const STOP = new Set(["de la","en la","que se","lo que","de lo","la que","a la","que no","que te","de los","con el","con la","por la","el que","de que","y la","y el","mas de lo que","de lo que","lo que parece","mas de lo"]);

async function run() {
  const p = new PrismaClient();
  const stories = await p.journeyStory.findMany({
    where: { journeyId: JOURNEY_ID, status: "generated" },
    select: { slug: true, text: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });

  // 4-gram -> set of slugs
  const grams = new Map<string, Set<string>>();
  for (const s of stories) {
    const words = norm(s.text ?? "").split(" ");
    const seen = new Set<string>();
    for (let i = 0; i + 4 <= words.length; i++) {
      const g = words.slice(i, i + 4).join(" ");
      if (seen.has(g)) continue; seen.add(g);
      if (!grams.has(g)) grams.set(g, new Set());
      grams.get(g)!.add(s.slug);
    }
  }
  console.log("=== 4-gramas que aparecen en 2+ historias distintas ===");
  const hits = [...grams.entries()].filter(([g, set]) => set.size >= 2 && !STOP.has(g))
    .sort((a, b) => b[1].size - a[1].size);
  for (const [g, set] of hits) console.log(`  "${g}"  → ${set.size}: ${[...set].join(", ")}`);
  if (!hits.length) console.log("  (ninguno)");

  // closing line of each story (last dialogue line)
  console.log("\n=== Última línea de diálogo de cada historia (tics de cierre) ===");
  for (const s of stories) {
    const lines = (s.text ?? "").split(/\n+/).filter((l) => /^[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+:\s/.test(l));
    const last = lines[lines.length - 1] ?? "";
    console.log(`  ${s.slug}: ${last.replace(/^[^:]+:\s/, "")}`);
  }
  await p.$disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
