import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { language: { equals: "spanish", mode: "insensitive" } }, select: { id: true } });
  const rows = await p.journeyStory.findMany({ where: { journeyId: { in: js.map((x) => x.id) } }, select: { text: true } });
  const corpus = new Set<string>();
  for (const r of rows) for (const w of (String(r.text ?? "").toLowerCase().match(/[\p{L}]+/gu) ?? [])) corpus.add(w);
  const filas = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" }, bundle: { startsWith: "spanish-" } }, select: { bundle: true, glosses: true } });
  const malas = new Map<string, number>();
  let tablas = 0;
  for (const f of filas) for (const e of Object.values(f.glosses as Record<string, any>)) {
    const rs = e.f?.rows as string[][] | undefined;
    if (!rs || !e.f?.lemma) continue;
    tablas++;
    for (const fila of rs) {
      const forma = String(fila[1] ?? "").toLowerCase().split(/\s+/).pop() ?? "";
      if (forma.length > 3 && !corpus.has(forma)) malas.set(forma, (malas.get(forma) ?? 0) + 1);
    }
  }
  const orden = [...malas].sort((a, b) => b[1] - a[1]);
  console.log(`tablas de conjugacion: ${tablas} · formas distintas que no salen en ningun cuerpo: ${orden.length}`);
  console.log(orden.slice(0, 30).map(([w, n]) => `${w}(${n})`).join(" · "));
  await p.$disconnect();
})();
