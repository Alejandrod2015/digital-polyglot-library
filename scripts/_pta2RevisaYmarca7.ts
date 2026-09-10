/**
 * Sexta lectura: las 57 copias del tema 6. Quince mal.
 *
 * Una merece nota: "real". En este journey la palabra sale con los DOS
 * sentidos, la moneda ("um real" en la tercera) y lo verdadero ("o real nao
 * era o dinheiro" en la segunda), y el mapa global solo tiene una entrada por
 * palabra. Se glosa cubriendo los dos; el que separa de verdad los sentidos
 * por historia es la capa de contexto.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const B = "portuguese-traveler-brazil-a2";

const ARREGLOS: Record<string, { g?: string; t?: string }> = {
  // Otro sentido de la misma palabra en esta historia.
  carga: { g: "charge, the power inside a battery" },
  folhas: { g: "sheets of paper (folha)" },
  segunda: { g: "segunda-feira, Monday", t: "noun" },
  senha: { g: "password you type in" },
  recebe: { g: "receives it, gets it delivered (receber)" },
  saiu: { g: "came through, was settled (sair)" },
  real: { g: "the true thing; um real is also the Brazilian coin" },
  saída: { g: "way out of a problem; also an exit" },
  // Coletilla del journey de origen.
  cidades: { g: "cities, towns (cidade)" },
  chefe: { g: "the boss, the person who decides" },
  contrato: { g: "contract, the agreement in writing" },
  reunião: { g: "meeting where the work is decided" },
  tabela: { g: "a table of figures set out in rows" },
  cabe: { g: "fits inside (caber)" },
  confere: { g: "checks it (conferir)" },
  faço: { g: "I do it (fazer)" },
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
