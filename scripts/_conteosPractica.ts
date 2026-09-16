import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import crypto from "node:crypto"; import fs from "node:fs";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmu410zep000732szrw94t2sl" }, select: { id: true, slug: true } });
  const ids = st.map((s) => s.id);
  const rows: any[] = await p.$queryRawUnsafe(
    `SELECT s."storyId", s.locked, count(e.id)::int AS n,
            sum(case when e.featured then 1 else 0 end)::int AS feat,
            min(e.language) AS lang,
            sum(case when e.type='match_meaning' then 1 else 0 end)::int AS mm,
            sum(case when e.type='fill_blank' then 1 else 0 end)::int AS fb,
            sum(case when e.type='meaning_in_context' then 1 else 0 end)::int AS mic,
            sum(case when e."audioUrl" is not null then 1 else 0 end)::int AS aud
     FROM dp_story_practice_sets_v1 s
     LEFT JOIN dp_story_practice_exercises_v1 e ON e."setId"=s.id
     WHERE s."storyId" = ANY($1::text[]) GROUP BY s."storyId", s.locked`, ids);
  const bySlug = new Map(st.map((s) => [s.id, s.slug!]));
  let tot = 0, feat = 0, mm = 0, fb = 0, mic = 0, aud = 0, locked = 0;
  for (const r of rows) { tot += r.n; feat += r.feat; mm += r.mm; fb += r.fb; mic += r.mic; aud += r.aud; if (r.locked) locked++; }
  const langs = [...new Set(rows.map((r) => r.lang))];
  console.log(`sets:              ${rows.length} (locked: ${locked})`);
  console.log(`ejercicios:        ${tot}  (${mic} meaning_in_context + ${fb} fill_blank + ${mm} match_meaning + 0 listen_choose)`);
  console.log(`featured:          ${feat} (${feat / rows.length} por historia)`);
  console.log(`idioma:            ${langs.join(", ")}`);
  console.log(`con audioUrl:      ${aud} (el audio no se ha generado: no estaba en el encargo)`);
  const files = st.map((s) => fs.readFileSync(`scripts/_sets/${s.slug}.json`, "utf8")).join("");
  console.log(`hash de los 21 _sets: ${crypto.createHash("sha256").update(files).digest("hex").slice(0, 16)}`);
  await p.$disconnect();
})();
