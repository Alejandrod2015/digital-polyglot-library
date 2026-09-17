import { config } from "dotenv";
config({ path: ".env.local" });
import { writeFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const OUT = process.argv[2];
const borrar = process.argv.includes("--borrar");
async function main() {
  const s = await p.betaSignup.findFirst({
    where: { email: "thepelly1@gmail.com" },
    select: { id: true, notes: true },
  });
  if (!s) return console.log("no row");
  const n = s.notes ?? "";
  console.log(`notes: ${n.length} caracteres, ${n.split("\n").length} lineas`);
  if (OUT && n) { writeFileSync(OUT, n); console.log(`copia -> ${OUT}`); }
  if (!borrar) return console.log("(nada borrado, add --borrar)");
  await p.betaSignup.update({ where: { id: s.id }, data: { notes: null } });
  const after = await p.betaSignup.findUnique({ where: { id: s.id }, select: { notes: true } });
  console.log(`despues: ${after?.notes === null ? "null (vacio)" : `${after?.notes?.length} caracteres`}`);
}
main().finally(() => p.$disconnect());
