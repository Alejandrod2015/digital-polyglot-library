/**
 * LINT: ningun push sube codigo que el build de Vercel vaya a rechazar por
 * tipos.
 *
 * WHY (2026-09-07): el batch de cuatro ramas paso los doce lints del pre-push
 * y aun asi quemo un build (dpl_29ZinKWr): dos ramas tocaron el mismo bloque
 * de src/lib/validateJourneyStories.ts, el merge textual cuadro y el choque
 * era SEMANTICO (una rama quito el campo `word` que la otra usaba). Ningun
 * candado corria tsc, asi que el primer typecheck del batch fue el de Vercel,
 * que cuesta un build. Una regla sin gate no es una regla.
 *
 * Que comprueba: `tsc --noEmit` sobre tsconfig.typegate.json, que es el
 * tsconfig del proyecto MENOS los tests (src/**\/__tests__, *.test.ts).
 * Se excluyen porque el typecheck del build de Vercel no los frena (hay
 * deuda de tipos vieja en tests que todos los builds verdes han ignorado);
 * este lint imita lo que de verdad decide el deploy, no un ideal.
 *
 * Antes de medir regenera el cliente de Prisma si el schema es mas nuevo que
 * lo generado: sin eso, un enum recien anadido al schema (el caso `comp` de
 * BillingSource) da errores falsos en local que Vercel no tendria, porque
 * Vercel siempre genera.
 *
 * Run: npm run lint:types
 * Exit: 0 limpio, 1 con los errores de tsc.
 */
import { spawnSync } from "child_process";
import * as fs from "fs";

const nuevoQue = (a: string, b: string) => {
  try {
    return fs.statSync(a).mtimeMs > fs.statSync(b).mtimeMs;
  } catch {
    return true;
  }
};

if (nuevoQue("prisma/schema.prisma", "src/generated/prisma/index.d.ts")) {
  const gen = spawnSync("npx", ["--no-install", "prisma", "generate"], { stdio: "ignore" });
  if (gen.status !== 0)
    console.error("types: prisma generate fallo; mido con el cliente que haya.");
}

const r = spawnSync("npx", ["--no-install", "tsc", "--noEmit", "-p", "tsconfig.typegate.json"], {
  stdio: "inherit",
});
if (r.status !== 0) {
  console.error("\ntypes: el build de Vercel rechazaria esto. Arregla los errores de arriba.");
  process.exit(1);
}
console.log("types: limpio (tsc --noEmit, proyecto sin tests)");
