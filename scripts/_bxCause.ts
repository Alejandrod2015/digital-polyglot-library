import { config } from 'dotenv'
config({ path: '.env.local', quiet: true }); config({ path: '.env', quiet: true })
import { PrismaClient } from '../src/generated/prisma'
const p = new PrismaClient()
const DAY=86400000
const CONS = new Set(['story_opened','audio_play','audio_pause','audio_complete','continue_listening','vocab_clicked','practice_session_started','practice_session_completed','practice_recommended_mode_opened','journey_topic_opened','journey_story_read','story_rated','practice_rated','speed_change','seek'])
async function main(){
  const s = await p.betaSignup.findMany({ where: { NOT: [{ email: { contains: 'betatest-' } }, { email: { contains: 'example.com' } }] },
    select:{ firstName:true, email:true, status:true, platform:true, targetLanguage:true, targetVariant:true, currentLevel:true,
      weeklyHours:true, createdAt:true, invitedAt:true, ascInvitedAt:true, clerkUserId:true, emails:{select:{kind:true,sentAt:true}} } })
  const ev = await p.userMetric.findMany({ where:{ userId:{ in: s.filter(x=>x.clerkUserId).map(x=>x.clerkUserId!) } },
    select:{ userId:true, eventType:true, storySlug:true, createdAt:true }, orderBy:{createdAt:'asc'} })
  const byU = new Map<string, any[]>(); for(const e of ev){ if(!byU.has(e.userId)) byU.set(e.userId,[]); byU.get(e.userId)!.push(e) }

  console.log('### A) lag alta -> invitacion vs si entro')
  const inv = s.filter(x => x.status !== 'waitlist' && x.status !== 'pending')
  const buckets: Record<string,{n:number, cuenta:number, uso:number}> = {}
  for (const x of inv){
    const d = x.ascInvitedAt ?? x.invitedAt
    const lag = d ? Math.round((+d - +x.createdAt)/DAY) : null
    const b = lag===null ? 'sin fecha' : lag<=1 ? '0-1 dias' : lag<=7 ? '2-7 dias' : '8+ dias'
    buckets[b] ??= {n:0,cuenta:0,uso:0}; buckets[b].n++
    if(x.clerkUserId) buckets[b].cuenta++
    if(x.clerkUserId && (byU.get(x.clerkUserId)??[]).some(e=>CONS.has(e.eventType))) buckets[b].uso++
  }
  console.log(JSON.stringify(buckets,null,1))

  console.log('\n### B) lo que hicieron el PRIMER dia, por persona')
  for (const x of s.filter(x=>x.clerkUserId)){
    const all = byU.get(x.clerkUserId!) ?? []
    const cons = all.filter(e=>CONS.has(e.eventType))
    if(!cons.length){ console.log(`${(x.firstName??'-').padEnd(14)} SIN CONSUMO  onboarding=${all.filter(e=>e.eventType.startsWith('onboarding')).map(e=>e.eventType.replace('onboarding_','')).join('>')||'-'}`); continue }
    const d0 = cons[0].createdAt.toISOString().slice(0,10)
    const day1 = cons.filter(e=>e.createdAt.toISOString().slice(0,10)===d0)
    const c = (t:string)=>day1.filter(e=>e.eventType===t).length
    const totalDays = new Set(cons.map(e=>e.createdAt.toISOString().slice(0,10))).size
    const lvlTest = all.some(e=>e.eventType==='onboarding_level_test_completed')
    const onbFin = all.some(e=>e.eventType==='onboarding_finished')
    console.log(`${(x.firstName??'-').padEnd(14)} dias=${totalDays} | dia1: hist=${new Set(day1.filter(e=>e.storySlug).map(e=>e.storySlug)).size} audioFin=${c('audio_complete')} pract=${c('practice_session_completed')}/${c('practice_session_started')} vocab=${c('vocab_clicked')} | test=${lvlTest?'si':'no'} onbFin=${onbFin?'si':'no'} horas=${x.weeklyHours}`)
  }

  console.log('\n### C) invitados SIN cuenta: idioma vs catalogo publicado')
  const pub = new Set((await p.journey.findMany({ where:{status:'active'}, select:{language:true,variant:true,levels:true} }))
    .map(j=>`${j.language}|${j.variant}|${(j.levels||[]).join(',')}`))
  const pubLang = new Set([...pub].map(k=>k.split('|')[0]))
  for (const x of inv.filter(x=>!x.clerkUserId)){
    const d = x.ascInvitedAt ?? x.invitedAt
    const dias = d ? Math.round((Date.now()-+d)/DAY) : null
    const lang = x.targetLanguage.toLowerCase()
    const variantes = [...pub].filter(k=>k.startsWith(lang+'|')).map(k=>k.split('|').slice(1).join('/'))
    console.log(`${(x.firstName??'-').padEnd(18)} ${x.platform.padEnd(7)} ${lang}/${x.targetVariant??'-'}/${x.currentLevel.padEnd(12)} invitado hace ${dias}d | publicado: ${variantes.join(' ')||'NADA'} | nudge=${x.emails.some(e=>e.kind==='install_nudge')?'si':'no'}`)
  }
  await p.$disconnect()
}
main()
