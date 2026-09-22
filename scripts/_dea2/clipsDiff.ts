/** SOLO LEE. Compara los clipUrl que hay en la BASE con los que trae el JSON
 *  de scripts/_sets, por historia de un journey. Resembrar desde un JSON con
 *  menos clips que la base los BORRA (incidente del 2026-09-18). */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const jid = process.argv[2];
  const st = await p.journeyStory.findMany({ where: { journeyId: jid },
    select: { slug:true, practiceSet: { select: { exercises: { select: { word:true, type:true, payload:true } } } } } });
  let peor = 0;
  for (const s of st.sort((a,b)=>a.slug!.localeCompare(b.slug!))) {
    const ex = s.practiceSet?.exercises ?? [];
    const enBase = ex.filter(e => ((e.payload as any)?.audioClip)?.clipUrl).length;
    const f = `scripts/_sets/${s.slug}.json`;
    if (!fs.existsSync(f)) { console.log(`${s.slug!.padEnd(34)} base=${String(enBase).padStart(3)} · SIN FICHERO`); continue; }
    const js = JSON.parse(fs.readFileSync(f, "utf8")) as any[];
    const enJson = js.filter(e => e.payload?.audioClip?.clipUrl).length;
    const delta = enJson - enBase;
    if (delta < peor) peor = delta;
    console.log(`${s.slug!.padEnd(34)} base=${String(enBase).padStart(3)} json=${String(enJson).padStart(3)} ${delta < 0 ? `PERDERIA ${-delta}` : "ok"}`);
  }
  console.log(`\npeor caso: ${peor === 0 ? "ningun clip se pierde" : `se perderian ${-peor} clips en una historia`}`);
  await p.$disconnect();
})();
