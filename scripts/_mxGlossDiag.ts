import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";
import { evaluarEntradaGlossContext } from "../src/lib/glossContextReal";
import { uncoveredOccurrences } from "../src/lib/tapGlossChunk";

const BUNDLE = "spanish-friends-mexico-a0";
const VIEJOS = /Itzel|Citlali/;
const p = new PrismaClient();
(async () => {
  const rows = await p.tapGlossSet.findMany({ where: { bundle: BUNDLE }, select: { slug: true, glosses: true } });
  const global: any = rows.find((r) => !r.slug)?.glosses ?? {};
  const stories = await p.journeyStory.findMany({ where: { slug: { in: rows.map((r) => r.slug) } }, select: { slug: true, title: true, text: true } });
  const txt = new Map(stories.map((s) => [s.slug, `${s.title ?? ""}\n${extractStoryPlainText(s.text ?? "")}`]));

  const motivos: Record<string, number> = {};
  let ctxTotal = 0, ctxNombre = 0;
  let occTotal = 0, occNombre = 0;
  const noNombre: string[] = [];

  for (const row of rows) {
    const texto = txt.get(row.slug); if (!texto) continue;
    const gl: any = row.glosses ?? {};
    for (const [palabra, e] of Object.entries<any>(gl)) {
      if (typeof e?.c?.es !== "string") continue;
      const g = e.g ?? global[palabra]?.g ?? "";
      const v = evaluarEntradaGlossContext({ palabra, c: e.c, g, texto });
      if (!v.ok) {
        ctxTotal++;
        motivos[v.motivo] = (motivos[v.motivo] ?? 0) + 1;
        const chunks = [e.c, ...(e.cs ?? [])];
        if (chunks.some((c: any) => VIEJOS.test(c?.es ?? "") || VIEJOS.test(c?.en ?? ""))) ctxNombre++;
        else noNombre.push(`CTX ${row.slug}|${palabra} [${v.motivo}] es="${e.c.es}" en="${e.c.en}"`);
      }
      const sin = uncoveredOccurrences(palabra, texto, e);
      if (sin.length) {
        occTotal++;
        const chunks = [e.c, ...(e.cs ?? [])];
        if (chunks.some((c: any) => VIEJOS.test(c?.es ?? "") || VIEJOS.test(c?.en ?? ""))) occNombre++;
        else noNombre.push(`OCC ${row.slug}|${palabra} es="${e.c.es}" cs=${(e.cs ?? []).length}`);
      }
    }
  }
  console.log("context-real fallos:", ctxTotal, "| con nombre viejo en algun trozo:", ctxNombre);
  console.log("motivos:", JSON.stringify(motivos));
  console.log("occurrences fallos:", occTotal, "| con nombre viejo en algun trozo:", occNombre);
  console.log("\n--- NO explicados por el nombre (" + noNombre.length + ") ---");
  for (const l of noNombre) console.log(l);
  await p.$disconnect();
})();
