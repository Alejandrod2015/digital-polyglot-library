import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const JID = "cmubidgaf0007j8np6g7n89iu";
  const st = await p.journeyStory.findMany({ where: { journeyId: JID }, orderBy: [{topic:"asc"},{slotIndex:"asc"}],
    select: { slug:true, topic:true, slotIndex:true, practiceSet: { select: { _count: { select: { exercises: true } }, exercises: { select: { featured: true, type: true } } } } } });
  let tot=0, feat=0;
  const tipos: Record<string, number> = {};
  for (const s of st) {
    const ex = s.practiceSet?.exercises ?? [];
    tot += ex.length; feat += ex.filter(e=>e.featured).length;
    for (const e of ex) tipos[e.type] = (tipos[e.type]??0)+1;
    console.log(`${(s.slug??"").padEnd(32)} ${String(ex.length).padStart(3)} ej · ${ex.filter(e=>e.featured).length} featured`);
  }
  console.log(`\nTOTAL ${tot} ejercicios, ${feat} featured · tipos: ${JSON.stringify(tipos)}`);
  const capa = await p.tapGlossSet.findMany({ where: { bundle: "german-friends-a2" }, select: { slug:true, glosses:true } });
  let entradas=0, conC=0, conCs=0, cs=0;
  for (const c of capa) { if(!c.slug) continue; for (const v of Object.values(c.glosses as Record<string,any>)) { entradas++; if(v.c) conC++; if(v.cs){conCs++; cs+=v.cs.length;} } }
  console.log(`glosas: ${entradas} entradas de historia, ${conC} con trozo, ${conCs} con lista, ${conC+cs} trozos en total`);
  await p.$disconnect();
})();
