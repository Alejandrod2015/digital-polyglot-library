/** SOLO LECTURA. Prueba el modo journey-level del porton: el caso bueno y los
 *  cuatro que tienen que fallar. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded } from "../src/lib/topicEvidence";
const prisma = new PrismaClient();
const A = "dividing my year between Brazil and England";
const D = "dating a Brazilian";
const C = "Have day to day conversations";
const T7 = ["Traffic & Rented Rooms","Neighbours & Small Talk","Family Lunch & Invitations",
  "Favours & Small Debts","Trails & Guides","Diving & Island Rules","Offices & Appointments"]
  .map((label) => ({ label }));

async function caso(nombre: string, citas: string[], temas = T7, esperaFallo = true) {
  const log = console.log; console.log = () => {};
  let err = "";
  try { await assertTopicsGrounded({ language: "Portuguese", proposals: temas, journeyEvidence: citas, prisma }); }
  catch (e) { err = String((e as Error).message).split("\n").slice(0, 3).join(" "); }
  console.log = log;
  const ok = err ? "FALLA" : "PASA";
  const bien = esperaFallo ? (err ? "correcto" : "MAL: deberia fallar") : (err ? "MAL: deberia pasar" : "correcto");
  console.log(`${nombre.padEnd(46)} ${ok.padEnd(6)} ${bien}`);
  if (err) console.log(`    ${err.slice(0, 160)}`);
}

async function main() {
  await caso("bueno: 3 citas, 2 personas, 7 temas", [A, D, C], T7, false);
  await caso("una sola cita", [A]);
  await caso("dos citas de la MISMA persona (Alison)", [A, D]);
  await caso("una cita inventada", [A, C, "I want to move to Lisbon next year"]);
  await caso("7 citas para 7 temas", [A, D, C, A, D, C, A]);
  await caso("cita corta", [A, "travel"]);
}
main().catch((e) => console.error(String(e).slice(0, 500))).finally(() => prisma.$disconnect());
