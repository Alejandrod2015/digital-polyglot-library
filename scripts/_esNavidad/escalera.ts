/** Escalera del journey medida POR EL GATE (journey-vocab-recirculation de
 *  src/lib/validateJourneyStories.ts), no por un script propio. El check no
 *  devuelve cifras cuando pasa, asi que se le pide tambien con el liston de A0
 *  solo para leer los numeros. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true })
import { createRequire } from "module"
const __req = createRequire(__filename)
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id: q, filename: q, loaded: true, exports: {} } } catch {}
import { PrismaClient } from '../../src/generated/prisma'
import { validateJourneyStories } from '@/lib/validateJourneyStories'
const p = new PrismaClient()
async function main() {
  const id = process.argv[2]
  const j = await p.journey.findUnique({ where: { id } })
  const rows = await p.journeyStory.findMany({
    where: { journeyId: id, text: { not: null } },
    orderBy: [{ topic: 'asc' }, { slotIndex: 'asc' }],
  })
  const orden = j!.topics
  const stories = rows
    .sort((a, b) => orden.indexOf(a.topic) - orden.indexOf(b.topic) || a.slotIndex - b.slotIndex)
    .map(r => ({ slug: r.slug ?? '', title: r.title ?? '', text: r.text ?? '', topic: r.topic, vocab: (r.vocab as any[]) ?? [], synopsis: r.synopsis ?? '' }))
  for (const nivel of ['b1', 'a0']) {
    const res: any = validateJourneyStories(stories as any, { language: 'spanish', level: nivel, variant: 'latam', journeyName: 'Cultural', typeSlug: 'cultural' } as any)
    const c = (Array.isArray(res) ? res : res.checks ?? []).find((x: any) => x.id === 'journey-vocab-recirculation')
    console.log(`\n[liston ${nivel}] ${c?.status} :: ${c?.detail ?? '(sin detalle)'}`)
  }
}
main().finally(() => p.$disconnect())
