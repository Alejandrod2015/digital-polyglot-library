/** Septima y ultima lectura: las 45 copias del tema 7. Siete mal. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const B = "portuguese-traveler-brazil-a2";

const ARREGLOS: Record<string, { g?: string; t?: string }> = {
  // Otro sentido de la misma palabra.
  vara: { g: "pole, here the rail the washing hangs on" },
  verdade: { g: "de verdade means really, for real" },
  peças: { g: "items of clothing (peça)" },
  comprida: { g: "long (comprido)" },
  // Coletilla del origen, o forma equivocada.
  viva: { g: "alive, and feeling it (vivo)" },
  filma: { g: "films it (filmar)" },
  // Tipo mal puesto: aqui es el verbo, no el sustantivo.
  dança: { g: "dances (dançar)", t: "verb" },
};

(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  let arreglos = 0, marcadas = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, { g?: string; t?: string; rev?: boolean }>;
    for (const [w, fix] of Object.entries(ARREGLOS))
      if (g[w]) { g[w] = { ...g[w], ...fix }; arreglos++; }
    for (const w of Object.keys(g))
      if (g[w]?.rev === false) { g[w].rev = true; marcadas++; }
    await p.tapGlossSet.update({
      where: { bundle_slug: { bundle: B, slug: f.slug } },
      data: { glosses: g as never },
    });
  }
  console.log(`arreglos ${arreglos} · marcadas como leidas ${marcadas}`);
  await p.$disconnect();
})();
