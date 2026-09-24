# `castOf`: arreglo de la atribucion, y triaje de lo que destapa (2026-09-24)

Continuacion de `docs/medicion-castof-2026-09-24.md`.

## 1. Que se ha cambiado

`src/lib/validateJourneyStories.ts`. Tres caminos de atribucion de habla, que
SE SUMAN al que habia; el camino narrado no se toca, porque cubre el 95% del
catalogo.

| Camino | Que reconoce | Que credito da |
| --- | --- | --- |
| 1. narrada (el de siempre) | `dice Marisol`, `Bastian sagt` | habla |
| 2. etiqueta de dialogo | `Lena: Der Tegernsee ...` al empezar linea | habla **y** mencion |
| 3. cita sin verbo | `Marta mira el mapa. "Vamos"` | habla, y mencion solo si la palabra aparece alguna vez con mayuscula en mitad de frase |

Y una cuarta cosa, que es un error de diseno y no un umbral: **el articulo ya
no fulmina**. `castLegacy` guardaba un `Set` de nombres vistos con articulo
delante y los echaba del reparto para siempre; un solo `die Nadia` o `o Caio`
en 21 historias borraba a la protagonista. Ahora el articulo PESA: se cuentan
las veces con articulo contra las veces suelta, y solo se echa a quien casi
siempre lo lleva (`der Tisch`).

**El umbral de 2 historias NO se ha tocado**, como se pidio.

Lo que NO se ha ampliado, tambien como se pidio: las listas de verbos de habla
por idioma estan exactamente igual.

### Lo que costo apretar el camino 3

Tres intentos, y los dos primeros se midieron y se tiraron:

1. Dar credito de mencion a TODO lo que el detector oye: **236 falsos
   positivos** (`El`, `La`, `Se`, `Il`, `Na`, `Sie`). Los articulos y
   pronombres abren frase todo el rato.
2. Darselo solo a los caminos 2 y 3: **17 falsos positivos**, esta vez verbos
   y adverbios al empezar frase (`Regresa`, `Cerraron`, `Despues`, `Luego`).
3. Lo que queda: el camino 3 da mencion solo si esa palabra aparece alguna vez
   con mayuscula en MITAD de frase, que es lo que hace un nombre propio y no
   hace un verbo. Mas un filtro de minusculas: una palabra que en ese mismo
   journey se escribe alguna vez en minuscula no entra por el camino 3 (mata
   `Sie`, `Chocolate`, `Nube`), y los caminos 1 y 2 no pasan por ese filtro,
   porque un `dice Rosa` o un `Rosa:` no dejan duda aunque `rosa` sea un color.

## 2. Que recupera, medido sobre los mismos 48 journeys

| | Antes | Ahora |
| --- | --- | --- |
| Personajes reales detectados | 196 de 335 | **290 de 335** |
| Perdidos | 139 (41,5%) | **45 (13,4%)** |
| Falsos positivos | 0 | **2** |
| Journeys con el reparto vacio | 5 | **1** |

Por idioma (perdidos): DE 38 a **4**, PT 16 a **8**, ES 72 a **26**, IT 8 a
**4**, FR 5 a **3**.

**Los 2 falsos positivos son PERROS**: `Chocolate` (Friends ES chile A1) y
`Nube` (Friends ES spain B1), dos mascotas que el narrador nombra como sujeto
junto a habla citada. No entra ni una palabra que no sea un nombre propio. El
detector no ha empezado a chillar de mas: los `Se`, `Que` y `Aqui` que se
temian se midieron, aparecieron en los intentos 1 y 2, y por eso el camino 3
quedo como quedo.

**Lo que sigue faltando (45)**: 28 son el umbral de 2 historias (el personaje
habla en una sola), 14 no tienen ninguna senal de habla en ningun camino, y 3
son el contador de menciones. Es decir: **el umbral explica el 62% de lo que
queda**. Dicho como se pidio, con la cifra: bajarlo a 1 recuperaria 28 mas, y
es la unica palanca que queda con volumen.

### Tests

`scripts/__tests__/castOfAtribucion.test.ts`, 12 casos: uno por camino
(narrado, etiqueta, cita sin verbo), el articulo que pesa pero no fulmina, y
los negativos que demuestran que no chilla de mas (toponimo junto a la cita,
sustantivo comun al empezar frase, verbo al empezar frase, etiqueta en mitad
de frase, prosa sin habla, y el que habla en una sola historia). Verde.

