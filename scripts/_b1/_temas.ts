import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmt5x67ze000l320cpgunu5vi" }, select: { topics: true, name: true, typeSlug: true } });
  console.log(j?.typeSlug, JSON.stringify(j?.topics));
  const cols = await p.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name LIKE '%topic%'`);
  console.log("columnas topic:", [...new Set(cols.map((c) => c.column_name))].join(", "));
  const t = await p.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT * FROM "dp_journey_topics_v1" WHERE "slug" = ANY($1::text[])`, j?.topics ?? []).catch((e) => { console.log("(no dp_journey_topics_v1)", String(e).slice(0,80)); return []; });
  for (const x of t) console.log(" ", JSON.stringify(x).slice(0, 260));
  await p.$disconnect();
})();
