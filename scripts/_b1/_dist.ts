import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const f = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" } }, select: { bundle: true, glosses: true } });
  const largos: number[] = []; const porBundle: Record<string, number[]> = {};
  for (const x of f) for (const v of Object.values(x.glosses as Record<string, any>)) if (v.c) {
    const n = String(v.c.es).split(/\s+/).length; largos.push(n); (porBundle[x.bundle] ??= []).push(n);
  }
  largos.sort((a, b) => a - b);
  console.log(`trozos en el catalogo: ${largos.length}`);
  for (const c of [6, 7, 8, 9, 10, 12]) {
    const n = largos.filter((x) => x > c).length;
    console.log(`  con mas de ${c} palabras: ${n} (${(n / largos.length * 100).toFixed(2)}%)`);
  }
  const malos = Object.entries(porBundle).map(([b, l]) => [b, l.filter((x) => x > 8).length] as const).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  console.log("bundles con trozos de mas de 8:", malos.map(([b, n]) => `${b} ${n}`).join(" · ") || "ninguno");
  await p.$disconnect();
})();