## 3. Los dos perros: probado y DESCARTADO

`Chocolate` (Friends ES chile A1) y `Nube` (Friends ES spain B1) son mascotas
que el narrador nombra como sujeto ("Nube movio la cola") y que en 21
historias no dicen una linea.

**No hay de donde sacar el reparto declarado.** `JourneyStory.cast`, que el
esquema llama "single source of truth for the story's characters", **esta
VACIA en los 51 journeys del catalogo**. Ni estos dos journeys tienen plan de
tema en `docs/`, ni `dialogueSpec` (0 de 21 y 0 de 18). Lo unico poblado es
`synopsis`. Hay un campo pensado para esto que nadie rellena, y mientras siga
vacio **cualquier gate de reparto sera una adivinanza**.

Se probo lo que no exige inventar un detector de animales: **pedir al menos
UNA atribucion de habla de verdad** (camino 1 o 2) para contar como reparto.
Medido sobre los 48:

| | Con el filtro |
| --- | --- |
| Detectados | 290 a **273** |
| Falsos positivos | 2 a **1** |
| Personas de verdad que se caen | **19** |

Quita a `Nube` y ni siquiera quita a `Chocolate`, porque el journey dice "se
llama Chocolate" y `llama` esta en la lista de verbos de habla del espanol.
Cuesta 19 humanos (Bente, Hauke, Sepp, Arianna, Jussara, Camilo, Mateo,
Valentina, Rosa, Flor, Benjamin, Pilar, Beto, Andres, Tomas, Nico, Diego,
Daniela, Manuela) por un perro. **No se aplica.** Queda revertido y medido.

De paso: `llama` en la lista de habla del espanol casa con "se llama X", que
es nombrar, no hablar. No se ha tocado.

## 4. Otro error mio, y este cambia las cifras del triaje

La primera pasada de gates ordeno las historias por **tema alfabetico**, no
por el orden de lectura, que es el array `Journey.topics`. Los dos gates que
dependen del orden (`first-story-only-fixed` y `one-new-per-topic`) estaban
mirando la historia equivocada en los 41 journeys cuyos temas no van en orden
alfabetico. Corregido; las sondas ahora reordenan por `topics`.

Con el orden REAL, corriendo el validador sobre los 48:

| | Antes del arreglo | Despues |
| --- | --- | --- |
| Journeys con algun gate de reparto en rojo | 17 | **19** |
| Gates de reparto en rojo | 23 | **28** |
| Gates que pasan de verde a rojo (deuda destapada) | | **15** |
| Gates que pasan de rojo a verde (falsos rojos que quita) | | **10** |

Asi que me corrijo dos veces seguidas. No son "25 falsos verdes" (proxy), ni
"5 gates en 3 journeys y 0 resueltos" (orden mal): son **15 deudas destapadas
y 10 falsos rojos quitados**, repartidos en 15 journeys. Los 10 que se quitan
son 7 de `closing-alone` y 3 de `protagonist-in-all`, justo donde medi los
falsos rojos: el detector SI estaba marcando historias correctas.

## 5. Cerrado: un swap de orden

`journey-cast-one-new-per-topic` en el **Friends ES colombia C1 (live)**: Salo
se estrenaba en la segunda historia de `medellin`. Cambiado el `slotIndex` de
las dos primeras del tema (`scripts/_castSwapOrden.ts`), solo el orden, sin
tocar texto, audio ni portadas:

```
antes:   1:arepas-donde-dona-fanny  2:la-comuna-13-no-es-museo  3:santa-elena-huele-a-sancocho
despues: 1:la-comuna-13-no-es-museo 2:arepas-donde-dona-fanny   3:santa-elena-huele-a-sancocho
```

Comprobado con el validador: ese gate pasa a verde y no aparece ninguno nuevo.
El journey sigue en rojo en `first-story-only-fixed`, que es del tema
`bogota` y pide prosa.

El otro que iba a cerrarse, el **Expat FR france A1**, con el orden bien **ya
no falla**: era el mismo error del orden alfabetico. Y aparece uno nuevo,
**Expat DE germany C1 (draft)**, cuyo `first-story-only-fixed` si se arregla
reordenando; no se ha tocado, porque no estaba en lo autorizado.

## 6. Triaje: 19 journeys, 28 gates

