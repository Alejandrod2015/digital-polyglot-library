import { config } from 'dotenv'
config({ path: '.env.local', quiet: true }); config({ path: '.env', quiet: true })
import { PrismaClient } from '../src/generated/prisma'
const p = new PrismaClient()
async function main(){
  console.log('BetaRelease rows:', await p.betaRelease.count())
  const gs = await p.tapGlossSet.groupBy({ by:['bundle','language','variant'], _count:true, _max:{ updatedAt:true } })
  console.log('\ncapa de glosas por bundle:')
  for (const g of gs.sort((a:any,b:any)=> String(a.bundle).localeCompare(String(b.bundle))))
    console.log(`  ${g.bundle} ${g.language ?? '-'}/${g.variant ?? '-'}: ${g._count} filas, ultimo ${g._max.updatedAt?.toISOString().slice(0,10)}`)
  await p.$disconnect()
}
main()
