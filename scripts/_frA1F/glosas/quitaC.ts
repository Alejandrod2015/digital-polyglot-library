// Quita SOLO el campo `c` de las entradas de capa cuya palabra ya no sale en la
// historia (restos de un texto anterior): no hay trozo literal que darles. La
// entrada (g, t, gm) se queda. Se niega si la palabra aparece en el texto.
//   npx tsx scripts/_frA1F/glosas/quitaC.ts [--dry]
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../../src/generated/prisma";
import { TAPPABLE, glossKeyCandidates } from "../../../src/lib/tapGlossKey";
const p = new PrismaClient();
const B = "french-friends-france-a1";
(async () => {
  const dry = process.argv.includes("--dry");
  const rows = await p.tapGlossSet.findMany({ where: { bundle: B, slug: { not: "" } } });
  const st = await p.journeyStory.findMany({ where: { slug: { in: rows.map((r) => r.slug) } }, select: { slug: true, title: true, text: true } });
  let n = 0;
  for (const r of rows) {
    const s = st.find((x) => x.slug === r.slug)!;
    const txt = `${s.title} ${s.text}`;
    const enTexto = new Set([...(txt.match(TAPPABLE) ?? []).flatMap((t) => [t.toLowerCase().replace(/’/g, "'"), ...glossKeyCandidates(t)]),
      ...[...txt.matchAll(/\p{L}[\p{L}\p{M}'-]*/gu)].map((m) => m[0].toLowerCase())]);
    const nueva = JSON.parse(fs.readFileSync(`scripts/_frA1F/glosas/capas/${r.slug}.json`, "utf8"));
    const g = r.glosses as Record<string, Record<string, unknown>>;
    let cambia = false;
    for (const [k, v] of Object.entries(g)) {
      if (!v.c || nueva[k]) continue;
      if (enTexto.has(k)) { console.error(`NO: ${r.slug}:${k} sale en el texto`); process.exitCode = 1; continue; }
      console.log(`${r.slug}\t${k}\tquito c`);
      delete v.c; n++; cambia = true;
    }
    if (cambia && !dry) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: r.slug } }, data: { glosses: g as never } });
  }
  console.log(`${n} c quitadas${dry ? " (dry)" : ""}`);
  await p.$disconnect();
})();
