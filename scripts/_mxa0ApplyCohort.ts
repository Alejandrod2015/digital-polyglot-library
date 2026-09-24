/** Aplica 20260922120000_journey_generation_cohort a mano: `prisma migrate
 *  deploy` esta cerrado por una migracion de julio que fallo y que no es mia
 *  para arreglar. Solo ALTER aditivo y cuatro UPDATE por id. */
import { PrismaClient } from '../src/generated/prisma';
import fs from 'fs';
const p = new PrismaClient();
(async () => {
  const sql = fs.readFileSync('prisma/migrations/20260922120000_journey_generation_cohort/migration.sql','utf8');
  const stmts = sql.split(';').map(s=>s.trim()).filter(s=>s && !s.split('\n').every(l=>l.trim().startsWith('--')));
  for (const s of stmts) {
    const limpio = s.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n').trim();
    if (!limpio) continue;
    const n = await p.$executeRawUnsafe(limpio);
    console.log(`ok (${n} fila/s): ${limpio.split('\n')[0]}`);
  }
  const js = await p.journey.findMany({ where: { generationCohort: { not: null } }, select: { id:true,name:true,variant:true,levels:true,status:true,generationCohort:true } });
  console.table(js.map(j=>({ j: `${j.name}/${j.variant}/${j.levels.join(',')}`, status: j.status, cohorte: j.generationCohort })));
  await p.$disconnect();
})();
