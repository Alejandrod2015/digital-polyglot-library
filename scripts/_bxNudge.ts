import { config } from 'dotenv'
config({ path: '.env.local', quiet: true }); config({ path: '.env', quiet: true })
import { PrismaClient } from '../src/generated/prisma'
const p = new PrismaClient()
const CONS = ['story_opened','audio_play','audio_complete','vocab_clicked','practice_session_started']
async function main(){
  const s = await p.betaSignup.findMany({ where:{ clerkUserId:{ not:null } },
    select:{ firstName:true, clerkUserId:true, emails:{ select:{ kind:true, sentAt:true }, orderBy:{ sentAt:'asc' } } } })
  const ev = await p.userMetric.findMany({ where:{ userId:{ in: s.map(x=>x.clerkUserId!) }, eventType:{ in: CONS } },
    select:{ userId:true, createdAt:true }, orderBy:{ createdAt:'asc' } })
  console.log('persona | correo | enviado | ¿volvió después? | ultima actividad')
  for (const u of s){
    const mine = ev.filter(e=>e.userId===u.clerkUserId)
    const last = mine.length ? mine[mine.length-1].createdAt : null
    for (const em of u.emails.filter(e=>['improvement','install_nudge','feedback_ask','mid_survey','final_survey'].includes(e.kind))){
      const after = mine.filter(e=> e.createdAt > em.sentAt).length
      console.log(`${(u.firstName??'-').padEnd(14)} | ${em.kind.padEnd(13)} | ${em.sentAt.toISOString().slice(0,16)} | ${after ? 'SI ('+after+' eventos)' : 'no'} | ${last?.toISOString().slice(0,10) ?? '-'}`)
    }
  }
  await p.$disconnect()
}
main()
