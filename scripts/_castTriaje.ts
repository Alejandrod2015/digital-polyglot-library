import { PrismaClient } from "../src/generated/prisma";
import { castOf } from "../src/lib/validateJourneyStories";
import GATES from "/private/tmp/claude-501/-Users-alejandrodelcarpio-digital-polyglot-library/630369fb-d47e-4a5f-9c4c-452dc32c38cf/scratchpad/gates5.json";
const p = new PrismaClient();
const LANG: Record<string, string> = { german: "DE", spanish: "ES", portuguese: "PT", french: "FR", italian: "IT" };

async function main() {
  const rows: any[] = [];
  for (const g of GATES as any[]) {
    if (!g.fallan.length) continue;
    const j = await p.journey.findUnique({ where: { id: g.id },
      select: { language: true, levels: true, topics: true, stories: { orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
        select: { slug: true, text: true, topic: true, audioUrl: true, coverUrl: true } } } });
    const ordenTema = (t: string | null) => { const i = j!.topics.indexOf(t ?? ""); return i < 0 ? 99 : i; };
    const stories = j!.stories.filter((s) => (s.text ?? "").length > 200)
      .map((s) => ({ slug: s.slug ?? "", title: "", text: s.text ?? "", language: j!.language, level: "", topic: s.topic }));
    stories.sort((a, b) => ordenTema(a.topic) - ordenTema(b.topic));
    const cast = castOf(stories as any, LANG[j!.language]);
    const cuantos = (t: string) => cast.filter((n) => new RegExp(`(?<!\\p{L})${n}(?!\\p{L})`, "u").test(t)).length;
    const primerTema = stories[0].topic;
    const delTema = stories.filter((s) => s.topic === primerTema);
    // ¿bastaria REORDENAR? (otra historia del mismo tema con 2 o menos)
    const reordenable = delTema.some((s) => cuantos(s.text) <= 2);
    const arregla: Record<string, string> = {};
    for (const f of g.fallan) {
      if (f.id === "journey-cast-first-story-only-fixed")
        arregla[f.id] = reordenable ? "orden (metadatos)" : "prosa";
      else if (f.id === "journey-cast-one-new-per-topic")
        arregla[f.id] = /temas con mas de uno/.test(f.detalle) ? "prosa" : "orden (metadatos)";
      else arregla[f.id] = "prosa";
    }
    rows.push({ id: g.id, status: g.status, tipo: g.tipo, lang: g.lang, variant: g.variant, level: g.level,
      n: g.n, audio: g.conAudio, portada: g.conPortada, cast: cast.length,
      fallan: g.fallan.map((f: any) => ({ id: f.id.replace("journey-", ""), cifra: f.detalle.slice(0, 110), arregla: arregla[f.id] })) });
  }
  console.log(JSON.stringify(rows, null, 1));
}
main().finally(() => p.$disconnect());
