/**
 * `server-only` es un fence de Next para React Server Components: tira al
 * importarse fuera de uno. Varios scripts del repo llegan a `src/lib/prisma`,
 * que lo importa, y por eso no se pueden correr sueltos. Vitest ya lo aliasa
 * por la misma razon (vitest.config.ts); esto hace lo mismo para tsx.
 *
 *   NODE_OPTIONS="--require ./scripts/_serverOnlyShim.cjs" npx tsx <script>
 */
const Module = require("module");
const load = Module._load;
Module._load = function (request, ...rest) {
  if (request === "server-only") return {};
  return load.call(this, request, ...rest);
};
