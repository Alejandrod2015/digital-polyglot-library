// Pasada de genero de french-friends-a0, lo que _gm.ts no hace solo:
//  --antes: sentidos de "pas" por historia (negacion / sustantivo).
//  --locataire: une nouvelle locataire en a-samedi-hugo (f.), con writeGlossLayer.
//  --despues: conteo de gm y comprobacion de "pas".
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "../../../src/generated/prisma";
const p = new PrismaClient();
const B = "french-friends-a0";
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B, NOT: { slug: "" } }, select: { slug: true, glosses: true } });
  const modo = process.argv[2];
  if (modo === "--antes" || modo === "--despues") {
    const neg: string[] = [], sust: string[] = [], raro: string[] = [];
    for (const f of filas) { const e = (f.glosses as any).pas; if (!e) continue;
      const tag = `${f.slug} [${e.g} | ${e.t ?? "-"} | gm ${e.gm ?? "-"}]`;
      if (/step/i.test(e.g) && !/not/i.test(e.g)) sust.push(tag); else if (/not/i.test(e.g) && !/step/i.test(e.g)) neg.push(tag); else raro.push(tag); }
    console.log(`pas: ${neg.length} historias de negacion, ${sust.length} de sustantivo, ${raro.length} mezcladas`);
    for (const x of [...sust, ...raro]) console.log("  ", x);
    if (neg.some((x) => !x.endsWith("gm -]"))) console.log("  OJO: negacion con gm:", neg.filter((x) => !x.endsWith("gm -]")));
  }
  if (modo === "--locataire") {
    const e = (filas.find((f) => f.slug === "a-samedi-hugo")!.glosses as any).locataire;
    fs.writeFileSync("scripts/_frA0/glosas/pisadas/locataire.json", JSON.stringify({ locataire: { es: e.c.es, en: e.c.en, gm: "f." } }, null, 1) + "\n");
    console.log(execFileSync("npx", ["tsx", "scripts/writeGlossLayer.ts", B, "a-samedi-hugo", "scripts/_frA0/glosas/pisadas/locataire.json"], { encoding: "utf8" }).trim());
  }
  if (modo === "--despues") {
    let conGm = 0, sust = 0; const sin = new Set<string>();
    for (const f of filas) for (const [w, e] of Object.entries<any>(f.glosses)) {
      if (e.gm) conGm++;
      if (e.t === "noun") { sust++; if (!e.gm) sin.add(w); }
    }
    const loc = filas.filter((f) => (f.glosses as any).locataire).map((f) => `${f.slug}:${(f.glosses as any).locataire.gm}`);
    console.log(`entradas con gm: ${conGm} · sustantivos de capa sin gm: ${[...sin].join(", ") || "ninguno"} · locataire: ${loc.join(" ")}`);
  }
  await p.$disconnect();
})();
