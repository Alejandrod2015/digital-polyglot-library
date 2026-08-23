/** ¿Se usó alguna vez una voz francesa? Barre journeys, historias, catálogo y
 *  libros buscando contenido en francés con voz asignada. Solo lectura. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p: any = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { language: "french" }, select: { id: true, name: true, variant: true, levels: true, status: true } });
  console.log("journeys FR:", js.map((j: any) => `${j.name}/${j.variant}/${j.levels.join(",")} [${j.status}] ${j.id}`).join(" | ") || "ninguno");
  const st = await p.journeyStory.findMany({
    where: { journeyId: { in: js.map((j: any) => j.id) } },
    select: { slug: true, voiceId: true, practiceVoiceId: true, audioUrl: true, audioSegments: true },
  });
  console.log("historias FR:", st.length,
    "| con voiceId:", st.filter((s: any) => s.voiceId).length,
    "| con audio:", st.filter((s: any) => s.audioUrl).length,
    "| con segmentos:", st.filter((s: any) => s.audioSegments).length);
  for (const s of st.filter((x: any) => x.voiceId || x.audioUrl)) console.log("   ", s.slug, s.voiceId, s.audioUrl);

  for (const [modelo, campos] of [["standaloneStory", ["voiceId", "audioUrl", "language"]], ["catalogStory", ["voiceId", "audioUrl", "language"]], ["book", ["language"]]] as const) {
    if (!p[modelo]) { console.log(`(${modelo}: no existe)`); continue; }
    try {
      const rows = await p[modelo].findMany({ where: { language: { contains: "fr", mode: "insensitive" } } });
      console.log(`${modelo} FR:`, rows.length, rows.slice(0, 8).map((r: any) => `${r.slug ?? r.title} voz=${r.voiceId ?? "-"} audio=${r.audioUrl ? "si" : "-"}`).join(" | "));
    } catch (e: any) { console.log(`${modelo}:`, e.message.split("\n")[0]); }
  }
  await p.$disconnect();
})();
