import { PrismaClient } from '../src/generated/prisma';
import { variantPool } from '../packages/domain/src/languageVariant';
const p = new PrismaClient();
const PORTABLES = new Set(['verb','adjective','adverb','expression']);
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journey: { language: 'spanish', status: { not: 'archived' } } },
    select: { vocab: true, journey: { select: { typeSlug:true, levels:true, variant:true, name:true } } },
  });
  const miPool = variantPool('mexico');
  console.log('pool de mexico =', miPool);
  const duro = new Set<string>(); const tope2 = new Set<string>();
  const porJourney: Record<string, Set<string>> = {};
  for (const r of rows) {
    const jv = r.journey?.variant; if (variantPool(jv) !== miPool) continue;
    const mismoTipo = r.journey?.typeSlug === 'friends' || r.journey?.name === 'Friends';
    const mismoNivel = (r.journey?.levels ?? []).some(l => String(l).toLowerCase() === 'a0');
    const key = `${r.journey?.name}/${jv}/${(r.journey?.levels??[]).join(',')}`;
    porJourney[key] ??= new Set();
    for (const v of ((r.vocab as any[]) ?? [])) {
      if (!v?.word) continue;
      const portable = PORTABLES.has(String(v.type ?? '').toLowerCase());
      if (portable) continue;
      porJourney[key].add(String(v.word));
      if (mismoTipo && !mismoNivel) continue;
      (mismoTipo ? duro : tope2).add(String(v.word));
    }
  }
  console.log('\nANCLADAS por journey del pool:');
  for (const [k,v] of Object.entries(porJourney)) console.log(`  ${k}: ${v.size}`);
  console.log('\nCERO (mismo tipo Friends + nivel a0):', duro.size, [...duro].slice(0,50).join(', '));
  console.log('\nTOPE-2 (otros tipos, ancladas):', tope2.size);
  require('fs').writeFileSync('scripts/_mxa0-bloqueadas.json', JSON.stringify({ cero:[...duro].sort(), tope2:[...tope2].sort() }, null, 1));
  console.log('escrito scripts/_mxa0-bloqueadas.json');
  await p.$disconnect();
})();
