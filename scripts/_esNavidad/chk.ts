import { isSpanishUpToLevel } from '../../src/lib/cefr/spanishLevels'
const ws = process.argv.slice(2)
ws.forEach(w => console.log(`${isSpanishUpToLevel(w,'b1') ? 'B1 ok' : 'FUERA '}  ${w}`))
