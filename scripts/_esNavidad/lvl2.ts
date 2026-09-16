import { isSpanishUpToLevel } from '../../src/lib/cefr/spanishLevels'
const ANCLA = ['posada','piñata','colación','ponche','tejocote','caña','aguinaldo','villancico','peregrino','letanía','nacimiento','pesebre','Nochebuena','pavo','bacalao','romeritos','recalentado','brindis','propósito','cohete','esfera','adorno','heno','musgo','muñeco','atole','Candelaria','compadre','padrino','arrullar','vela','farol','peregrinación','alcancía','ofrenda','pozole','buñuelo','sidra','guirnalda','rosca','tamal','corona','mole','uva','misa','rezo','santo','vecindad','azotea','fonda','tianguis','puesto','marchante','propina','quincena']
const PORT = ['frío','rezar','prometer','discutir','perdonar','extrañar','cancelar','fingir','enojarse','avergonzarse','orgulloso','emocionado','vacío','injusto','encargar','confesar','sobrar','faltar','alcanzar','apenas','de repente','a escondidas','por si acaso','dar la vuelta','hacer falta','quedar mal','echar la culpa','ponerse de acuerdo','salirse con la suya','tener ganas','a medias','de todos modos','ni modo','valer la pena']
for (const level of ['a2','b1'] as const) {
  console.log(`\n#### ${level.toUpperCase()}`)
  for (const [n, ws] of [['ANCLA', ANCLA], ['PORTABLE', PORT]] as const) {
    const i = ws.filter(w => isSpanishUpToLevel(w, level)); const o = ws.filter(w => !isSpanishUpToLevel(w, level))
    console.log(`  ${n}: ${i.length}/${ws.length} dentro`)
    console.log(`    dentro: ${i.join(', ')}`)
    console.log(`    FUERA : ${o.join(', ')}`)
  }
}
