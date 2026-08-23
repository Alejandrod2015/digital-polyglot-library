# Brief de reescritura: Traveler DE A0 (cmt0a8vb1000m32p1x7r5ba28)

La escalera de recirculación se planifica AQUÍ, en el cuerpo, no en la lista de
vocab. Los 21 textos actuales no la sostienen: sólo llegan al suelo de 3,0
porque la misma palabra ocupa plaza en hasta nueve historias. Con tope de dos
plazas por palabra la media cae a 2,34, y con el A1 liberado a 2,56. Medido con
el criterio exacto del gate.

## La cuenta

| concepto | número |
|---|---|
| historias | 21 |
| plazas por historia | 20 (suelo de `vocab-count`) |
| plazas totales | 420 |
| ancladas a su escena | 126 (30%, tope de `journey-vocab-recirculation`) |
| portables | 294 |
| palabras portables distintas | 147, a dos plazas cada una |
| apariciones que hay que sembrar | 147 x 3 = 441, unas 21 por cuerpo |

Un cuerpo son ~180 palabras, así que sembrar 21 reapariciones es el 12% del
texto. Cabe sin forzar la prosa.

## Reparto por historia

- 14 plazas portables: palabras que vuelven en otras 2 historias como mínimo.
- 6 plazas ancladas: léxico que sólo existe en esa escena (`der Kutter`,
  `die Kreide`, `die Zinnfigur`, `die Kuckucksuhr`), marcadas `anchor: true`.

## De dónde salen las palabras

`src/lib/cefr/germanA1A2.ts` tiene 1.479 lemas. El Traveler A1 alemán ocupa 351
y los journeys de otro tipo 92, así que quedan **1.036 libres**. De esas, 296 ya
aparecen en los cuerpos actuales, que es la prueba de que caben en estas
escenas.

Reglas que siguen mandando: cero repetidas contra otro journey del mismo tipo,
máximo dos contra otros tipos, y la palabra tiene que estar en el cuerpo con la
`surface` exacta que se declare, porque el encuentro se cuenta por token.

## Lo que NO cambia

Los siete destinos, el reparto (Hannah más Elias, Sophie, Noah, Emilia, Leon,
Marie), los arcos y los títulos. Se reescribe la prosa, no la historia.

## Lo que se rehace después

Los 21 sets de práctica están `locked` y cubren el vocab actual. Al cambiar las
plazas hay que rehacerlos. No hay audio ni portadas todavía, que es justo por lo
que este es el momento barato para tocar los cuerpos.
