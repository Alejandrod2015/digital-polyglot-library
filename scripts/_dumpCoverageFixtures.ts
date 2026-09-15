import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { writeFileSync } from "fs";
import { transcribeMaster } from "./coverageWhisperCheck";
const p = new PrismaClient();
const J = "cmu04ereh000732z7px7naqa2";
const R2 = "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/generated/audio/";
const ROTOS: Record<string, string> = {
  "une-liste-dans-la-tete": "Une_liste_dans_la_tte_multivoice_1789402306967.mp3",
  "tout-le-monde-rit": "Tout_le_monde_rit_multivoice_1789398831734.mp3",
  "l-etagere-du-haut": "Ltagre_du_haut_multivoice_1789395390934.mp3",
  "sans-mais": "Sans_mais_multivoice_1789414026421.mp3",
  "une-flammekueche-maison": "Une_flammekueche_maison_multivoice_1789418210674.mp3",
};
const LIMPIOS = ["il-y-a-douze-ans", "la-sauce-ne-tient-pas", "encore-une-voie"];
(async () => {
  const out: any[] = [];
  for (const slug of [...LIMPIOS, ...Object.keys(ROTOS)]) {
    const s = await p.journeyStory.findFirst({ where: { journeyId: J, slug }, select: { title: true, text: true, audioUrl: true } });
    if (!s) throw new Error(`no ${slug}`);
    const url = ROTOS[slug] ? R2 + ROTOS[slug] : s.audioUrl!;
    const heard = await transcribeMaster(url);
    out.push({ slug, expected: ROTOS[slug] ? "roto" : "limpio", url, text: `${s.title}. ${s.text}`, heard: heard.map((w) => w.text) });
    console.log(slug, url.split("/").pop(), heard.length);
  }
  writeFileSync("scripts/__tests__/fixtures/coverage-fr-a2-masters.json", JSON.stringify(out, null, 1));
})().finally(() => p.$disconnect());
