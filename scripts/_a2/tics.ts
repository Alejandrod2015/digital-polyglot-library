import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const [id, et] of [["cmsvz6mz9000732gsgsfer0ko","A1 spain"],["cmt5x67ze000l320cpgunu5vi","B1 spain"],["cmt70xfyt000l3283gxd70wck","A2 spain (este)"]] as const) {
    const ss = await p.journeyStory.findMany({ where: { journeyId: id }, select: { text: true } });
    const t = ss.map((s) => s.text ?? "");
    const cuenta = (re: RegExp) => t.reduce((a, x) => a + (x.match(re)?.length ?? 0), 0);
    const enCuantas = (re: RegExp) => t.filter((x) => re.test(x)).length;
    console.log(`${et.padEnd(16)} guapa ${cuenta(/guapa/g)} (${enCuantas(/guapa/)} historias) · hija ${cuenta(/hija/g)} (${enCuantas(/hija/)}) · total vocativos ${cuenta(/guapa|hija|mujer|cariño,|nena/g)}`);
  }
})().finally(() => p.$disconnect());
