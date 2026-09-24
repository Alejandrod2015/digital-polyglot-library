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

## 3. Lo que destapa: correccion de una cifra mia

Dije que habia **25 falsos verdes**. Esa cifra salio de una SIMULACION que
comparaba el reparto detectado con mi proxy del reparto real, gate por gate, y
contaba como falso verde todo gate que cambiaba de color. **Era un artefacto
del metodo**, y lo corrijo: muchos de esos gates ya estaban en ROJO por otro
motivo, asi que no habia nada oculto que destapar.

Corriendo el validador de verdad sobre los 48, antes y despues:

| | Antes del arreglo | Despues |
| --- | --- | --- |
| Journeys con algun gate de reparto en rojo | 25 | **28** |
| Gates de reparto en rojo (total) | 37 | **42** |
| Gates que pasan de verde a rojo | | **5** |
| Gates que pasan de rojo a verde | | **0** |

**La deuda que el arreglo destapa son 5 gates en 3 journeys**, no 25:

- Friends FR france A1 (**live**): `first-story-only-fixed`.
- Cultural ES latam A0 (draft): `one-new-per-topic` y `first-story-only-fixed`.
- Friends ES colombia A0 (draft): `fixed-max-two` y `first-story-only-fixed`.

Las otras 37 son deuda que ya estaba marcada en rojo y que nadie ha arreglado,
no deuda invisible. Y ningun gate pasa de rojo a verde: no habia rojos que
fueran culpa del detector, al menos no en estos cinco checks. Los falsos rojos
que medi en `closing-alone` se comian el margen del gate ("como mucho la mitad"
sobre 21 da 11) sin llegar a tirarlo.

## 4. Triaje: 28 journeys, 42 gates

**14 son LIVE y 14 draft.** De los 14 live, 13 tienen las 21 historias
narradas y con portada: tocar su prosa obliga a resintetizar audio y a
realinear karaoke.

Por regla: `first-story-only-fixed` 18, `fixed-max-two` 11,
`one-new-per-topic` 6, `closing-alone` 4, `protagonist-in-all` 3.

Por coste: **36 de los 42 piden reescribir prosa**; 6 se arreglan cambiando el
ORDEN (que historia abre el tema, o en que historia se estrena un personaje),
que es metadato y no toca ni audio ni karaoke.

