/** Las DOS tablas de un journey, con el formato canónico
 *  ([[feedback_journey_status_table]]): por temas (etapas del pipeline) y por
 *  historias (vocabulario), con el título enlazado al lector local. */
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";
const p = new PrismaClient();
const TAPPABLE = /[\p{L}\p{N}][\p{L}\p{N}'\-]*/gu;
const clave = (t: string) => (t.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/u) ?? [""])[0];
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
(async () => {
  const J = process.argv[2];
  const bundleName = process.argv[3];
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true, name: true, language: true, variant: true, levels: true, status: true } });
  const orden = j?.topics ?? [];
  const rows = (await p.journeyStory.findMany({
    where: { journeyId: J },
    select: { id: true, slug: true, title: true, text: true, vocab: true, topic: true, slotIndex: true, audioUrl: true, coverUrl: true },
  })).sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const sets = new Set((await p.storyPracticeSet.findMany({ where: { storyId: { in: rows.map((r) => r.id) } }, select: { storyId: true } })).map((s) => s.storyId));
  const bundle = JSON.parse(fs.readFileSync(`src/data/tapGlosses/${bundleName}.json`, "utf8")) as { slugs: string[]; glosses: Record<string, unknown> };
  const cuerpos = rows.map((s) => new Set(tok(s.text ?? "")));
  const k = (v: { word: string; surface?: string | null }) => String(v.surface ?? v.word).toLowerCase();

  console.log(`### ${j?.name} ${j?.language}/${j?.variant} ${(j?.levels ?? []).join("")} · ${j?.status}\n`);
  console.log("| # | Ciudad/tema | Escritas+vocab | Glosas tap | Práctica | Audio | Cover |");
  console.log("|---|---|---|---|---|---|---|");
  orden.forEach((t, i) => {
    const g = rows.filter((r) => r.topic === t);
    const n = (f: (r: (typeof rows)[number]) => boolean) => `${g.filter(f).length}/${g.length}`;
    console.log(`| ${i + 1} | ${t} | ${n((r) => Boolean(r.text) && ((r.vocab as unknown[]) ?? []).length === 20)} | ${n((r) => bundle.slugs.includes(r.slug ?? ""))} | ${n((r) => sets.has(r.id))} | ${n((r) => Boolean(r.audioUrl))} | ${n((r) => Boolean(r.coverUrl))} |`);
  });

  console.log("\n| # | Historia | Glosas | Portables | Ancladas | Vistas antes | Vuelven después | Escalera |");
  console.log("|---|---|---|---|---|---|---|---|");
  rows.forEach((s, i) => {
    const formas = new Set<string>();
    for (const src of [s.title ?? "", extractStoryPlainText(s.text ?? "")])
      for (const m of src.match(TAPPABLE) ?? []) { const c = clave(m); if (c) formas.add(c); }
    const conGlosa = [...formas].filter((f) => bundle.glosses[f]).length;
    const vocab = ((s.vocab as Array<{ word: string; surface?: string }>) ?? []);
    let port = 0, anc = 0, antes = 0, despues = 0, suma = 0;
    for (const v of vocab) {
      const key = k(v);
      const donde = cuerpos.map((c, n) => (c.has(key) ? n : -1)).filter((n) => n >= 0);
      suma += donde.length;
      if (donde.length > 1) port++; else anc++;
      if (donde.some((n) => n < i)) antes++;
      if (donde.some((n) => n > i)) despues++;
    }
    console.log(`| ${i + 1} | [${s.title}](http://localhost:3000/stories/${s.slug}) | ${conGlosa}/${formas.size} | ${port} | ${anc} | ${antes} | ${despues} | ${(suma / vocab.length).toFixed(2)} |`);
  });
  await p.$disconnect();
})();
