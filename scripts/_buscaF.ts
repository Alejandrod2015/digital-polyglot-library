import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const re = new RegExp(process.argv[2], "i");
  const filas = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" } } });
  for (const f of filas) {
    for (const [w, e] of Object.entries(f.glosses as Record<string, { f?: { lemma?: string; rows: string[][] } }>)) {
      if (!e.f) continue;
      const txt = `${e.f.lemma ?? ""} ${e.f.rows.map((r) => r[1]).join(" ")}`;
      if (re.test(txt)) console.log(`${f.bundle} · ${f.slug} · ${w}: ${e.f.lemma} = ${e.f.rows.map((r) => r[1]).join(" / ")}`);
    }
  }
  await p.$disconnect();
})();
