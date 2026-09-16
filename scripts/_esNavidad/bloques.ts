import * as fs from 'fs'
import { renderedParagraphs } from '../../src/lib/readerParagraphs'
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
for (const s of d) {
  const blocks = renderedParagraphs(s.text)
  const surfaces = s.vocab.map((v: any) => (v.surface ?? v.word).toLowerCase())
  console.log(`\n=== ${s.title} · ${String(s.text).split(/\s+/).length} palabras · ${blocks.length} bloques`)
  blocks.forEach((b: string, i: number) => {
    const hits = surfaces.filter((w: string) => b.toLowerCase().includes(w))
    console.log(`  [${i + 1}] ${hits.length}  ${hits.join(', ')}`)
    console.log(`      ${b.slice(0, 110)}...`)
  })
}
