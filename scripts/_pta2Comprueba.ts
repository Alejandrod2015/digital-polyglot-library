/** Comprueba en la BASE si las cinco frases de la revision de arco siguen ahi
 *  o ya no. Solo lectura. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const J = "cmtrcpgso00073232h8vaf7na";
const p = new PrismaClient();
const VIEJAS = [
  "o real não era o dinheiro",
  "A caixinha do balcão diz",
  "bem viva de frio",
  "A aula fica educada",
  "no primeiro por engano; o caderno está lá",
];
const NUEVAS = [
  "o assunto real não era o dinheiro",
  "Um aviso na caixinha do balcão",
  "com o nariz vivo de frio",
  "escrevem devagar, educados, sem barulho",
  "No terceiro, o caderno está na poltrona",
];
(async () => {
  const ss = await p.journeyStory.findMany({ where: { journeyId: J }, select: { text: true } });
  const todo = ss.map((s) => s.text ?? "").join("\n");
  console.log("FRASES VIEJAS (deberian estar TODAS fuera):");
  for (const f of VIEJAS) console.log(`  ${todo.includes(f) ? "SIGUE" : "fuera"}  ${f}`);
  console.log("\nFRASES NUEVAS (deberian estar TODAS dentro):");
  for (const f of NUEVAS) console.log(`  ${todo.includes(f) ? "dentro" : "FALTA"}  ${f}`);
  await p.$disconnect();
})();
