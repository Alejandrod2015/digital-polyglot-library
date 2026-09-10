/** Vuelca un tema del B2 desde la base: JSON para saveStory + plan del registro + lectura compacta. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { readFileSync, writeFileSync } from "fs";
const p = new PrismaClient();
const J = "cmtplpfum0007j8c6piegwt31";
(async () => {
  const [n, tema] = process.argv.slice(2);
  const st = await p.journeyStory.findMany({ where: { journeyId: J, topic: tema }, orderBy: { slotIndex: "asc" } });
  const out = st.map((s) => ({ topic: s.topic, slotIndex: s.slotIndex, title: s.title, arcType: s.arcType, synopsis: s.synopsis, text: s.text, vocab: s.vocab }));
  writeFileSync(`scripts/_b2s/ext/t${n}-original.json`, JSON.stringify(out, null, 1));
  const plan = JSON.parse(readFileSync("scripts/tema-cierres.json", "utf8"))[`${J}#${tema}`]?.plan;
  writeFileSync(`scripts/_b2s/ext/t${n}.plan.json`, JSON.stringify(plan, null, 1));
  for (const s of st) {
    console.log(`\n### ${s.slotIndex} · ${s.title} (${s.slug}) · ${s.arcType} · ${String(s.text).split(/\s+/).length} palabras`);
    console.log(s.text);
    console.log("VOCAB: " + ((s.vocab as any[]) ?? []).map((v) => `${v.word}${v.surface ? `(${v.surface})` : ""}[${v.type[0]}]`).join(" · "));
  }
  console.log(`\nPLAN recursos: ${plan?.recursos}\nPLAN registro: ${plan?.registro}`);
  for (const h of plan?.historias ?? []) console.log(`  #${h.slot} quiere: ${h.quiere} | cambia: ${h.cambia}`);
  await p.$disconnect();
})();
