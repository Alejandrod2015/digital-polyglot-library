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


## Segunda tanda (2026-08-23, despues del "dale"): dos hallazgos

### 1. La densidad que pide la escalera no cabe en 170 palabras

Reescribi el tema 1 metiendo claves del journey a proposito: de 24 claves por
cuerpo a 43, y la escalera del tema subio de 1,11 a 1,49. Ese es el techo de la
prosa legible: **0,256 claves por palabra**. Medido:

| | cuerpos | palabras | claves por cuerpo | claves por palabra |
|---|---|---|---|---|
| Control Friends ES/argentina A0 (3,01) | 21 | 3511 | 60,1 | 0,360 |
| Traveler ES/spain B1 antes | 21 | 3520 | 24,3 | 0,145 |
| Traveler ES/spain B1, tema 1 reescrito | 3 | 506 | 36,0 | 0,213 |
| **lo que pide la media 2,5** | | | **52,5** | **0,31** |

El control llega a 0,360 porque es A0: el 70% de sus plazas son vocabulario
A1-A2, o sea que enseña el tejido conectivo (`sube`, `menos`, `nadie`,
`lleva`), y entonces casi cada palabra del cuerpo es clave. Un B1 no puede:
esas palabras ya las enseñaron los diez journeys de espanol anteriores. Con
claves de la cola rara del idioma hacen falta articulos, preposiciones y verbos
entre ellas, y la densidad se queda en 0,21-0,26.

Extrapolando el tema 1 a los 21: la escalera acabaria entre **1,9 y 2,0**. Seria
la mejor recirculacion del catalogo fuera de A0 (mejor A1 1,88, mejor C1 1,56)
y aun asi no llega a 2,5.

### 2. Otro chat escribio el Traveler ES/latam A1 mientras yo escribia este

Cuando construi el pool ese journey tenia 0 plazas; ahora tiene 21 historias y
420 lemas, y es del MISMO TIPO, asi que entra en el cubo de tolerancia CERO.
**105 de mis 442 claves quedaron prohibidas de golpe**, y son justo las que mas
recirculan: mitad, parte, orden, nota, frase, lista, tono, gesto, prisa, señal,
hoja, total, peso, cantidad.

| cubo de tolerancia cero | lemas |
|---|---|
| hoy: todo Traveler de espanol | 1265 |
| Traveler/spain a1 | 447 |
| Traveler/latam a1 | 420 |
| Traveler/latam a0 | 291 |
| Traveler/mexico a0 | 255 |
| si se comparase dentro del pool de VARIANTE | 447 |

**Recomendacion:** que `vocab-taught-same-type` compare dentro del pool de
variante (`variantMatchesPreference`, `packages/domain/src/languageVariant.ts`),
no dentro del idioma entero. Desde el 2026-08-20 el Journey tab sirve SOLO la
variante del alumno y **España va sola**
([[project_journey_variant_filtering]]): un alumno de España no puede abrir el
Traveler LATAM ni el de Mexico. Hoy se le esta quitando a su B1 **818 lemas**
para protegerlo de un solape que nunca va a ver. El caso que motivo el filtro de
variante fue Vincent Pearson, que es el mismo solicitante cuya frase ("Holiday
home in Spain") sostiene el tema 1 de este journey.

Con ese cambio vuelven los 105 lemas prohibidos y, con ellos, los mejores
recirculadores. La escalera seguiria sin llegar a 2,5 por el hallazgo 1, pero el
journey dejaria de estar bloqueado por un solape que no existe para su lector.
