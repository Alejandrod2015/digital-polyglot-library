/**
 * Recuento del daño (2026-08-19): qué temas YA escritos se sostenían solo con
 * un valor enlatado del desplegable. Solo LEE: no escribe nada.
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true }); config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { isCannedMotivation } from "../src/lib/betaMotivations";

const prisma = new PrismaClient();
const MIN_WORDS = 3, MIN_CHARS = 15;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const short = (q: string) => norm(q).length < MIN_CHARS || norm(q).split(" ").filter(Boolean).length < MIN_WORDS;

// Las dos únicas tandas de temas que pasaron por el portón, con la evidencia
// que se les pasó (scripts/_renameA1Topics.ts y scripts/_scaffoldPtBrA1.ts).
const BATCHES: Array<{ lang: string; script: string; topics: Record<string, string[]> }> = [
  { lang: "spanish", script: "scripts/_renameA1Topics.ts", topics: {
    "Neighbours & Favours": ["Holiday home in Spain and I wish to talk to neighbours"],
    "Bars & Tapas": ["Travel", "Just for fun"],
    "Plans & Invitations": ["Just for fun", "A more fun and interactive method of learning a new language"],
    "Timetables & Meal Times": ["Travel", "Will be interesting to learn in an app which looks enjoyable"],
    "Family & Relatives": ["Family connection", "Improve my basic language and make my brain work"],
    "Health & Symptoms": ["Travel", "I want to see how this will help me learn to speak Spanish"],
    "Festivals & Traditions": ["Just for fun", "Travel"],
  } },
  { lang: "portuguese", script: "scripts/_scaffoldPtBrA1.ts", topics: {
    "River & Rainforest": ["travel"], "Surf & Dunes": ["travel"], "Waterfalls & Borders": ["travel"],
    "Carnival & Old Town": ["travel"], "Amazon Food & Markets": ["travel"], "Wildlife & Boats": ["travel"],
    "Mines & Baroque Towns": ["travel"],
  } },
];

void (async () => {
  const all = await prisma.betaSignup.findMany({
    select: { targetLanguage: true, motivation: true, applicationReason: true },
  });
  for (const b of BATCHES) {
    const rows = all.filter((r) => String(r.targetLanguage ?? "").toLowerCase() === b.lang);
    const corpus = rows.flatMap((r) => {
      const out: string[] = [];
      const m = String(r.motivation ?? "").trim();
      if (m && !isCannedMotivation(m)) out.push(m);
      const a = String(r.applicationReason ?? "").trim();
      if (a) out.push(a);
      return out;
    }).map(norm);

    console.log(`\n### ${b.lang} · ${b.script} · ${corpus.length} frases escritas en el corpus`);
    for (const [label, ev] of Object.entries(b.topics)) {
      const survivors = ev.filter((q) => !short(q) && corpus.some((c) => c.includes(norm(q))));
      const state = survivors.length ? "SOBREVIVE" : "SIN RESPALDO";
      console.log(`  ${state.padEnd(13)} ${label.padEnd(26)} citas: ${ev.map((q) => `${q}${survivors.includes(q) ? "" : " [cae]"}`).join(" | ")}`);
    }
  }
  await prisma.$disconnect();
})();
