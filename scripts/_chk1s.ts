import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main(){
 const mal: string[] = [];
 for (const b of ["spanish-friends","spanish-friends-spain-a0","spanish-traveler-latam","spanish-traveler-spain-a1","spanish-traveler-mexico-a0"]) {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: b } });
  const vistos = new Set<string>();
  for (const x of filas.filter(y=>y.slug!=="")) for (const [w,e] of Object.entries(x.glosses as Record<string,any>)) {
    const lem = e.f?.lemma as string | undefined;
    if (!lem || vistos.has(b+lem)) continue;
    vistos.add(b+lem);
    const inf = lem.replace(/ \(.*\)$/, "");
    const yo = e.f.rows[0]?.[1] as string;
    if (/[aeiouáéíóú]c(er|ir)$/.test(inf) && !/zco$/.test(yo)) mal.push(`${b} ${w} ${lem} -> yo ${yo}`);
    if (/(iar|uar) \(/.test(lem) || /^(sintiar|valiar|decidiar|escribiar|peguar)/.test(lem)) mal.push(`${b} ${w} LEMA INVENTADO ${lem}`);
    if (["salir","caer","traer","poner","valer","oír","oir","salirse"].includes(inf) && !/g[oó]$/.test(yo)) mal.push(`${b} ${w} ${lem} -> yo ${yo}`);
  }
 }
 console.log(mal.length ? mal.join("\n") : "sin primeras personas mal formadas");
 await p.$disconnect();
}
main();
