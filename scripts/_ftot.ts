import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main(){
 for (const b of ["spanish-friends","spanish-friends-spain-a0","spanish-traveler-latam","spanish-traveler-spain-a1","spanish-traveler-mexico-a0"]) {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: b } });
  let f=0,c=0,gm=0;
  for (const x of filas.filter(y=>y.slug!=="")) for (const e of Object.values(x.glosses as Record<string,any>)) { if(e.f)f++; if(e.c)c++; if(e.gm)gm++; }
  console.log(b.padEnd(30), "f:"+String(f).padStart(5), "c:"+String(c).padStart(5), "gm:"+String(gm).padStart(5));
 }
 await p.$disconnect();
}
main();
