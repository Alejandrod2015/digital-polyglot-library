/**
 * rulesFor: la puerta que CARGA las reglas de un dominio (I2).
 *
 *   npx tsx scripts/rulesFor.ts story vocab
 *   npx tsx scripts/rulesFor.ts audio --solo-sin-gate
 *   npx tsx scripts/rulesFor.ts --dominios
 *
 * Las skills empiezan ejecutando esto. El chat no recita las reglas de
 * memoria: las lee del inventario, que es lo unico que esta al dia porque lo
 * genera scripts/buildRulesInventory.ts y lo vigila npm run lint:rules-inventory.
 *
 * El orden de la salida no es decorativo. Primero lo que un gate va a
 * comprobar de todas formas (si lo rompes, te para una maquina); despues los
 * pasos de proceso; al final las que NO comprueba nadie, que son las unicas
 * que dependen de que quien escribe se acuerde, y por eso van las ultimas y
 * marcadas.
 */
import { leerInventario, type Dominio, type FilaRegla } from "./rulesInventoryLib";

const DOMINIOS: Dominio[] = [
  "story", "vocab", "audio", "cover", "journey", "practice", "comms", "process",
];

function imprime(titulo: string, filas: FilaRegla[], conGate: boolean): void {
  if (!filas.length) return;
  console.log(`\n${titulo} (${filas.length})`);
  for (const f of filas.sort((a, b) => a.id.localeCompare(b.id)))
    console.log(`  - ${f.rule}${conGate ? `  [${f.gate}]` : ""}`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--dominios") || !args.length) {
    const inv = leerInventario();
    console.log("dominios del inventario (docs/rules-inventory.json):");
    for (const d of DOMINIOS) {
      const n = inv.rules.filter((r) => r.domain === d).length;
      console.log(`  ${d.padEnd(9)} ${String(n).padStart(3)} reglas`);
    }
    console.log("\n  npx tsx scripts/rulesFor.ts <dominio> [<dominio>...]");
    if (!args.length) process.exitCode = 2;
    return;
  }

  const soloSinGate = args.includes("--solo-sin-gate");
  const pedidos = args.filter((a) => !a.startsWith("--"));
  const malos = pedidos.filter((d) => !DOMINIOS.includes(d as Dominio));
  if (malos.length) {
    console.error(`rulesFor: dominio desconocido: ${malos.join(", ")}`);
    console.error(`  validos: ${DOMINIOS.join(", ")}`);
    process.exit(2);
  }

  const inv = leerInventario();
  for (const d of pedidos as Dominio[]) {
    const filas = inv.rules.filter((r) => r.domain === d);
    console.log(`\n══ ${d.toUpperCase()} · ${filas.length} reglas del inventario ══`);
    const sinGate = filas.filter((f) => f.gate === "none");
    if (soloSinGate) {
      imprime("SIN GATE: no las comprueba nadie", sinGate, false);
      continue;
    }
    imprime("Con gate: una maquina las comprueba", filas.filter((f) => f.gate !== "none" && f.gate !== "process"), true);
    imprime("Proceso: pasos obligatorios que no se pueden codificar", filas.filter((f) => f.gate === "process"), false);
    imprime("SIN GATE: si te la saltas no salta nada. Leelas dos veces", sinGate, false);
  }
  console.log(
    "\nFuente: docs/rules-inventory.json. Si falta una regla, se anade AHI " +
    "(scripts/buildRulesInventory.ts), no en el mensaje."
  );
}

main();
