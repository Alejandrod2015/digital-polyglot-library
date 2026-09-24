/** Calibra el suelo A0 espanol contra el A0 que ya esta publicado. */
import { PrismaClient } from '../src/generated/prisma';
import { validateJourneyStories } from '../src/lib/validateJourneyStories';
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { language:'spanish', levels:{has:'a0'}, status:{not:'archived'} }, select:{id:true,name:true,variant:true} });
  for (const j of js) {
    const st = await p.journeyStory.findMany({ where: { journeyId: j.id, text: { not: null } }, select: { slug:true,title:true,text:true,vocab:true,topic:true } });
    if (!st.length) { console.log(`${j.name}/${j.variant}: sin texto`); continue; }
    const r = validateJourneyStories(st.map(s=>({ slug:String(s.slug??''), title:String(s.title??''), text:String(s.text??''), vocab:s.vocab as never, language:'ES', level:'A0', topic:s.topic })), { language:'ES', level:'A0', conjuntoCompleto:true } as never);
    const f = r.find(c=>c.id==='journey-a0-floor');
    console.log(`\n${j.name}/${j.variant} (${st.length} historias): ${f?.status}`);
    if (f?.detail) console.log('  ' + f.detail.split(' | ').join('\n  '));
  }
  await p.$disconnect();
})();
