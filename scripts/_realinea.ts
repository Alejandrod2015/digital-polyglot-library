/** Re-alinea los tiempos de palabra de una historia contra su texto ACTUAL,
 *  usando el audio que ya existe. No sintetiza nada: no gasta creditos.
 *
 *  WHY: el lector con karaoke (HighlightedStoryContent) parte el texto por
 *  CADA salto de linea del payload de tiempos, que es una foto del texto
 *  tomada al alinear. Si el texto se reagrupa despues, el lector sigue
 *  pintando los parrafos viejos. Realinear refresca esa foto. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });

// Neutraliza el guard `server-only`, igual que saveStory.ts: la cadena de
// imports de los tiempos de palabra lo arrastra y desde un script de Node
// tira. Tiene que ir ANTES de ese import.
import { createRequire } from "module";
const __req = createRequire(__filename);
try {
  const sp = __req.resolve("server-only");
  (__req as unknown as { cache: Record<string, unknown> }).cache[sp] = {
    id: sp, filename: sp, loaded: true, exports: {},
  };
} catch { /* noop */ }
import { PrismaClient } from "../src/generated/prisma";
// Import DINAMICO a proposito: los estaticos se resuelven antes del shim de
// arriba, asi que la cadena de `audioWordTimings` arrastraba `server-only` y
// el script moria antes de empezar. Cargado aqui, el shim ya esta puesto.
type Realinea = (id: string) => Promise<unknown>;
const p = new PrismaClient();
(async () => {
  const { generateWordTimingsForStory } =
    (await import("@/lib/audioWordTimings")) as { generateWordTimingsForStory: Realinea };
  // El journey se pasa por `--journey <id>`; sin el, el del A2 latam con el
  // que se escribio el script. `--slug <slug>` realinea una sola, para probar
  // antes de soltar las veintiuna.
  const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const journeyId = arg("--journey") ?? "cmtgelq560007j84n3ujx9bpd";
  const soloSlug = arg("--slug");
  const ss = await p.journeyStory.findMany({
    where: { journeyId, NOT: { audioUrl: null }, ...(soloSlug ? { slug: soloSlug } : {}) },
    select: { id: true, slug: true, text: true },
  });
  for (const s of ss) {
    const pars = (s.text || "").split(/\n\n+/).length;
    try { await generateWordTimingsForStory(s.id); console.log(`${s.slug.padEnd(26)} realineada · ${pars} parrafos`); }
    catch (e: any) { console.warn(`${s.slug.padEnd(26)} FALLO: ${e.message?.slice(0, 110)}`); }
  }
})().finally(() => p.$disconnect());
