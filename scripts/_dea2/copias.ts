/** Las copias de hermanos (rev:false) del mapa global, cada una con las frases
 *  de ESTE journey donde cae. Se leen una a una: la copia trae el sentido del
 *  journey de origen. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { extractStoryPlainText } from "../../src/lib/storyPlainText";
import { TAPPABLE, glossKeyCandidates } from "../../src/lib/tapGlossKey";
const p = new PrismaClient();
(async () => {
  const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "german-friends-a2", slug: "" } } });
  const map = g!.glosses as Record<string, { g: string; t?: string; rev?: boolean }>;
  const st = await p.journeyStory.findMany({ where: { slug: { in: g!.slugs } }, select: { slug:true, title:true, text:true } });
  const frases = new Map<string, string[]>();
  for (const s of st) {
    const full = `${s.title}. ${extractStoryPlainText(s.text ?? "")}`;
    for (const sent of full.split(/(?<=[.!?”])\s+/).map(x=>x.trim()).filter(Boolean)) {
      for (const tok of sent.match(TAPPABLE) ?? []) {
        for (const k of glossKeyCandidates(tok)) {
          if (!map[k]) continue;
          const arr = frases.get(k) ?? []; if (!arr.includes(sent)) arr.push(sent); frases.set(k, arr);
        }
      }
    }
  }
  const copias = Object.entries(map).filter(([,v]) => v.rev === false).sort();
  let txt = "";
  for (const [w, v] of copias) {
    txt += `\n### ${w} [${v.t}] :: ${v.g}\n` + (frases.get(w) ?? ["(NO SALE EN EL TEXTO)"]).slice(0,4).map(s=>"  - "+s).join("\n") + "\n";
  }
  fs.writeFileSync("scripts/_deA2/copias.md", txt);
  console.log(`${copias.length} copias`);
  await p.$disconnect();
})();