**10 son LIVE y 9 draft.** Por regla: `fixed-max-two` 11, `one-new-per-topic`
5, `first-story-only-fixed` 4, `closing-alone` 4, `protagonist-in-all` 3.

Por coste: **26 de los 27 que quedan piden reescribir prosa**; 1 se arregla
reordenando (Expat DE C1 draft, sin audio).

| Journey | Estado | Reparto | Regla en rojo | Cifra | Arreglo | Arrastra |
| --- | --- | --- | --- | --- | --- | --- |
| Friends german/germany a1 | **live** | 5 | `cast-fixed-max-two` | 4 salen en media o mas: Julia (21/21), Moritz (17/21), Svenja (6/21), Theresa (5/21). Tres voces sostenidas se | prosa | audio 21/21, portadas 21/21 |
| Friends german/germany c1 | **live** | 9 | `cast-fixed-max-two` | 4 salen en media o mas: Nadia (21/21), Timo (15/21), Micha (5/21), Steffi (3/21). Tres voces sostenidas se con | prosa | audio 21/21, portadas 21/21 |
|  |  |  | `cast-one-new-per-topic` | temas con mas de uno: hamburg (Hauke, Frauke) / muenchen (Korbinian, Sepp) · presentados tarde: Frauke (aparec | prosa |  |
|  |  |  | `cast-first-story-only-fixed` | 4 en la primera (Nadia, Timo, Micha, Jule). La abre el reparto estable y nadie mas: dos personas como mucho. | prosa |  |
| Expat german/germany c1 | **live** | 6 | `closing-alone` | 12/21 (protagonista Nadia): bewerbungsgespraech-mit-katze, im-keller-wohnt-die-hausordnung, umzug-ohne-aufzug, | prosa | audio 21/21, portadas 21/21 |
|  |  |  | `cast-fixed-max-two` | 5 salen en media o mas: Nadia (21/21), Timo (18/21), Katja (8/21), Brandt (4/21), Ronja (4/21). Tres voces sos | prosa |  |
| Traveler italian/italy a1 | **live** | 3 | `closing-alone` | 14/21 (protagonista Teo): la-macchinetta-gialla, il-regionale-ferma-dappertutto, i-biglietti-li-vende-il-tabac | prosa | audio 21/21, portadas 21/21 |
|  |  |  | `cast-protagonist-in-all` | Sin hilo en 4 tema(s): trains-tickets (la-macchinetta-gialla, il-regionale-ferma-dappertutto, i-biglietti-li-v | prosa |  |
| Traveler portuguese/brazil a1 | **live** | 1 | `closing-alone` | 21/21 (protagonista Nara): duas-moedas-para-copacabana, a-ladeira-guarda-mil-azulejos, a-ultima-barca-para-nit | prosa | audio 21/21, portadas 21/21 |
|  |  |  | `cast-protagonist-in-all` | Sin hilo en 6 tema(s): getting-around-town (duas-moedas-para-copacabana, a-ladeira-guarda-mil-azulejos, a-ulti | prosa |  |
| Traveler spanish/mexico a1 | **live** | 0 | `closing-alone` | 21/21 (protagonista ?): xochimilco-en-trajinera, la-casa-azul-de-coyoacan, el-mercado-del-zocalo, sofia-prueba | prosa | audio 21/21, portadas 21/21 |
| Traveler spanish/spain a1 | **live** | 5 | `cast-fixed-max-two` | 4 salen en media o mas: Irene (21/21), Rocío (15/21), Quique (9/21), Rosa (4/21). Tres voces sostenidas se con | prosa | audio 21/21, portadas 21/21 |
| Traveler spanish/spain a2 | **live** | 6 | `cast-fixed-max-two` | 6 salen en media o mas: Irene (21/21), Rocío (12/21), Rosa (5/21), Quique (6/21), Álvaro (4/21), Marta (3/21). | prosa | audio 21/21, portadas 21/21 |
| Friends spanish/latam c1 | **live** | 16 | `cast-protagonist-in-all` | Sin hilo en 1 tema(s): el-cotorreo (le-toca-a-mateo, ahorita-salgo, diez-intentos) | prosa | audio 21/21, portadas 21/21 |
|  |  |  | `cast-one-new-per-topic` | temas con mas de uno: el-chisme (Marina, Valeria, Julián) / la-vacilada (Andrés, Yuly, Daniela) / el-desahogo  | prosa |  |
| Friends spanish/colombia c1 | **live** | 7 | `cast-first-story-only-fixed` | 3 en la primera (Manu, Manuela, Camilo). La abre el reparto estable y nadie mas: dos personas como mucho. | prosa | audio 21/21, portadas 21/21 |
| Expat french/france a1 | draft | 5 | `cast-fixed-max-two` | 5 salen en media o mas: Manon (21/21), Sylvie (7/21), Juliette (5/21), Camille (4/21), Pauline (4/21). Tres vo | prosa | audio 7/21 |
| Traveler german/germany a0 | draft | 5 | `cast-fixed-max-two` | 5 salen en media o mas: Hannah (21/21), Elias (12/21), Sophie (4/21), Leon (4/21), Katrin (4/21). Tres voces s | prosa | audio 1/21 |
| Traveler german/germany a1 | draft | 15 | `cast-one-new-per-topic` | temas con mas de uno: meeting-new-people (Max, Sofie, Clara) · presentados tarde: Stefan (aparece en la 2a de  | prosa | - |
| Friends german/germany b1 | draft | 8 | `cast-fixed-max-two` | 4 salen en media o mas: Bastian (21/21), Lena (21/21), Miriam (4/21), Verena (4/21). Tres voces sostenidas se  | prosa | - |
| Expat german/germany c1 | draft | 7 | `cast-fixed-max-two` | 6 salen en media o mas: Nora (21/21), Ole (13/21), Wiebke (6/21), Merle (6/21), Boysen (2/21), Fiete (3/21). T | prosa | - |
|  |  |  | `cast-first-story-only-fixed` | 3 en la primera (Nora, Ole, Wiebke). La abre el reparto estable y nadie mas: dos personas como mucho. | orden (metadatos) |  |
| Cultural spanish/latam a0 | draft | 12 | `cast-one-new-per-topic` | temas con mas de uno: carnival-and-parades (Daniela, Camila, Mateo) | prosa | audio 12/21, portadas 21/21 |
|  |  |  | `cast-first-story-only-fixed` | 3 en la primera (Daniela, Camila, Mateo). La abre el reparto estable y nadie mas: dos personas como mucho. | prosa |  |
| Friends spanish/colombia a0 | draft | 5 | `cast-fixed-max-two` | 3 salen en media o mas: Andrés (21/21), Mariana (21/21), Lina (4/21). Tres voces sostenidas se confunden de oi | prosa | portadas 2/21 |
| Friends spanish/mexico c1 | draft | 6 | `cast-fixed-max-two` | 5 salen en media o mas: Regina (21/21), Beto (4/21), Chucho (3/21), Marisol (2/21), Nayeli (4/21). Tres voces  | prosa | - |
| Friends spanish/argentina c1 | draft | 6 | `cast-one-new-per-topic` | temas con mas de uno: mar-del-plata (Seba, Sole) · presentados tarde: Ciro (aparece en la 2a de bariloche) | prosa | audio 2/21, portadas 21/21 |

## 7. Estado

verified:
- `castOf` arreglado: 139 perdidos pasan a 45, con 2 falsos positivos, los dos
  perros. 12 tests, uno por camino. `--dir src/lib/__tests__` (309) y
  `--dir scripts/__tests__` (100) verdes.
- El filtro de "solo quien habla" probado y medido: quita 1 falso positivo y
  19 personas. Descartado y revertido.
- `JourneyStory.cast` vacia en los 51 journeys; `dialogueSpec` ausente en los
  dos journeys de los perros. Consultado en la base.
- Gates corridos con el validador de verdad y en el ORDEN DE LECTURA real,
  antes y despues: 23 gates en rojo pasan a 28, con 15 nuevos y 10 resueltos.
- El swap de `medellin` cierra `one-new-per-topic` en el Friends ES colombia
  C1 sin abrir ningun otro gate.

not verified:
- El reparto "real" sigue siendo el proxy (persona nombrada en 3 historias o
  mas, lista curada a mano en `scripts/_castNames.json`).
- Nadie ha LEIDO las historias de `medellin` para confirmar que abrir el tema
  con la Comuna 13 se lee mejor que con las arepas. El gate esta verde; el
  arco no lo ha juzgado una persona.
- La columna "arreglo: orden o prosa" es heuristica.
- No se ha tocado ningun texto de ninguna historia.
- El umbral de 2 historias sigue igual; explica 28 de los 45 que faltan.
