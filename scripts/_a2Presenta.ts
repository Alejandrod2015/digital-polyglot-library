/** En la PRIMERA historia de cada tema, los dos personajes tienen que quedar
 *  presentados en el PRIMER parrafo, con un sintagma que diga QUE SON. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const CAST: Record<string, string[]> = {
  "friends-and-reunions": ["Marisol", "Leandro"],
  "staying-with-locals": ["Amparo", "Yolanda"],
  "jokes-and-misunderstandings": ["Liliana", "Fabián"],
  "borders-and-crossings": ["Percy", "Karina"],
  "secrets-and-curiosity": ["Cecilia", "Zoila"],
  "work-trips-and-meetings": ["Ernesto", "Araceli"],
  "local-life-and-routines": ["Gabriela", "Salvador"],
};
const NUC = "(?:[a-zá-úüñ]+\\s+){0,3}[a-zá-úüñ]+";
const VERBO = "(?:es|era|trabaja|vende|alquila|cuida|lleva|atiende|reparte|vive|maneja|cose|abre|sirve)";
(async () => {
  const J = "cmtgelq560007j84n3ujx9bpd";
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const ss = (await p.journeyStory.findMany({ where: { journeyId: J, slotIndex: 1 },
    select: { topic: true, slug: true, text: true } }))
    .sort((a, b) => j!.topics.indexOf(a.topic) - j!.topics.indexOf(b.topic));
  let mal = 0;
  for (const s of ss) {
    const p1 = (s.text || "").split(/\n\n+/)[0];
    const faltan: string[] = [];
    for (const n of CAST[s.topic] ?? []) {
      const apos = new RegExp(`${n}(?:\\s+[A-ZÁ-Ú][a-zá-úñ]+)?,\\s+(?:un|una|el|la)\\s+${NUC}`, "u");
      const ofic = new RegExp(`\\b${n}\\s+${VERBO}\\b`, "u");
      const quien = new RegExp(`\\bQuien\\s+[a-zá-úüñ\\s]{2,30}\\s+es\\s+${n}\\b`, "u");
      if (!p1.includes(n)) faltan.push(`${n} (no sale en el 1er parrafo)`);
      else if (!apos.test(p1) && !ofic.test(p1) && !quien.test(p1)) faltan.push(`${n} (sale, pero sin decir que es)`);
    }
    if (faltan.length) mal++;
    console.log(`${s.slug.padEnd(26)} ${faltan.length ? faltan.join(" · ") : "los dos presentados"}`);
  }
  console.log(mal === 0 ? "\nlos 7 cumplen" : `\n${mal} de 7 sin cumplir`);
})().finally(() => p.$disconnect());
