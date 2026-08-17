// Lanzador de scripts/_rerollSection.ts fuera de Next.
//
// `_rerollSection` importa src/lib/elevenlabs, que arrastra src/lib/prisma y
// con él el sello `server-only`, que revienta al ejecutarse desde tsx. Este
// wrapper neutraliza SOLO ese sello y delega en el script real: la síntesis, el
// time-stretch y el GATE F0 (scripts/_f0gate.py, modo statement) siguen
// ocurriendo dentro de _rerollSection.ts sin cambio alguno.
//
// Uso idéntico al del script real:
//   npx tsx scripts/_rerollSectionRun.ts <slug> <fragmentIndex> [--takes 3] [--apply]
import Module from "module";

const orig = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...a: unknown[]) => unknown })._load = function (
  request: string,
  ...rest: unknown[]
) {
  if (request === "server-only") return {};
  return orig.call(this, request, ...rest);
} as typeof orig;

// `await` de primer nivel no compila al formato CJS que usa tsx aquí, así que
// la importación va dentro de una función asíncrona.
void (async () => {
  await import("./_rerollSection");
})();
