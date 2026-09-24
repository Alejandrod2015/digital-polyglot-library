/** Las 34 plazas nuevas, cada una con: tipo declarado, definicion de la plaza,
 *  la glosa del bundle, el trozo de contexto y SU frase en la historia. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { extractStoryPlainText } from "../../src/lib/storyPlainText";
const JID = "cmubidgaf0007j8np6g7n89iu";
const B = "german-friends-a2";
const p = new PrismaClient();
const LISTA = "murmeln diesmal Erdgeschoss leicht Umzug Wagen brauchen Flasche lesen blau rot Fuß lernen kennen Foul alt frei Welle morgens wiederholen krank nehmen suchen außerdem Wandfarbe wieder herzlich unten dreimal rufen bringen wandern trinken letzt".split(/\s+/).map(w=>w.toLowerCase());
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: JID }, select: { slug:true, topic:true, slotIndex:true, title:true, text:true, vocab:true } });
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug:true, glosses:true } });
  const global = (filas.find(f=>!f.slug)!.glosses) as Record<string,any>;
  const encontradas = new Set<string>();
  for (const s of st) {
    const capa = (filas.find(f=>f.slug===s.slug)?.glosses ?? {}) as Record<string,any>;
    const texto = `${s.title}\n${extractStoryPlainText(s.text ?? "")}`;
    const frases = texto.split(/(?<=[.!?”])\s+/).map(x=>x.trim()).filter(Boolean);
    for (const v of ((s.vocab as any[]) ?? [])) {
      const w = String(v.word ?? ""); const base = w.toLowerCase().replace(/^(der|die|das)\s+/, "");
      if (!LISTA.includes(base)) continue;
      encontradas.add(base);
      const sup = String(v.surface ?? "").trim();
      const e = capa[sup.toLowerCase()] ?? capa[base] ?? global[sup.toLowerCase()] ?? global[base];
      const re = new RegExp(`(?<![\\p{L}\\p{M}])${(sup||base).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}`, "iu");
      const frase = frases.find(f => re.test(f)) ?? "(no encontrada)";
      console.log(`### ${w}  [tipo: ${v.type}]  surface=${sup}  ${s.slug}`);
      console.log(`  def  : ${v.definition ?? ""}`);
      console.log(`  glosa: ${e?.g ?? "(SIN GLOSA)"}   t=${e?.t ?? "-"}`);
      console.log(`  trozo: ${e?.c ? `"${e.c.es}" / "${e.c.en}"` : "(SIN TROZO)"}`);
      console.log(`  frase: ${frase}`);
    }
  }
  const faltan = LISTA.filter(w => !encontradas.has(w));
  console.log(`\n${encontradas.size}/34 encontradas` + (faltan.length ? `; NO son plaza: ${faltan.join(", ")}` : ""));
  await p.$disconnect();
})();
