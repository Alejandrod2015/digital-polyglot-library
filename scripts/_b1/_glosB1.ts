import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const r = await p.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT "bundle","slug", jsonb_array_length(to_jsonb(ARRAY(SELECT jsonb_object_keys("glosses")))) AS n
     FROM "dp_tap_glosses_v1" WHERE "bundle" ILIKE '%spain%' ORDER BY "bundle","slug" LIMIT 30`);
  for (const x of r) console.log(" ", x.bundle, "|", x.slug === "" ? "(global)" : x.slug, "|", x.n);
  console.log("filas del B1:", r.filter((x) => String(x.bundle).includes("b1")).length);
  await p.$disconnect();
})();
