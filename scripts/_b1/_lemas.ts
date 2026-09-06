import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" }, bundle: { startsWith: "spanish-" } }, select: { glosses: true } });
  const lem = new Set<string>();
  for (const f of filas) for (const e of Object.values(f.glosses as Record<string, any>)) {
    const l = String(e.f?.lemma ?? "").split(" ")[0].replace(/^(se|me|te|lo|la|le|les|nos)\s+/, "");
    if (/^[a-záéíóúñ]+(ar|er|ir)$/.test(l)) lem.add(l);
  }
  console.log([...lem].sort().join(" "));
  console.log("total:", lem.size);
  await p.$disconnect();
})();
