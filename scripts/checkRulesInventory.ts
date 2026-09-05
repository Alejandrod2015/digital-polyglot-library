/**
 * lint:rules-inventory
 *
 * El inventario maestro (docs/rules-inventory.json) es la lista de reglas duras
 * del proyecto, cada una con su gate declarado. Este lint lo vigila en las tres
 * direcciones en que se puede pudrir:
 *
 *   1. FANTASMAS. Todo `gate` citado tiene que existir en el arbol. Prometer
 *      una red que no esta es peor que admitir que no hay ninguna. Misma logica
 *      (y mismo lookbehind) que scripts/checkHardRules.ts.
 *   2. HUERFANOS. Todo check implementado en validateGeneratedStory.ts y en
 *      validateJourneyStories.ts tiene que tener fila. Es la direccion inversa:
 *      un check que nadie documenta es una regla que solo conoce el codigo.
 *   3. TRINQUETE DE `none`. El numero de filas sin gate solo puede BAJAR. La
 *      deuda de hoy no bloquea (seria un lint rojo desde el minuto cero, que se
 *      ignora); lo que bloquea es sumar una regla sin gate.
 *
 *   npm run lint:rules-inventory
 *   npm run lint:rules-inventory -- --apretar   (baja la linea base a lo de hoy)
 *
 * No necesita ni base de datos ni memoria: el inventario esta commiteado. Para
 * regenerarlo desde las fuentes, scripts/buildRulesInventory.ts.
 */
import * as fs from "fs";
import * as path from "path";
import { REPO, INVENTARIO, checksImplementados, gateFantasma, leerInventario } from "./rulesInventoryLib";

const BASELINE = path.join(REPO, "docs", "rules-inventory-baseline.json");

type Base = { none: number; huerfanos: string[] };

function leerBase(): Base {
  try {
    const b = JSON.parse(fs.readFileSync(BASELINE, "utf8")) as Partial<Base>;
    return { none: b.none ?? 0, huerfanos: b.huerfanos ?? [] };
  } catch {
    return { none: 0, huerfanos: [] };
  }
}

function main() {
  if (!fs.existsSync(INVENTARIO)) {
    console.error(`rules-inventory: falta ${path.relative(REPO, INVENTARIO)}. Siembralo:`);
    console.error("  npx tsx scripts/buildRulesInventory.ts");
    process.exit(1);
  }
  const inv = leerInventario();
  const filas = inv.rules;

  // Sin filas es "pasar en vacio", que es el fallo que estos lints existen para
  // impedir: un inventario vacio no es un inventario limpio.
  if (!filas.length) {
    console.error("rules-inventory: el inventario esta vacio. Regeneralo con scripts/buildRulesInventory.ts.");
    process.exit(1);
  }

  const errores: string[] = [];

  // ── 1. Fantasmas ────────────────────────────────────────────
  const fantasmas: string[] = [];
  for (const f of filas) {
    const mal = gateFantasma(f.gate);
    if (mal) fantasmas.push(`  ${f.id}\n    gate "${f.gate}": ${mal}`);
  }
  if (fantasmas.length)
    errores.push(`${fantasmas.length} fila(s) citan un gate que NO existe:\n` + fantasmas.join("\n"));

  // ── 2. Checks huerfanos ─────────────────────────────────────
  const conFila = new Set<string>();
  for (const f of filas) {
    conFila.add(f.id);
    const m = /#([a-z0-9-]+)$/.exec(f.gate);
    if (m) conFila.add(m[1]);
  }
  const base = leerBase();
  const huerfanos: string[] = [];
  for (const [fichero, ids] of checksImplementados())
    for (const id of ids) if (!conFila.has(id)) huerfanos.push(`${id} (${fichero})`);
  const huerfanosNuevos = huerfanos.filter((h) => !base.huerfanos.includes(h.split(" ")[0]));
  if (huerfanosNuevos.length)
    errores.push(
      `${huerfanosNuevos.length} check(s) implementados sin fila en el inventario:\n` +
      huerfanosNuevos.map((h) => `  ${h}`).join("\n") +
      "\n  Regenera el inventario: npx tsx scripts/buildRulesInventory.ts"
    );

  // ── 3. Trinquete de "none" ──────────────────────────────────
  const sinGate = filas.filter((f) => f.gate === "none");
  const proceso = filas.filter((f) => f.gate === "process");
  const conGate = filas.length - sinGate.length - proceso.length;

  console.log(
    `rules-inventory: ${filas.length} filas · ${conGate} con gate · ${proceso.length} de proceso · ${sinGate.length} sin gate`
  );

  if (process.argv.includes("--apretar")) {
    fs.writeFileSync(
      BASELINE,
      JSON.stringify({ none: sinGate.length, huerfanos: huerfanos.map((h) => h.split(" ")[0]) }, null, 2) + "\n"
    );
    console.log(`rules-inventory: linea base apretada a ${sinGate.length} sin gate (antes ${base.none}).`);
    return;
  }

  if (sinGate.length > base.none)
    errores.push(
      `el trinquete de "none" solo baja: hay ${sinGate.length} filas sin gate y la linea base es ${base.none}.\n` +
      "  Dale gate a la regla nueva, o declarala 'process' si es un paso del proceso que no se puede codificar.\n" +
      "  Sin gate quiere decir que hoy no la comprueba nadie, y eso ya no puede crecer."
    );

  if (!errores.length) {
    if (sinGate.length < base.none)
      console.log(
        `rules-inventory: ${base.none - sinGate.length} regla(s) menos sin gate. Aprieta el trinquete:\n` +
        "  npm run lint:rules-inventory -- --apretar"
      );
    else console.log("rules-inventory: limpio");
    return;
  }

  console.error("");
  for (const e of errores) console.error("rules-inventory: " + e + "\n");
  process.exit(1);
}

main();
