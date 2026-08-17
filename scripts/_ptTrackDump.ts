// Ejecuta la MISMA función que alimenta /api/mobile/journey y enseña qué
// tracks salen para portugués. Si aquí sale el track, el problema no es el
// constructor sino la entrega (caché o sesión). Solo lee.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

// `journeyData` importa módulos marcados `server-only`, que revientan fuera de
// Next. Neutralizamos ese guard y la caché de Next, que aquí no aplica.
import Module from "module";
const orig = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...a: unknown[]) => unknown })._load = function (
  request: string,
  ...rest: unknown[]
) {
  if (request === "server-only") return {};
  if (request === "next/cache") {
    return {
      unstable_cache: (fn: unknown) => fn,
      revalidateTag: () => undefined,
      revalidatePath: () => undefined,
    };
  }
  return orig.call(this, request, ...rest);
} as typeof orig;

async function main() {
  const { buildJourneyVariants } = await import("../src/app/journey/journeyData");
  for (const lang of ["Portuguese", "portuguese", "Spanish"]) {
    const tracks = await buildJourneyVariants(lang);
    console.log(`\n── language="${lang}" → ${tracks.length} track(s)`);
    for (const t of tracks) {
      const historias = t.levels.reduce(
        (n: number, l: { topics: Array<{ stories: unknown[] }> }) =>
          n + l.topics.reduce((m: number, tp) => m + tp.stories.length, 0),
        0
      );
      const temas = t.levels.reduce(
        (n: number, l: { topics: unknown[] }) => n + l.topics.length,
        0
      );
      console.log(`   id=${t.id} name=${(t as { name?: string }).name} variant=${t.variant} niveles=${t.levels.length} temas=${temas} historias=${historias}`);
    }
  }
}
main().catch((e) => {
  console.error("FALLÓ:", e instanceof Error ? e.message : e);
  process.exit(1);
});
