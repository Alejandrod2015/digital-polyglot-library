/** Solo LECTURA: expresiones mexicanas en DIALOGO, con ejercicio Meaning publicado. */
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const MX = /M[eé]xico|Guadalajara|Oaxaca|Monterrey|CDMX|Puebla|Yucat|Tijuana|Mexicano/i;
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { audioUrl: { not: null }, audioWordTimings: { not: null }, journey: { language: "spanish", status: { in: ["active", "draft"] } } },
    select: { id: true, title: true, text: true, vocab: true, practiceSet: { select: { exercises: { select: { type: true, word: true, payload: true } } } } },
  });
  for (const r of rows) {
    const text = r.text || "";
    if (!MX.test(text)) continue;
    const quoted = [...text.matchAll(/“([^”]*)”/g)].map((m) => m[1]);
    for (const v of ((r.vocab as unknown as Array<{ type?: string; word?: string; surface?: string; definition?: string }>) || [])) {
      if ((v.type || "").toLowerCase() !== "expression") continue;
      const surf = v.surface || v.word || "";
      const line = quoted.find((q) => q.toLowerCase().includes(surf.toLowerCase()));
      if (!line) continue;
      const ex = r.practiceSet?.exercises.find((e) => e.type === "meaning_in_context" && e.word.toLowerCase() === (v.word || "").toLowerCase());
      if (!ex) continue;
      const pay = ex.payload as { options: string[]; answer: string };
      console.log(`${r.title} | ${v.word} | ${v.definition?.slice(0, 55)} | "${line.slice(0, 90)}" | ${JSON.stringify(pay.options)} -> ${pay.answer}`);
    }
  }
  await p.$disconnect();
})();
