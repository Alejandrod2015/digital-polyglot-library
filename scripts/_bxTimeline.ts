import { config } from 'dotenv'
config({ path: '.env.local', quiet: true }); config({ path: '.env', quiet: true })
import { PrismaClient } from '../src/generated/prisma'
const p = new PrismaClient()
async function main(){
  const s = await p.betaSignup.findMany({ where:{ clerkUserId:{ not:null } },
    select:{ id:true, firstName:true, email:true, targetLanguage:true, targetVariant:true, currentLevel:true,
      platform:true, weeklyHours:true, status:true, createdAt:true, ascInvitedAt:true, planGrantedAt:true,
      currentApps:true, motivation:true, applicationReason:true, clerkUserId:true,
      emails:{ select:{ kind:true, sentAt:true }, orderBy:{ sentAt:'asc' } } } })
  const ev = await p.userMetric.findMany({ where:{ userId:{ in: s.map(x=>x.clerkUserId!) } },
    select:{ userId:true, eventType:true, storySlug:true, metadata:true, createdAt:true }, orderBy:{ createdAt:'asc' } })
  const byU = new Map<string, any[]>(); for(const e of ev){ if(!byU.has(e.userId)) byU.set(e.userId,[]); byU.get(e.userId)!.push(e) }
  const light = s.filter(x => { const c = byU.get(x.clerkUserId!)??[]; return !c.some(e=>['story_opened','audio_play','vocab_clicked','audio_complete'].includes(e.eventType)) })
  console.log('=== LOS QUE NO ABRIERON NADA ===')
  for (const u of light){
    console.log(`\n## ${u.firstName} <${u.email}> ${u.targetLanguage}/${u.targetVariant??'-'} ${u.currentLevel} ${u.platform} horas=${u.weeklyHours}`)
    console.log(`   apps previas: ${u.currentApps ?? '-'} | motivo: ${u.motivation ?? '-'}`)
    console.log(`   razon: ${(u.applicationReason??'-').replace(/\s+/g,' ').slice(0,200)}`)
    console.log(`   invitada ASC ${u.ascInvitedAt?.toISOString().slice(0,16) ?? '-'} | plan ${u.planGrantedAt?.toISOString().slice(0,16) ?? '-'}`)
    console.log(`   correos: ${u.emails.map(e=>`${e.kind}@${e.sentAt.toISOString().slice(5,10)}`).join(', ') || 'ninguno'}`)
    for (const e of (byU.get(u.clerkUserId!)??[]))
      console.log(`     ${e.createdAt.toISOString().slice(0,16)} ${e.eventType} ${JSON.stringify(e.metadata ?? {}).slice(0,140)}`)
  }
  console.log('\n\n=== CORREOS RECIBIDOS POR TODOS LOS 21 ===')
  for (const u of s) console.log(`${(u.firstName??'-').padEnd(14)} ${u.emails.map(e=>e.kind).join(',') || 'ninguno'}`)
  await p.$disconnect()
}
main()
