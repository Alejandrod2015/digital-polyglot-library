/** Solo LECTURA: expresiones en DIALOGO de historias en espanol ya narradas y alineadas. */
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const USED = ["ahorita", "hormigas culonas", "habla causa", "al toque", "previa", "piba", "quedar la escoba", "weviar", "neta", "animo por los suelos", "tejate", "bajoneado", "pancho", "ni el gato", "a la hora de nadie", "la carta", "la barra", "que pedo", "la comedera", "roche", "embalado", "delicada"];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { audioUrl: { not: null }, audioWordTimings: { not: null }, journey: { language: "spanish", status: { in: ["active", "draft"] } } },
    select: { title: true, text: true, vocab: true, journey: { select: { variant: true, status: true, typeSlug: true } } },
  });
  const out: string[] = [];
  for (const r of rows) {
    const text = r.text || "";
    // Tramos entre comillas curvas: eso es lo que dice un personaje en voz alta.
    const quoted = [...text.matchAll(/“([^”]*)”/g)].map((m) => norm(m[1]));
    for (const v of ((r.vocab as unknown as Array<{ type?: string; word?: string; surface?: string; definition?: string }>) || [])) {
      if ((v.type || "").toLowerCase() !== "expression") continue;
      const surf = norm(v.surface || v.word || "");
      if (!surf || USED.some((u) => norm(u) === surf)) continue;
      if (!quoted.some((q) => q.includes(surf))) continue;
      const line = (text.match(new RegExp("“[^”]*" + (v.surface || v.word || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[^”]*”", "i")) || [""])[0];
      out.push(`${r.journey?.variant || "-"}\t${r.journey?.status}\t${v.word}\t${(v.definition || "").slice(0, 60)}\t${r.title}\t${line.slice(0, 110)}`);
    }
  }
  console.log(out.join("\n"));
  console.log("TOTAL", out.length);
  await p.$disconnect();
})();
