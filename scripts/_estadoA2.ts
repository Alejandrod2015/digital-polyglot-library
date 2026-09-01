import { PrismaClient } from "@/generated/prisma"
const prisma = new PrismaClient()

async function main() {
  const j = await prisma.journey.findUnique({ where: { id: 'cmtgelq560007j84n3ujx9bpd' } })
  if (!j) { console.log('journey no encontrado'); return }
  console.log('status:', j.status, '| topics:', JSON.stringify(j.topics))
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: j.id },
    select: { topic: true, slotIndex: true, title: true, status: true, text: true, updatedAt: true },
  })
  const byTopic: Record<string, { n: number; conTexto: number; titulos: string[] }> = {}
  for (const s of stories) {
    const t = s.topic ?? '(sin tema)'
    byTopic[t] ??= { n: 0, conTexto: 0, titulos: [] }
    byTopic[t].n++
    if (s.text && s.text.length > 0) byTopic[t].conTexto++
    byTopic[t].titulos.push(`${s.title ?? '(sin titulo)'} [${s.status}] ${s.text?.length ?? 0}ch`)
  }
  const nuevos = new Set(j.topics as string[])
  for (const [t, v] of Object.entries(byTopic)) {
    console.log(`\n${nuevos.has(t) ? 'NUEVO' : 'viejo'} ${t}: ${v.n} historias, ${v.conTexto} con texto`)
    for (const ti of v.titulos) console.log('  -', ti)
  }
  const last = stories.reduce((m, s) => (s.updatedAt > m ? s.updatedAt : m), new Date(0))
  console.log('\nultima modificacion de historia:', last.toISOString())
}
main().finally(() => prisma.$disconnect())
