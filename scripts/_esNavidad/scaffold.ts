/**
 * Scaffold del journey Cultural ES/LATAM B1 (siete tradiciones).
 * Crea la fila `Journey`, los 7 `Topic` y los 21 huecos de `JourneyStory`.
 * NO escribe contenido: title/text/vocab quedan nulos y los llena saveStory.ts.
 *
 * Pasa por los tres portones antes de tocar nada:
 *   assertLadderContiguous · assertTopicsGrounded · assertJourneyType
 *
 * Uso: npx tsx scripts/_esNavidad/scaffold.ts [--dry]
 */
import { config } from 'dotenv'
config({ path: '.env.local', quiet: true }); config({ path: '.env', quiet: true })
import { PrismaClient } from '../../src/generated/prisma'
import { assertLadderContiguous } from '../../src/lib/journeyLadder'
import { assertTopicsGrounded } from '../../src/lib/topicEvidence'
import { assertJourneyType } from '../../src/lib/journeyType'

const DRY = process.argv.includes('--dry')
const p = new PrismaClient()

const NUEVO = { name: 'Cultural', language: 'spanish', variant: 'latam', typeSlug: 'cultural', levels: ['b1'] }
const TEMAS: [string, string][] = [
  ['Wishes & Bargaining', 'wishes-and-bargaining'],
  ['Turns & Belonging', 'turns-and-belonging'],
  ['Vigils & Waiting', 'vigils-and-waiting'],
  ['Weight & Endurance', 'weight-and-endurance'],
  ['Stalls & Crowds', 'stalls-and-crowds'],
  ['Hosting & Processions', 'hosting-and-processions'],
  ['Endings & Forgiveness', 'endings-and-forgiveness'],
]
/** Citas VERBATIM de BetaSignup que sostienen el journey entero (modo journey-level). */
const CITAS = [
  'He lives with his grandmother who only speaks Spanish, I want to have my own conversations with her',
  'To help learn Spanish to be able to talk to my family',
  'to learn mexican spanish',
  'I really enjoy story-based learning to maintain and practice my level of Spanish',
]

async function main() {
  const existentes = await p.journey.findMany({ select: { id: true, name: true, language: true, variant: true, levels: true, status: true } })
  assertLadderContiguous(NUEVO, existentes as never)
  console.log('portón escalera: OK')

  await assertJourneyType({ typeSlug: NUEVO.typeSlug, name: NUEVO.name, prisma: p as never })
  console.log('portón tipo: OK')

  const labelsExistentes = (await p.topic.findMany({ select: { label: true } })).map(t => t.label)
  await assertTopicsGrounded({
    language: 'spanish',
    proposals: TEMAS.map(([label, slug]) => ({ label, slug })),
    journeyEvidence: CITAS,
    existingLabels: labelsExistentes,
    prisma: p as never,
  })
  console.log('portón evidencia: OK')

  const yaExiste = await p.journey.findFirst({ where: { name: 'Cultural', language: 'spanish', variant: 'latam' } })
  if (yaExiste) { console.log(`YA EXISTE: ${yaExiste.id}. No se toca nada.`); return }

  if (DRY) {
    console.log(`\n[DRY] crearía Journey ${NUEVO.name} ${NUEVO.language}/${NUEVO.variant} ${NUEVO.levels.join(',')}`)
    console.log(`[DRY] crearía ${TEMAS.length} Topic: ${TEMAS.map(t => t[1]).join(', ')}`)
    console.log(`[DRY] crearía ${TEMAS.length * 3} JourneyStory vacías (slots 1..3 por tema)`)
    return
  }

  for (const [label, slug] of TEMAS) {
    await p.topic.create({ data: { slug, label, isUniversal: false } })
  }
  const j = await p.journey.create({
    data: { ...NUEVO, topics: TEMAS.map(t => t[1]), storiesPerTopic: 3, status: 'draft' },
  })
  for (const [, slug] of TEMAS) {
    for (const slotIndex of [1, 2, 3]) {
      await p.journeyStory.create({ data: { journeyId: j.id, level: 'b1', topic: slug, slotIndex, status: 'draft' } })
    }
  }
  console.log(`\nCREADO journey ${j.id} · 7 temas · 21 huecos en draft`)
}
main().catch(e => { console.error('\nPARADO:', e.message); process.exitCode = 1 }).finally(() => p.$disconnect())
