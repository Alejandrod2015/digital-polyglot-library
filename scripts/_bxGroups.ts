import { config } from 'dotenv'
config({ path: '.env.local', quiet: true }); config({ path: '.env', quiet: true })
import { PrismaClient } from '../src/generated/prisma'
const p = new PrismaClient()
async function main(){
  const s = await p.betaSignup.findMany({
    where: { NOT: [{ email: { contains: 'betatest-' } }, { email: { contains: 'example.com' } }] },
    select:{ id:true, firstName:true, email:true, status:true, decision:true, targetLanguage:true, targetVariant:true,
      currentLevel:true, platform:true, weeklyHours:true, motivation:true, applicationReason:true, createdAt:true,
      invitedAt:true, ascInvitedAt:true, ascError:true, clerkUserId:true, planGrantedAt:true, lastActiveAt:true,
      emails: { select: { kind:true, sentAt:true } } },
    orderBy: { createdAt:'asc' } })
  console.log('### TODOS, con correos enviados')
  for (const x of s) {
    console.log(`${(x.firstName??'-').padEnd(16)} ${x.platform.padEnd(7)} ${x.targetLanguage.padEnd(11)} ${(x.targetVariant??'-').padEnd(10)} ${x.currentLevel.padEnd(12)} status=${x.status.padEnd(9)} alta=${x.createdAt.toISOString().slice(0,10)} asc=${x.ascInvitedAt?.toISOString().slice(0,10)??'-'} cuenta=${x.clerkUserId?'si':'NO'} ascErr=${x.ascError?'SI':'-'} correos=[${x.emails.map(e=>e.kind).join(',')}]`)
  }
  console.log('\n### PushCampaign')
  const pc = await p.pushCampaign.findMany({ select:{ id:true, createdAt:true } as any }).catch(()=>[])
  console.log('campañas:', (pc as any[]).length)
  const pushEv = await p.userMetric.groupBy({ by:['eventType'], where:{ eventType: { in: ['push_opened','resume_story_push_sent','reminder_scheduled','reminder_tapped','reminder_destination_opened'] } }, _count:true })
  console.log(JSON.stringify(pushEv))
  console.log('\n### Journeys publicados por idioma')
  const j = await p.journey.findMany({ where:{ status:'active' }, select:{ language:true, variant:true, levels:true } })
  const byLang: Record<string,string[]> = {}
  for (const x of j) (byLang[x.language] ??= []).push(`${x.variant}/${(x.levels||[]).join(',')}`)
  console.log(JSON.stringify(byLang, null, 1))
  await p.$disconnect()
}
main()
