// ¿Qué reglas del spec NO tienen un check que las respalde?
//
// POR QUÉ (2026-08-14): el spec pedía habla citada en la prosa narrada y no
// había ningún check que lo comprobara, porque los tres que miran diálogo están
// exentos en perfil narrador. Resultado: dos journeys enteros mudos en
// producción. Este audit busca el resto de reglas escritas que nadie verifica.
//
//   npx tsx scripts/_specCoverageAudit.ts
import { readFileSync } from "fs";

const SPEC = "docs/story-quality-spec.md";
const VALIDATOR = "src/lib/validateGeneratedStory.ts";
const SAVE = "scripts/saveStory.ts";

const spec = readFileSync(SPEC, "utf8");
const validador = readFileSync(VALIDATOR, "utf8");
const save = readFileSync(SAVE, "utf8");

// IDs de check realmente implementados.
const implementados = new Set(
  Array.from(validador.matchAll(/id:\s*"([a-z0-9-]+)"/g)).map((m) => m[1])
);
// IDs citados en el spec.
const citados = new Set(
  Array.from(spec.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+){1,4})`/g))
    .map((m) => m[1])
    .filter((x) => /-/.test(x) && !x.endsWith(".ts") && !x.includes("/"))
);

const soloSpec = [...citados].filter((c) => !implementados.has(c));
const soloCodigo = [...implementados].filter((c) => !citados.has(c));

console.log(`checks implementados: ${implementados.size} · ids citados en el spec: ${citados.size}\n`);

console.log("── Citados en el spec pero NO implementados (posible regla huérfana)");
for (const c of soloSpec) console.log(`   ${c}`);
if (!soloSpec.length) console.log("   (ninguno)");

console.log("\n── Implementados pero NO citados en el spec (regla sin documentar)");
for (const c of soloCodigo) console.log(`   ${c}`);
if (!soloCodigo.length) console.log("   (ninguno)");

// Reglas normativas sin ningún check citado cerca: el patrón exacto del fallo.
console.log("\n── Frases normativas del spec SIN check citado en su párrafo");
const NORMATIVO = /\b(MUST|NEVER|siempre|nunca|debe|required|hard rule|no debe)\b/i;
const bloques = spec.split(/\n(?=[#\-*]|\n)/);
let n = 0;
for (const b of bloques) {
  const linea = b.trim().replace(/\s+/g, " ");
  if (linea.length < 60 || !NORMATIVO.test(linea)) continue;
  if (/`[a-z0-9]+-[a-z0-9-]+`/.test(b)) continue; // cita un check: cubierto
  n++;
  if (n <= 25) console.log(`   • ${linea.slice(0, 165)}`);
}
console.log(`\n   ${n} párrafos normativos sin check citado (mostrados los primeros 25)`);
