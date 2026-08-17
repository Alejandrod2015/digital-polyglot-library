import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const JOURNEY_ID = "cmqc6tojm000032el2ebwsgkn";
const NARRATOR = "2EWay75ikIPKrY4w2j69"; // Nuria Storyteller & Calm (ES peninsular); user-approved 2026-07-20 (was Roque, unapproved)
const V: Record<string,string> = {
  "narrator": NARRATOR,
  // Granada
  "marta":"f18RlRJGEw0TaGYwmk8B","hugo":"XJWCXmejYcvojtfGd3Mk","rosario":"RTuKyXJgRGAQSx8Qz8Mf","andrés":"gQLV6zBnMa9rDESaeDz9","vecino":"GojDwihhnL1f7RrBuXsJ",
  // Valencia
  "lucía":"Sp57wugtIMQc3lhms94f","sergio":"eZCjPaC4W7mcOOERqE5n","vicente":"GojDwihhnL1f7RrBuXsJ","tía":"py37pY8QUQdhW5a7JwPG",
  // Barcelona
  "elena":"aTbJG0ZdQTT0lXCvJJWc","marc":"XJWCXmejYcvojtfGd3Mk",
  // Madrid
  "clara":"f18RlRJGEw0TaGYwmk8B","david":"eZCjPaC4W7mcOOERqE5n","paco":"v4b4rQBhckrIsOHsrbub",
  // Sevilla
  "rocío":"Sp57wugtIMQc3lhms94f","curro":"XJWCXmejYcvojtfGd3Mk","reme":"XWuTx9ClCtLoYjuLF6Fa","sobrino":"eZCjPaC4W7mcOOERqE5n",
  // Picos
  "nuria":"aTbJG0ZdQTT0lXCvJJWc","álvaro":"eZCjPaC4W7mcOOERqE5n","begoña":"iuYybvSfclFoJ9ab2Im6",
  // Galicia
  "sabela":"f18RlRJGEw0TaGYwmk8B","brais":"XJWCXmejYcvojtfGd3Mk","carmiña":"9oWKy782oltLmeuOUdq7","vecina":"py37pY8QUQdhW5a7JwPG",
};
const LABEL = /^([A-ZÁÉÍÓÚÑ][\wáéíóúñ.]+):\s+(.*\S)\s*$/u;

async function run() {
  const p = new PrismaClient();
  const stories = await p.journeyStory.findMany({ where: { journeyId: JOURNEY_ID, status: "generated" }, select: { id:true, slug:true, text:true } });
  let ok=0;
  for (const s of stories) {
    const segs: {speaker:string; text:string; voice:string}[] = [];
    const seen = new Set<string>();
    for (const para of (s.text||"").split(/\n+/)) {
      const m = para.match(LABEL);
      const speaker = m ? m[1] : "narrator";
      const text = m ? m[2] : para.trim();
      if (!text) continue;
      const key = speaker.toLowerCase();
      const voice = V[key];
      if (!voice) { console.error(`${s.slug}: SPEAKER SIN VOZ: "${speaker}"`); process.exit(1); }
      seen.add(key);
      segs.push({ speaker, text, voice });
    }
    await p.journeyStory.update({ where: { id: s.id }, data: { dialogueSpec: segs as any, voiceId: NARRATOR } });
    console.log(`${s.slug}: ${segs.length} segmentos, voces: ${[...seen].join(", ")}`);
    ok++;
  }
  console.log(`\n${ok} historias con dialogueSpec.`);
  await p.$disconnect();
}
run().catch(e=>{console.error(e);process.exit(1);});
