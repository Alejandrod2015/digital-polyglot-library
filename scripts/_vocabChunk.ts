import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  // Una historia de un bundle que YA tiene capa.
  const filas = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" } }, select: { bundle: true, slug: true, glosses: true }, take: 400 });
  const conC = filas.filter((f) => Object.values(f.glosses as Record<string, { c?: unknown }>).some((v) => v?.c));
  console.log(`historias con capa: ${conC.length}`);
  let mirados = 0, cubiertos = 0, sinEntrada = 0, sinChunk = 0;
  const ejemplos: string[] = [];
  for (const f of conC.slice(0, 60)) {
    const st = await p.journeyStory.findFirst({ where: { slug: f.slug }, select: { vocab: true, slug: true } });
    if (!st?.vocab) continue;
    const g = f.glosses as Record<string, { c?: { es: string } }>;
    for (const v of st.vocab as Array<{ word?: string }>) {
      const w = (v.word ?? "").trim().toLowerCase();
      if (!w) continue;
      mirados++;
      const e = g[w];
      if (!e) { sinEntrada++; if (ejemplos.length < 6) ejemplos.push(`${f.slug}: "${w}" NO esta en la capa`); continue; }
      if (e.c) { cubiertos++; if (ejemplos.length < 6) ejemplos.push(`${f.slug}: "${w}" -> "${e.c.es}"`); }
      else sinChunk++;
    }
  }
  console.log(`palabras de vocab miradas: ${mirados}`);
  console.log(`  con trozo YA escrito en la capa: ${cubiertos}`);
  console.log(`  con entrada pero sin trozo: ${sinChunk}`);
  console.log(`  sin entrada en la capa: ${sinEntrada}`);
  console.log(ejemplos.join("\n"));
  await p.$disconnect();
})();
