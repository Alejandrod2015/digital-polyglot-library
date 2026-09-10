/**
 * Quinta lectura: las 55 copias del tema 5. Trece mal.
 *
 * La peor es "Bonito": el copiador lo tomo por el adjetivo y aqui es la
 * ciudad a la que Renata tiene que llegar. Un nombre propio real no se
 * esconde en los exentos, se glosa con lo que ES.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const B = "portuguese-traveler-brazil-a2";

const ARREGLOS: Record<string, { g?: string; t?: string }> = {
  // Nombre propio tomado por palabra comun.
  bonito: { g: "Bonito, a town in Mato Grosso do Sul", t: "noun" },
  // Otro sentido de la misma palabra.
  cara: { g: "face; bater na cara means to hit you in the face", t: "noun" },
  licença: { g: "da licenca means excuse me, let me through", t: "expression" },
  dá: { g: "gives (dar); da licenca is excuse me", t: "verb" },
  espelho: { g: "the mirror the driver watches the aisle in" },
  // Coletilla del journey de origen, falsa aqui.
  meses: { g: "months (mes)" },
  metrô: { g: "underground railway under a big city" },
  move: { g: "shifts, moves a little (mover-se)" },
  liga: { g: "switches it on (ligar)" },
  continuar: { g: "to go on the same way" },
  escreveu: { g: "wrote (escrever)" },
  ganho: { g: "I gain, I make up (ganhar)" },
  buzina: { g: "sounds the horn (buzinar)" },
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
