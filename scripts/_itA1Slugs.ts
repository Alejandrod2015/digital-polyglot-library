import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const DIR = "src/data/tapGlosses";
  const ss = await p.journeyStory.findMany({ select: { slug: true, journey: { select: { id: true } } } });
  const vivos = new Set(ss.map((s) => s.slug).filter(Boolean) as string[]);
  let mal = 0;
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json"))) {
    const b = JSON.parse(fs.readFileSync(`${DIR}/${f}`, "utf8")) as { slugs: string[] };
    const muertos = (b.slugs ?? []).filter((s) => !vivos.has(s));
    if (muertos.length) { mal++; console.log(`${f.replace(/\.json$/, "").padEnd(30)} ${muertos.length} slug(s) que ya no existen: ${muertos.join(", ")}`); }
  }
  console.log(mal ? `\n${mal} paquete(s) apuntando a historias muertas` : "todos los paquetes apuntan a historias vivas");
  await p.$disconnect();
})();
