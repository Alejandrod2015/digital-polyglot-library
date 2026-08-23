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


## Tercera tanda: el cambio de variante, hecho, y donde queda todo

`vocab-taught-same-type` y `vocab-taught-elsewhere` ya comparan dentro del POOL
DE VARIANTE (`variantPool`, packages/domain/src/languageVariant.ts), no dentro
del idioma entero. La regla de cero solape es del 2026-08-18 y su premisa es
"el lector ya la tiene en su repaso"; el filtro de variante entro el 2026-08-20
y desde entonces esa premisa es falsa para otra variante, porque a un alumno de
España no se le sirve el Traveler LATAM ni el de Mexico. La regla es anterior al
hecho que la desmiente.

| | antes | ahora |
|---|---|---|
| cubo de tolerancia cero | 1265 lemas | 447 |
| cubo de tope 2 por historia | 2934 | 296 |
| pool usable hasta B1 | 3133 | 3956 |

## Estado del journey

- **Las 21 pasan el validador canonico**: `✓ All 21 stories pass the canonical
  validator (ES b1 spain)`.
- **12 de las 13 reglas de conjunto pasan**, incluidas las cuatro que el gate no
  sabia medir en espanol antes de esta tanda (reparto, las tres formas de
  presentacion, forma de apertura, ni ancianos ni ninos).
- **Bloquea una**: `journey-vocab-recirculation`, media **1,38** frente al piso
  2,5. Subio de 1,16 con el tejido de claves; las claves por cuerpo pasaron de
  24,3 a 29.

El techo esta medido desde tres angulos y sale el mismo: la media 2,5 pide 52,5
claves por cuerpo, y con el tope de 170 palabras eso son 0,31 claves por
palabra. La mejor densidad que da la prosa legible en este journey es la de
`ya-no-queda-nadie`: 43 claves en 168 palabras, 0,256. El journey control llega
a 0,360 porque es A0 y ensena el tejido conectivo del idioma, que en un B1 ya
esta enseñado.

**Decision pendiente del usuario**, y es la unica que queda: o el piso de B1 se
calibra contra ese techo, o el tope de 170 palabras cede en B1, o el journey se
queda sin guardar. El piso NO se ha tocado.


## Cuarta tanda: el piso en 2,0 y una correccion

El piso de B1 esta puesto en **2,0** en `validateJourneyStories.ts`, con su
derivacion escrita. **El numero del que salio es MIO y estaba mal**, y hay que
decirlo antes que nada: lo saque de la densidad de claves por palabra del cuerpo
mas denso (43 claves en 168 palabras) y extrapole 2,06. Ese calculo mide cuantas
palabras del journey hay en un cuerpo, y la escalera mide otra cosa: en cuantos
cuerpos aparece CADA PLAZA. No son lo mismo.

Medido de verdad, sobre los 21 cuerpos ya tejidos
(`scripts/_b1/asignar.ts`, `techo2.ts`):

| | |
|---|---|
| palabras con plaza legitima presentes en los cuerpos | 421 |
| de ellas, en 2 o mas cuerpos | 91 (suman 330 encuentros) |
| en un solo cuerpo | 330 |
| plazas que hay que llenar | 444 |
| **techo real de la escalera con esta prosa** | **1,60** |
| donde esta hoy | 1,47 |

"Plaza legitima" quiere decir sin contar gramaticales, deicticos, numerales,
meses y verbos de andar por casa. Sin ese filtro el reparto optimo da 2,20, pero
eligiendo `que`, `con` y `una` como vocabulario de B1: es teatro, no escalera.

La causa esta escrita desde el principio en
[[project_vocab_recirculation_ladder]]: "los 7 temas del journey tienen que
compartir espina... con siete escenas ajenas entre si el reencuentro es
imposible por construccion". Estos siete comparten pueblo, reparto y espina
argumental, pero NO comparten lexico: 330 de las 421 palabras salen en un solo
cuerpo. La obra del terrado, que es la espina, solo aporta el nucleo que si
recircula: nota(13) cuota(12) obra(10) gesto(9) prisa(8) mancha(8) tono(8)
plazo(8) cesta(7) alivio(7) cifra(7) techo(6) frase(6) lista(6).

Lo unico que mueve el techo es re-cortar los siete temas para que compartan
lexico, no solo sitio. Con 120 palabras compartidas en vez de 91 y el resto
anclado, la cuenta sale: 120 x 6 + 324 = 1044 sobre 444, o sea 2,35.


## Quinta tanda: el techo duro, derivado

Se re-cortaron los siete temas alrededor de un nucleo lexico de 80 palabras
(`scripts/_b1/nucleo.txt`) y se reescribieron los 21 cuerpos para meterlo. La
prosa de esa pasada esta guardada en `scripts/_b1/data-nucleo/`. **No se quedo**,
porque al medirla aparecio una cota que cierra el asunto.

La escalera es `pares (clave, cuerpo) / plazas`, y las plazas tienen que ser
palabras DISTINTAS: una palabra se ensena una sola vez en el journey. Entonces:

    escalera <= (palabras con plaza legitima por cuerpo x 21) / plazas

Medido sobre los 21 cuerpos (`/tmp/techo.py`, mismo filtro que `asignar.ts`):

| | |
|---|---|
| pares (palabra, cuerpo) con plaza legitima | 660 |
| palabras distintas | 421 |
| plazas que hay que llenar | 444 |
| **techo duro** | **1,49** |
| donde esta el journey | 1,47 |

O sea: **el journey ya esta en su techo**. Para 2,0 harian falta 42 palabras con
plaza legitima por cuerpo; hay 31, y 31 es lo que dieron cuatro pasadas de
tejido a proposito. "Con plaza legitima" = en la lista hasta B1, no ensenada por
un journey de Espana, y que merezca la plaza (sin gramaticales, deicticos,
numerales, meses ni verbos de andar por casa). Sin ese ultimo filtro el reparto
optimo sube a 2,20 ensenando `que`, `con` y `una`: eso es teatro.

Y la cota tiene forma de tijera: cuanto mas comparten lexico los cuerpos (que es
lo que sube la escalera), menos palabras DISTINTAS quedan para llenar las 444
plazas. Subir un lado baja el otro.

Lo que si mueve la cota, en orden de coste:

1. **Que la escalera mire solo las plazas `portable`.** Otra sesion esta metiendo
   hoy el campo `reuse` (`portable` / `anchored`) y el check
   `journey-portable-recirculation`. Con el, las ~330 palabras ancladas que
   salen una vez dejan de arrastrar la media, que es exactamente lo que
   [[project_vocab_recirculation_ladder]] describe con su 70/30. Es el
   instrumento correcto y no cuesta reescribir nada.
2. Bajar el minimo de `vocab-count` en B1: con 444 plazas y 421 palabras
   disponibles, el journey esta pidiendo mas plazas de las que su prosa puede
   sostener.
3. Subir el tope de 170 palabras en B1, que es decision de producto del usuario.
