import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// Estos 11 modulos crean un cliente (OpenAI, Clerk) que necesita
// process.env.*. Un script que hace `import { config } from "dotenv";
// config(...)` seguido de un `import` de alguno de ellos cree que el dotenv
// corre primero porque esta escrito antes; no corre, los import se izan, asi
// que el modulo se carga con el entorno TODAVIA vacio. Si esa lectura pasa en
// SCOPE DE CARGA (top-level, columna 0), el cliente queda construido con la
// clave vacia para siempre; si pasa DENTRO de una funcion, cada llamada lee
// el entorno ya cargado y el orden de import deja de importar.
//
// Medido en el Friends ES A2 (2026-09-17, commit 5e5ecbf6): con el patron
// viejo, 0 caracteres de audioSegments; con la lectura perezosa, 164. Ver
// scripts/_loadEnv.ts y scripts/__tests__/loadEnvFirst.test.ts (el mismo
// problema, del lado de los scripts que narran).
const MODULES = [
  "elevenlabs.ts",
  "betaReleases.ts",
  "billingClerk.ts",
  "weeklyDigest.ts",
  "storyDedupe.ts",
  "journeyBridgePush.ts",
  "metricsUserEmails.ts",
  "duplicateAccountCandidates.ts",
  "storyLevelAudit.ts",
  "betaProgram.ts",
  "storyGenerator.ts",
];

/**
 * Solo las DOS claves que dotenv carga desde .env.local y que un cliente
 * construye al arrancar (OPENAI_API_KEY, CLERK_SECRET_KEY). Otras lecturas de
 * process.env en columna 0 (p.ej. HOME, que pone el sistema operativo antes
 * de que arranque cualquier proceso) no dependen del orden de dotenv y no son
 * la regresion que este test existe para cazar; marcarlas seria ruido.
 */
const CLIENT_KEYS = /process\.env\.(OPENAI_API_KEY|CLERK_SECRET_KEY)\b/;

/** Lineas de CODIGO (no comentarios) en columna 0: ahi vive una declaracion
 *  de modulo, y es exactamente donde `let _openai`/`let _clerkClient` y su
 *  getter perezoso tienen que estar en vez de un cliente construido a fuego. */
function moduleScopeProcessEnvLines(src: string): string[] {
  return src
    .split(/\r?\n/)
    .filter((line) => /^[A-Za-z_$]/.test(line)) // columna 0, no espacio/comentario/cierre de bloque
    .filter((line) => !/^\/\//.test(line))
    .filter((line) => CLIENT_KEYS.test(line));
}

describe("los clientes de OpenAI/Clerk leen process.env perezosos, no en scope de carga", () => {
  for (const f of MODULES) {
    it(`${f} no lee process.env en columna 0`, () => {
      const src = readFileSync(path.join(__dirname, "..", f), "utf8");
      const offenders = moduleScopeProcessEnvLines(src);
      expect(offenders).toEqual([]);
    });
  }

  it("los getters perezosos siguen presentes (no se borraron sin querer)", () => {
    const withOpenAI = ["elevenlabs.ts", "storyDedupe.ts", "storyLevelAudit.ts", "storyGenerator.ts"];
    const withClerk = [
      "betaReleases.ts", "billingClerk.ts", "weeklyDigest.ts", "journeyBridgePush.ts",
      "metricsUserEmails.ts", "duplicateAccountCandidates.ts", "betaProgram.ts",
    ];
    for (const f of withOpenAI) {
      const src = readFileSync(path.join(__dirname, "..", f), "utf8");
      expect(src).toMatch(/function getOpenAI\(\)/);
    }
    for (const f of withClerk) {
      const src = readFileSync(path.join(__dirname, "..", f), "utf8");
      expect(src).toMatch(/function getClerkClient\(\)/);
    }
  });
});
