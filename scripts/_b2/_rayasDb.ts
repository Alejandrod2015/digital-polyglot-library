/** Guiones largos (em U+2014, en U+2013) en las filas del B2 latam: historias,
 *  glosas del bundle y ejercicios de practica. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const RAYA = new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]`);
(async () => {
  const J = "cmtpls1l20007j8epwgcs6e1h";
  const s = await p.journeyStory.findMany({ where: { journeyId: J }, select: { id: true, slug: true, title: true, text: true, synopsis: true, vocab: true } });
  const hs = s.filter((x) => RAYA.test(JSON.stringify([x.title, x.text, x.synopsis, x.vocab]))).map((x) => x.slug);
  const g = await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-latam-b2" }, select: { slug: true, glosses: true } });
  const hg = g.filter((x) => RAYA.test(JSON.stringify(x.glosses))).map((x) => x.slug || "global");
  const ej: any[] = await p.$queryRawUnsafe(
    `SELECT e.word, e.sentence, e.payload::text AS payload FROM dp_story_practice_exercises_v1 e JOIN dp_story_practice_sets_v1 ps ON ps.id = e."setId" WHERE ps."storyId" = ANY($1)`, s.map((x) => x.id));
  const he = ej.filter((x) => RAYA.test(`${x.word}${x.sentence}${x.payload}`)).map((x) => x.word);
  console.log(`historias ${s.length}: ${hs.length ? hs.join(", ") : "0 con guion largo"}`);
  console.log(`filas de glosas ${g.length}: ${hg.length ? hg.join(", ") : "0 con guion largo"}`);
  console.log(`ejercicios ${ej.length}: ${he.length ? he.join(", ") : "0 con guion largo"}`);
  await p.$disconnect();
})();
