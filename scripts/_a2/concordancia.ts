/** Busca el fallo que se colo al plantar superficies: un adjetivo masculino
 *  pegado a un sujeto femenino ("Rocio se sienta muy recto"). Heuristica
 *  tosca a proposito: da falsos positivos, pero saca a mano lo que ningun
 *  gate mira. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const FEM = "Irene|Rocío|Rosa|Marta|ella|la vecina|la panadera|la mujer|la empleada";
const ADJ_M = "recto|torcido|callado|tenso|seco|pesado|áspero|liso|firme|hondo|ancho|delicado|amable|débil|entero|perezoso|dormido|aburrido|preocupado|sucio|limpio|tibio|frío|espeso|tierno|sabroso|equivocado|valiente|cobarde|tímido|verdadero|solo|quieto|nuevo|viejo";
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmt70xfyt000l3283gxd70wck", text: { not: null } }, select: { slug: true, text: true } });
  const re = new RegExp(`\\b(${FEM})\\b(?:[^.“”]{0,45}?)\\b(${ADJ_M})\\b`, "gi");
  let n = 0;
  for (const s of st) for (const m of s.text!.matchAll(re)) { n++; console.log(`  ${s.slug}: …${m[0]}…`); }
  console.log(`${n} candidatos (leer a mano; muchos seran falsos positivos)`);
})().finally(() => p.$disconnect());
