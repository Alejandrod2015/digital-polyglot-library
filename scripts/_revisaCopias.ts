/** Vuelca cada glosa que se COPIARÍA del bundle hermano junto a la frase del
 *  journey destino, para releerla en contexto (feedback_gloss_in_context). */
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";
const p = new PrismaClient();
const TAPPABLE = /[\p{L}\p{N}][\p{L}\p{N}'\-]*/gu;
const clave = (t: string) => (t.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/u) ?? [""])[0];
(async () => {
  const [destino, hermano] = [process.argv[2], process.argv[3]];
  const b = JSON.parse(fs.readFileSync(`src/data/tapGlosses/${destino}.json`, "utf8")) as { slugs: string[]; glosses: Record<string, unknown> };
  const h = JSON.parse(fs.readFileSync(`src/data/tapGlosses/${hermano}.json`, "utf8")) as { glosses: Record<string, { g: string; t?: string }> };
  const man = (JSON.parse(fs.readFileSync("scripts/_newGlosses.json", "utf8")) as Record<string, Record<string, unknown>>)[destino] ?? {};
  const rows = await p.journeyStory.findMany({ where: { slug: { in: b.slugs } }, select: { title: true, text: true } });
  const visto = new Set<string>();
  for (const s of rows) {
    const txt = `${s.title}. ${extractStoryPlainText(s.text ?? "")}`.replace(/\s+/g, " ");
    for (const f of txt.split(/(?<=[.!?…”])\s+/).map((x) => x.trim()).filter(Boolean)) {
      for (const tok of f.match(TAPPABLE) ?? []) {
        const k = clave(tok);
        if (!k || visto.has(k) || b.glosses[k] || man[k] || !h.glosses[k]) continue;
        visto.add(k);
        console.log(`${k}\t${h.glosses[k].g}\t${f.slice(0, 105)}`);
      }
    }
  }
  console.log(`\n[${visto.size} copias]`);
  await p.$disconnect();
})();
