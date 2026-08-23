# Traveler ES/spain B1, estado al 2026-08-23

Journey creado: `cmt5x67ze000l320cpgunu5vi` (spanish / spain / b1 / traveler,
**draft**, 7 temas x 3 = 21 huecos vacios). Las 21 historias estan escritas en
`scripts/_b1/data/t1..t7.json` (y unidas en `all.json`) pero **NO estan
guardadas en la base**: el gate de journey las bloquea (ver abajo).

## Lo que ya pasa

- Portón de temas (`assertTopicsGrounded`): los 7 temas citan 7 frases
  distintas escritas por 6 solicitantes distintos de espanol.
- Validador canonico por historia (`saveStory --dry --narrator`): **21/21 en
  verde**, cero warns salvo `body-consecutive-narrators` en tres.
- Cero solape de vocabulario: 444 plazas, 444 lemas distintos, ninguno
  enseñado por otro Traveler de espanol ni (salvo `no tiene ciencia`, que es
  expresion) por journeys de otro tipo.

## Lo que bloquea: `journey-vocab-recirculation`

Media **1,16** encuentros por plaza frente al piso **2,5** que se calibro para
B1 en `src/lib/validateJourneyStories.ts`. Faltan ~595 apariciones.

**El piso NO se toca.** Es alcanzable, y hay control que lo demuestra: el
Friends ES/argentina A0 (`cmt5vx8du000732fjgkwi59ks`) da **3,01 sin re-enseñar
ni una palabra** (1,00 plazas por lema). Medido con `scripts/_b1/_ladder2.ts` y
`scripts/_b1/_control.ts`:

| journey | por plaza | por lema | plazas/lema | claves por cuerpo |
|---|---|---|---|---|
| Friends ES/argentina A0 | 3,01 | 3,01 | 1,00 | **60 de 420** |
| Traveler ES/spain B1 (esto) | 1,16 | 1,16 | 1,00 | **24 de 444** |

La diferencia no es el nivel: es que en el A0 argentino **el 60% de los tokens
distintos de CADA cuerpo son vocabulario del propio journey**, y aqui es el 25%.
Con 21 cuerpos de ~167 palabras y ~95 tokens distintos, llegar a 2,5 exige unas
53 claves por cuerpo, o sea ~29 mas de las que hay.

## Lo que falta hacer

Reescribir los 21 cuerpos alrededor de un **núcleo léxico compartido**: unos 80
lemas portables (4 por historia) que aparezcan en 8-10 cuerpos cada uno, y dejar
las ~360 plazas restantes ancladas a su escena. Eso da 2,7-2,8 de media. Hoy los
siete temas tienen léxicos casi disjuntos, que es lo que hunde la escalera: el
conflicto que ya avisa `project_vocab_recirculation_ladder` entre la escalera y
`feedback_vocab_zero_overlap_across_journeys`.

Aviso para la proxima vez, y es la leccion cara de esta tanda: **la escalera se
diseña ANTES de escribir el primer cuerpo**, eligiendo el núcleo compartido
junto con los temas. Arreglarla despues es escribir el journey dos veces
([[feedback_vocab_ladder_belongs_in_the_brief]]).

## Herramientas de esta tanda

- `proposeTopics.ts` : los 7 temas y sus citas; corre el porton solo.
- `createJourney.ts` : crea temas + journey + 21 huecos (ya ejecutado).
- `check.ts` / `pick.sh` / `pool-limpio.txt` : que palabras se pueden enseñar.
- `quick.ts` : chequeo mecanico del fichero antes de saveStory.
- `ladder.ts` / `gaps.ts` : escalera del fichero y claves que faltan por cuerpo.
- `_ladder2.ts` / `_control.ts` : la medicion del catalogo que fija el piso.

## Pendiente aparte

`Journey.nextJourneyId` sigue vacio en los 10 journeys de espanol. La cadena
a0 Friends -> a1 Traveler -> b1 Traveler no se ha escrito porque el b1 todavia
no tiene contenido.
