import { config } from 'dotenv'
config({ path: '.env.local', quiet: true }); config({ path: '.env', quiet: true })
import { PrismaClient } from '../src/generated/prisma'
const p = new PrismaClient()
async function main(){
  const s = await p.betaSignup.findMany({ where:{ clerkUserId:{ not:null } },
    select:{ firstName:true, clerkUserId:true, currentLevel:true, targetLanguage:true } })
  const ev = await p.userMetric.findMany({ where:{ userId:{ in: s.map(x=>x.clerkUserId!) } },
    select:{ userId:true, eventType:true, storySlug:true, metadata:true, createdAt:true }, orderBy:{ createdAt:'asc' } })
  console.log('=== onboarding_finished (metadata completa) ===')
  for (const u of s){
    const fin = ev.filter(e=>e.userId===u.clerkUserId && e.eventType==='onboarding_finished')
    const rem = ev.filter(e=>e.userId===u.clerkUserId && e.eventType==='reminder_scheduled').length
    const cons = ev.filter(e=>e.userId===u.clerkUserId && ['story_opened','audio_play','vocab_clicked','audio_complete'].includes(e.eventType)).length
    console.log(`${(u.firstName??'-').padEnd(15)} consumo=${String(cons).padStart(4)} remScheduled=${rem} ${fin.length? JSON.stringify(fin[0].metadata) : 'NO TERMINO ONBOARDING'}`)
  }
  console.log('\n=== primera sesion (primeros 90 min desde signup_completed) de cada uno ===')
  for (const u of s){
    const mine = ev.filter(e=>e.userId===u.clerkUserId)
    if(!mine.length){ console.log(`${u.firstName}: sin eventos`); continue }
    const t0 = +mine[0].createdAt
    const win = mine.filter(e=> +e.createdAt - t0 <= 90*60000)
    const types: Record<string,number> = {}; for(const e of win) types[e.eventType]=(types[e.eventType]??0)+1
    console.log(`${(u.firstName??'-').padEnd(15)} ${JSON.stringify(types)}`)
  }
  console.log('\n=== cobertura del journey principal de cada usuario activo ===')
  const js = await p.journeyStory.findMany({ select:{ id:true, slug:true, journeyId:true,
    journey:{ select:{ language:true, variant:true, levels:true, status:true } } } })
  const jByKey = new Map<string,string>(); const totalByJourney = new Map<string,number>()
  for(const x of js){ jByKey.set(`journey-${x.id}`, x.journeyId); jByKey.set(`journey:${x.id}`, x.journeyId); if(x.slug) jByKey.set(x.slug, x.journeyId)
    totalByJourney.set(x.journeyId, (totalByJourney.get(x.journeyId)??0)+1) }
  const jMeta = new Map(js.map(x=>[x.journeyId, x.journey]))
  for (const u of s){
    const opened = new Map<string, Set<string>>()
    for (const e of ev.filter(e=>e.userId===u.clerkUserId && e.storySlug && e.eventType==='story_opened')){
      const jid = jByKey.get(e.storySlug!); if(!jid) continue
      if(!opened.has(jid)) opened.set(jid, new Set()); opened.get(jid)!.add(e.storySlug!)
    }
    if(!opened.size) continue
    const parts = [...opened.entries()].map(([jid,set])=>{ const m=jMeta.get(jid)!
      return `${m.language}/${m.variant}/${(m.levels||[]).join(',')} ${set.size}/${totalByJourney.get(jid)}` })
    console.log(`${(u.firstName??'-').padEnd(15)} ${parts.join(' | ')}`)
  }
  await p.$disconnect()
}
main()
