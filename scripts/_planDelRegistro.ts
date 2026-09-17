/** Saca el plan de un tema del registro de cierres a un fichero, para poder
 *  recerrarlo con `cierraTema --plan`.
 *
 *  El plan que exige cierraTema (tipo, nivel, variante, registro, espina y las
 *  cuatro preguntas por historia) se guarda DENTRO de la entrada del registro
 *  al cerrar. Eso es lo que permite recerrar un tema cuyo fichero de plan vive
 *  en el arbol de otra sesion, como pasa con el B1 de portugues.
 *
 *  Uso: _planDelRegistro.ts <journeyId> <topic> */
import * as fs from "fs";

const [journeyId, topic] = process.argv.slice(2);
const registro = JSON.parse(fs.readFileSync("scripts/tema-cierres.json", "utf8")) as Record<string, { plan?: unknown }>;
const entrada = registro[`${journeyId}#${topic}`];
if (!entrada?.plan) {
  console.error(`sin plan guardado para ${journeyId}#${topic}`);
  process.exit(1);
}
fs.mkdirSync("scripts/_ptTitulos", { recursive: true });
const fichero = `scripts/_ptTitulos/${topic}.plan.json`;
fs.writeFileSync(fichero, `${JSON.stringify(entrada.plan, null, 2)}\n`);
console.log(fichero);
