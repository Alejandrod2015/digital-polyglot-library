import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.$queryRawUnsafe<Array<{ bundle: string; slug: string; n: number }>>(
    `SELECT "bundle", "slug", jsonb_object_keys_count(1) AS n FROM "dp_tap_glosses_v1" LIMIT 0`
  ).catch(() => null);
  const r2 = await p.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'dp_tap_glosses_v1'`
  );
  console.log("columnas:", r2.map((x) => x.column_name).join(", "));
  const r3 = await p.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT "bundle", count(*) AS filas FROM "dp_tap_glosses_v1" GROUP BY "bundle" ORDER BY "bundle"`
  );
  for (const x of r3) console.log(" ", x.bundle, x.filas);
  await p.$disconnect();
})();
