import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
type E = { c?: { es: string }; f?: { lemma?: string; link?: string } };
(async () => {
  const f = await p.tapGlossSet.findFirst({ where: { slug: "marta-ensena-el-retiro" } });
  const g = f!.glosses as Record<string, E>;
  for (const w of ["esperar", "flor", "contento"]) {
    const porLema = Object.entries(g).filter(([, v]) => v.f?.lemma === w || v.f?.link === w);
    console.log(`${w}: entradas cuya tabla apunta a ese lema -> ${porLema.map(([k, v]) => `${k}${v.c ? ` ("${v.c.es}")` : " SIN TROZO"}`).join(", ") || "ninguna"}`);
  }
  await p.$disconnect();
})();