| Journey | Estado | Reparto | Regla en rojo | Cifra | Arreglo | Arrastra |
| --- | --- | --- | --- | --- | --- | --- |
| Friends french/france a1 | **live** | 8 | `cast-first-story-only-fixed` | 3 en la primera (Amélie, Marc, Baptiste). La abre el reparto estable y nadie mas: dos personas como mucho. | prosa | audio 21/21, portadas 21/21 |
| Friends french/france b1 | **live** | 7 | `cast-first-story-only-fixed` | 3 en la primera (Aurélien, Élodie, Guillaume). La abre el reparto estable y nadie mas: dos personas como mucho | prosa | audio 21/21, portadas 21/21 |
| Friends german/germany a0 | **live** | 7 | `cast-first-story-only-fixed` | 3 en la primera (Anna, Jan, Johanna). La abre el reparto estable y nadie mas: dos personas como mucho. | prosa | audio 21/21, portadas 21/21 |
| Friends german/germany a1 | **live** | 5 | `cast-fixed-max-two` | 4 salen en media o mas: Julia (21/21), Moritz (17/21), Svenja (6/21), Theresa (5/21). Tres voces sostenidas se | prosa | audio 21/21, portadas 21/21 |
|  |  |  | `cast-first-story-only-fixed` | 3 en la primera (Julia, Moritz, Philipp). La abre el reparto estable y nadie mas: dos personas como mucho. | prosa |  |
| Friends german/germany c1 | **live** | 9 | `cast-fixed-max-two` | 4 salen en media o mas: Nadia (21/21), Timo (15/21), Micha (5/21), Steffi (3/21). Tres voces sostenidas se con | prosa | audio 21/21, portadas 21/21 |
|  |  |  | `cast-one-new-per-topic` | temas con mas de uno: hamburg (Hauke, Frauke) / muenchen (Korbinian, Sepp) · presentados tarde: Frauke (aparec | prosa |  |
|  |  |  | `cast-first-story-only-fixed` | 4 en la primera (Nadia, Timo, Micha, Jule). La abre el reparto estable y nadie mas: dos personas como mucho. | prosa |  |
| Expat german/germany c1 | **live** | 6 | `closing-alone` | 12/21 (protagonista Nadia): zustaendig-ist-ein-anderes-amt, endgegner-auslaenderbehoerde, sonntags-schliesst-s | prosa | audio 21/21, portadas 21/21 |
|  |  |  | `cast-fixed-max-two` | 5 salen en media o mas: Nadia (21/21), Timo (18/21), Katja (8/21), Ronja (4/21), Brandt (4/21). Tres voces sos | prosa |  |
| Traveler italian/italy a1 | **live** | 3 | `closing-alone` | 14/21 (protagonista Teo): niente-spalle-scoperte, i-gradini-non-finiscono-mai, la-piazza-si-riempie-alle-sei,  | prosa | audio 21/21, portadas 21/21 |
|  |  |  | `cast-protagonist-in-all` | Sin hilo en 4 tema(s): churches-squares (niente-spalle-scoperte, i-gradini-non-finiscono-mai, la-piazza-si-rie | prosa |  |
| Traveler portuguese/brazil a1 | **live** | 1 | `closing-alone` | 21/21 (protagonista Nara): a-areia-queima-os-pes, palmas-no-arpoador, um-balde-uma-onda, duas-moedas-para-copa | prosa | audio 21/21, portadas 21/21 |
|  |  |  | `cast-protagonist-in-all` | Sin hilo en 6 tema(s): beach-sun (a-areia-queima-os-pes, palmas-no-arpoador, um-balde-uma-onda) · getting-arou | prosa |  |
| Friends spanish/mexico a0 | **live** | 8 | `cast-first-story-only-fixed` | 3 en la primera (Karla, Bruno, Mauricio). La abre el reparto estable y nadie mas: dos personas como mucho. | orden (metadatos) | audio 21/21, portadas 21/21 |
| Traveler spanish/mexico a1 | **live** | 0 | `closing-alone` | 21/21 (protagonista ?): sofia-prueba-el-mole, sofia-sube-a-monte-alban, diego-pinta-alebrijes, sofia-sube-al-f | prosa | audio 21/21, portadas 21/21 |
| Traveler spanish/spain a1 | **live** | 5 | `cast-fixed-max-two` | 4 salen en media o mas: Irene (21/21), Rocío (15/21), Quique (9/21), Rosa (4/21). Tres voces sostenidas se con | prosa | audio 21/21, portadas 21/21 |
| Traveler spanish/spain a2 | **live** | 6 | `cast-fixed-max-two` | 6 salen en media o mas: Irene (21/21), Rocío (12/21), Rosa (5/21), Quique (6/21), Álvaro (4/21), Marta (3/21). | prosa | audio 21/21, portadas 21/21 |
| Friends spanish/latam c1 | **live** | 16 | `cast-protagonist-in-all` | Sin hilo en 1 tema(s): el-cotorreo (le-toca-a-mateo, ahorita-salgo, diez-intentos) | prosa | audio 21/21, portadas 21/21 |
|  |  |  | `cast-one-new-per-topic` | temas con mas de uno: el-chisme (Marina, Valeria, Julián) / el-desahogo (Flor, Camila, Tomás) / la-jerga (Pila | prosa |  |
|  |  |  | `cast-first-story-only-fixed` | 3 en la primera (Marina, Valeria, Julián). La abre el reparto estable y nadie mas: dos personas como mucho. | orden (metadatos) |  |
| Friends spanish/colombia c1 | **live** | 7 | `cast-one-new-per-topic` | presentados tarde: Salo (aparece en la 2a de medellin) | orden (metadatos) | audio 21/21, portadas 21/21 |
| Expat french/france a1 | draft | 5 | `cast-fixed-max-two` | 5 salen en media o mas: Manon (21/21), Sylvie (7/21), Juliette (5/21), Camille (4/21), Pauline (4/21). Tres vo | prosa | audio 7/21 |
|  |  |  | `cast-first-story-only-fixed` | 3 en la primera (Manon, Camille, Pauline). La abre el reparto estable y nadie mas: dos personas como mucho. | orden (metadatos) |  |
| Traveler german/germany a0 | draft | 5 | `cast-fixed-max-two` | 5 salen en media o mas: Hannah (21/21), Elias (12/21), Sophie (4/21), Leon (4/21), Katrin (4/21). Tres voces s | prosa | audio 1/21 |
|  |  |  | `cast-first-story-only-fixed` | 3 en la primera (Hannah, Elias, Sophie). La abre el reparto estable y nadie mas: dos personas como mucho. | prosa |  |
| Traveler german/germany a1 | draft | 15 | `cast-one-new-per-topic` | temas con mas de uno: meeting-new-people (Max, Sofie, Clara) · presentados tarde: Stefan (aparece en la 2a de  | prosa | - |
| Friends german/germany b1 | draft | 5 | `cast-fixed-max-two` | 5 salen en media o mas: Bastian (21/21), Lena (21/21), Miriam (19/21), Tobias (15/21), Verena (12/21). Tres vo | prosa | - |
|  |  |  | `cast-first-story-only-fixed` | 5 en la primera (Bastian, Lena, Miriam, Tobias, Verena). La abre el reparto estable y nadie mas: dos personas  | prosa |  |
| Expat german/germany c1 | draft | 7 | `cast-fixed-max-two` | 6 salen en media o mas: Nora (21/21), Ole (13/21), Wiebke (6/21), Merle (6/21), Boysen (2/21), Fiete (3/21). T | prosa | - |
| Traveler italian/italy a2 | draft | 7 | `cast-first-story-only-fixed` | 3 en la primera (Rosa, Teo, Nico). La abre el reparto estable y nadie mas: dos personas como mucho. | prosa | - |
| Traveler portuguese/brazil a0 | draft | 8 | `cast-first-story-only-fixed` | 3 en la primera (Larissa, Caio, Cláudia). La abre el reparto estable y nadie mas: dos personas como mucho. | prosa | - |
| Friends portuguese/brazil a1 | draft | 8 | `cast-first-story-only-fixed` | 3 en la primera (Juliana, Letícia, Gustavo). La abre el reparto estable y nadie mas: dos personas como mucho. | orden (metadatos) | - |
| Cultural spanish/latam a0 | draft | 12 | `cast-one-new-per-topic` | temas con mas de uno: carnival-and-parades (Daniela, Camila, Mateo) | prosa | audio 12/21, portadas 21/21 |
|  |  |  | `cast-first-story-only-fixed` | 3 en la primera (Daniela, Camila, Mateo). La abre el reparto estable y nadie mas: dos personas como mucho. | prosa |  |
| Friends spanish/colombia a0 | draft | 5 | `cast-fixed-max-two` | 3 salen en media o mas: Andrés (21/21), Mariana (21/21), Lina (4/21). Tres voces sostenidas se confunden de oi | prosa | portadas 1/21 |
|  |  |  | `cast-first-story-only-fixed` | 3 en la primera (Andrés, Mariana, Camilo). La abre el reparto estable y nadie mas: dos personas como mucho. | prosa |  |
| Friends spanish/latam a1 | draft | 8 | `cast-first-story-only-fixed` | 3 en la primera (Natalia, Adriana, Gustavo). La abre el reparto estable y nadie mas: dos personas como mucho. | prosa | - |
| Friends spanish/argentina a1 | draft | 4 | `cast-first-story-only-fixed` | 3 en la primera (Julieta, Damián, Facundo). La abre el reparto estable y nadie mas: dos personas como mucho. | orden (metadatos) | audio 1/21 |
| Friends spanish/mexico c1 | draft | 6 | `cast-fixed-max-two` | 5 salen en media o mas: Regina (21/21), Beto (4/21), Chucho (3/21), Nayeli (4/21), Marisol (2/21). Tres voces  | prosa | - |
|  |  |  | `cast-first-story-only-fixed` | 3 en la primera (Regina, Aldo, Nayeli). La abre el reparto estable y nadie mas: dos personas como mucho. | prosa |  |
| Friends spanish/argentina c1 | draft | 6 | `cast-one-new-per-topic` | temas con mas de uno: mar-del-plata (Seba, Sole) · presentados tarde: Ciro (aparece en la 2a de bariloche) | prosa | audio 2/21, portadas 21/21 |

"Arrastra" cuenta cuantas de las 21 historias tienen `audioUrl` y `coverUrl`
hoy: si el arreglo es de prosa, eso es lo que hay que rehacer detras.

## 5. Estado

verified:
- `castOf` arreglado y medido sobre los 48 journeys live+draft con texto:
  139 perdidos pasan a 45, con 2 falsos positivos (dos perros).
- Falsos positivos medidos explicitamente despues del cambio, que es lo que se
  pidio: ninguna palabra comun entra; los dos intentos que si las metian
  (236 y 17) estan medidos y descartados.
- 12 tests nuevos, uno por camino mas los negativos. Verdes.
- `npx vitest run --dir src/lib/__tests__` (309) y `--dir scripts/__tests__`
  (100) pasan enteros con el cambio dentro.
- Gates corridos de verdad (`validateJourneyStories`, no simulacion) sobre los
  48, antes y despues: 25 journeys en rojo pasan a 28, con 5 gates nuevos en
  rojo y 0 resueltos.

not verified:
- El reparto "real" sigue siendo el proxy de la medicion anterior (persona
  nombrada en 3 historias o mas, lista curada a mano en
  `scripts/_castNames.json`). Los personajes de una o dos historias no se
  miden.
- La columna "arreglo: orden o prosa" es una heuristica: para
  `first-story-only-fixed` mira si otra historia del mismo tema tiene dos
  personajes o menos. Nadie ha leido las historias para confirmarlo.
- No se ha arreglado NINGUN journey. Ni uno.
- El umbral de 2 historias sigue igual, a proposito.
- `npx vitest run` entero da 363 fallos, TODOS en copias bajo
  `.claude/worktrees/**` (otras ramas en curso, entre ellas una que ya toca
  `castOf` con un `extractSpeakerNames`). Ninguno en este checkout.
