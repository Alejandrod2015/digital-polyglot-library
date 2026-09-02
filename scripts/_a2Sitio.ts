/** La ciudad y el pais se dicen UNA vez, en el primer parrafo de la PRIMERA
 *  historia del tema. Repetirlos en la 2 y la 3 suena raro al escuchar. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const PAISES = ["Argentina", "Colombia", "Perú", "México"];
const CIUDAD: Record<string, string> = {
  "friends-and-reunions": "Rosario", "staying-with-locals": "Salento",
  "jokes-and-misunderstandings": "Medellín", "borders-and-crossings": "Santa Rosa",
  "secrets-and-curiosity": "Arequipa", "work-trips-and-meetings": "Guadalajara",
  "local-life-and-routines": "Mérida",
};
(async () => {
  const J = "cmtgelq560007j84n3ujx9bpd";
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const ss = (await p.journeyStory.findMany({ where: { journeyId: J, NOT: { text: null } },
    select: { topic: true, slotIndex: true, slug: true, text: true } }))
    .sort((a, b) => (j!.topics.indexOf(a.topic) - j!.topics.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  let mal = 0;
  for (const s of ss) {
    const t = s.text || "";
    const pais = PAISES.filter((x) => t.includes(x));
    const ciu = CIUDAD[s.topic] && t.includes(CIUDAD[s.topic]) ? CIUDAD[s.topic] : null;
    if (s.slotIndex === 1) {
      const p1 = t.split(/\n\n+/)[0];
      const ok = PAISES.some((x) => p1.includes(x)) && (CIUDAD[s.topic] ? p1.includes(CIUDAD[s.topic]) : true);
      if (!ok) { mal++; console.log(`${s.slug.padEnd(26)} 1a: le falta ciudad o pais en el 1er parrafo`); }
    } else if (pais.length || ciu) {
      mal++;
      console.log(`${s.slug.padEnd(26)} ${s.slotIndex}a: repite ${[ciu, ...pais].filter(Boolean).join(", ")}`);
    }
  }
  console.log(mal === 0 ? "\nel sitio se dice una vez por tema" : `\n${mal} fuera de norma`);
})().finally(() => p.$disconnect());
