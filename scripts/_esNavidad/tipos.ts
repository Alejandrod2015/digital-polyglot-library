import { PrismaClient } from '../../src/generated/prisma'
const p = new PrismaClient()
p.journeyType.findMany().then(ts => { ts.forEach((t:any)=>console.log(t.slug, '|', t.label ?? '', '|', t.name ?? '')) }).finally(()=>p.$disconnect())
