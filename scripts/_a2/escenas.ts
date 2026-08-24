/** En que SITIOS pasa cada journey. Cuenta cuantas de las 21 mencionan cada
 *  escenario, para ver si el A2 repite el decorado del A1 o abre otro. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const ESC: Array<[string, RegExp]> = [
  ["bar", /\bbar(?:ra)?\b/i], ["panadería", /panader|\bhorno\b|\bmasa\b/i], ["farmacia", /farmacia|botiqu|pastill|venda/i],
  ["escalera/rellano", /escalera|rellano|portal|pisos?\b/i], ["mercado/pescadería", /mercado|pescader|frutería|puesto/i],
  ["cocina de casa", /cocina|fregadero|cazuela|olla|sartén|cuchara/i], ["huerto/monte", /huerto|sendero|cerro|barranco|prado|arboleda|loma|huerta/i],
  ["playa/mar", /\bplaya\b|\bmar\b|orilla|sombrilla/i], ["oficina/papeles", /escritorio|archivador|credencial|carpeta|sellos|bolígrafo/i],
  ["calle/plaza", /\bcalle\b|\bplaza\b|cuesta|acera|bordillo/i],
];
(async () => {
  const filas: Record<string, Record<string, number>> = {};
  for (const [id, et] of [["cmsvz6mz9000732gsgsfer0ko","A1"],["cmt70xfyt000l3283gxd70wck","A2"],["cmt5x67ze000l320cpgunu5vi","B1"]] as const) {
    const st = await p.journeyStory.findMany({ where: { journeyId: id, text: { not: null } }, select: { title: true, text: true } });
    filas[et] = {};
    for (const [n, re] of ESC) filas[et][n] = st.filter((s) => re.test(`${s.title} ${s.text}`)).length;
  }
  console.log(`| Escenario | A1 | A2 | B1 |`);
  console.log(`|---|---|---|---|`);
  for (const [n] of ESC) console.log(`| ${n} | ${filas.A1[n]} | ${filas.A2[n]} | ${filas.B1[n]} |`);
})().finally(() => p.$disconnect());
