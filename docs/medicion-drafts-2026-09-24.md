# Cuantos journeys en `draft` cumplen las reglas de HOY

Medicion del 2026-09-24. No se escribio nada en la base: todo con `--dry`.
Base de la medida: rama `claude/medicion-castof` (a635ee7f), que lleva el
`castOf` arreglado; `main` era 386c351e.

## Respuesta corta

**Ninguno de los 22 journeys en `draft` esta limpio hoy.** Ni uno pasa a la vez
el gate de conjunto y el validador canonico historia por historia.

| Clase | Journeys |
|---|---|
| Limpios (0 fallos de conjunto y 0 canonicos) | **0** |
| Deuda solo de metadatos (vocab, `arcType`, sinopsis, titulo) | **3** |
| Exigen reescribir prosa | **15** |
| Sin terminar (menos de 21 historias) | **4** |

Los 4 sin terminar no son deuda: AR/EGYPT, KO/KOREA y PL/POLAND tienen **1 de
21** historias (pilotos), y ES/SPAIN B1 tiene **18 de 21**.

## Como se midio

1. **Gate de conjunto** (`validateJourneyStories`, 18-19 reglas segun idioma y
   nivel) sobre las 21 historias juntas, con `conjuntoCompleto` y
   `plazasTotales: 21`. Orden de las historias = el array `Journey.topics`,
   **nunca alfabetico** (`scripts/_medConjunto.ts`).
2. **Validador canonico por historia** (`validateGeneratedStory`) via
   `scripts/saveStory.ts --dry`, con `DATABASE_URL` presente, asi que
   `vocab-taught-same-type` y `vocab-taught-elsewhere` SI corrieron (se
   comprobo: aparecen fallando en varios journeys). Las 21 historias van en una
   sola llamada, que es el ambito correcto de `vocab-taught-same-type`.
3. **Diferencial `castOf`**: la misma medida repetida con la version de `main`
   del validador, para aislar lo que cambia el detector arreglado.

## Tabla, ordenada por cuanto falta

`conjunto` = reglas de conjunto que fallan. `canon` = historias con al menos un
FAIL canonico, sobre las escritas. `ciegas` = reglas que devuelven
`not-implemented` en ese journey, es decir que **no se midieron**.

| # | Journey | escritas | conjunto: reglas que fallan | canon | reglas canonicas (x historias) | ciegas |
|---|---|---|---|---|---|---|
| 1 | DE/germany C1 expat | 21/21 | character-introduction, opening-shape, repeated-opener, no-elderly-no-children, vocab-level-floor, cast-fixed-max-two | 21/21 | body-word-count x21, synopsis-length x20, vocab-surface-contiguous x20, vocab-distribution x16, vocab-taught-same-type x12, vocab-no-same-root x5, vocab-taught-elsewhere x2, arctype-rotation, body-dialogue-ratio, title-length, dialogue-bare-imperative | vocab-recirculation |
| 2 | ES/mexico C1 friends | 21/21 | quoted-speech-band, character-introduction, opening-shape, cast-fixed-max-two | 21/21 | body-word-count x21, vocab-taught-same-type x17, vocab-taught-elsewhere x2, narrator-sensory-anchor x2, names-match x2, narrator-speaker-introduced | vocab-recirculation |
| 3 | ES/argentina C1 friends | 21/21 | quoted-speech-band, character-introduction, cast-one-new-per-topic | 21/21 | body-word-count x21, body-dialogue-ratio x3, speakers-count x3, speaker-lines x3, vocab-no-same-root x2, title-length | vocab-recirculation |
| 4 | ES/argentina A1 friends | 21/21 | character-introduction | 21/21 | synopsis-length x21, body-word-count x21, arctype-valid x21, vocab-definitions x21, vocab-level-frequency x21, body-voseo-forms x14 (falso, ver abajo), vocab-types x13, vocab-taught-elsewhere x8, title-uniqueness, vocab-distribution, narrator-speaker-introduced | - |
| 5 | FR/france A1 expat | 21/21 | cast-fixed-max-two | 21/21 | synopsis-length x21, body-word-count x21, arctype-valid x21, vocab-definitions x21, vocab-level-frequency x21, vocab-types x5, vocab-taught-elsewhere x3, title-length x3, vocab-distribution x3, vocab-no-same-root | - |
| 6 | DE/germany A1 traveler | 21/21 | cast-one-new-per-topic | 21/21 | body-word-count x21, vocab-taught-elsewhere x8 | vocab-worth-teaching |
| 7 | DE/germany A0 traveler | 21/21 | cast-fixed-max-two | 17/21 | body-word-count x14, vocab-taught-elsewhere x10 | vocab-worth-teaching |
| 8 | PT/brazil A0 traveler | 21/21 | character-introduction | 15/21 | body-word-count x15, opening-rhythm-rotation | a0-floor, vocab-worth-teaching |
| 9 | IT/italy A2 traveler | 21/21 | character-introduction | 13/21 | body-word-count x9, vocab-level-frequency x5, arctype-rotation x4 | vocab-worth-teaching |
| 10 | PT/brazil B2 traveler | 21/21 | character-introduction | 9/21 | body-word-count x9 | vocab-worth-teaching |
| 11 | ES/latam A0 cultural | 21/21 | character-introduction, cast-one-new-per-topic, cast-first-story-only-fixed | 4/21 | vocab-taught-elsewhere x4 | a0-floor |
| 12 | ES/latam A0 conversations | 21/21 | quoted-speech-band, vocab-recirculation | 0/21 | - | a0-floor |
| 13 | ES/colombia A0 friends | 21/21 | cast-fixed-max-two | 0/21 | - | a0-floor |
| 14 | DE/germany B1 friends | 21/21 | introduction-form-variety | 0/21 | - | - |
| 15 | ES/chile A1 friends | 21/21 | character-introduction | 0/21 | - | - |
| 16 | **PT/brazil A1 friends** | 21/21 | **ninguna** | 21/21 | vocab-level-frequency x21, arctype-rotation x2 | - |
| 17 | **IT/italy A1 friends** | 21/21 | **ninguna** | 3/21 | arctype-rotation x3 | - |
| 18 | **ES/latam A1 friends** | 21/21 | **ninguna** | 1/21 | vocab-taught-elsewhere | - |
| - | ES/spain B1 friends | **18/21** | character-introduction | 3/18 | arctype-rotation x3 | - |
| - | AR/egypt A0 traveler | **1/21** | quoted-speech-band | 1/1 | body-word-count, narrator-sensory-anchor | character-introduction, a0-floor, names-target-language |
| - | KO/korea A0 traveler | **1/21** | quoted-speech-band | 1/1 | body-word-count, narrator-sensory-anchor | character-introduction, a0-floor, names-target-language |
| - | PL/poland A0 traveler | **1/21** | quoted-speech-band | 1/1 | body-word-count, narrator-sensory-anchor | character-introduction, a0-floor, names-target-language |

Los cuatro de abajo van aparte porque no estan escritos, no porque esten bien.

## Metadatos o prosa

**Solo metadatos (3):** PT/brazil A1, IT/italy A1, ES/latam A1. Lo suyo se
arregla cambiando entradas de vocabulario, rellenando o rotando `arcType` y
tocando sinopsis o titulo. Nadie tiene que reescribir un parrafo.

**Exigen prosa (15):** todos los demas completos. Lo que los ata no es una
columna, es el cuerpo:

- `body-word-count` (12 journeys, hasta 21/21 historias): la banda de palabras
  por nivel se estrecho despues de escribirlos. Un C1 de 234 palabras contra
  una banda 150-177 no se arregla sin cortar prosa.
- `journey-character-introduction` (9 journeys): falta el sintagma que dice
  quien es cada personaje, o se uso el giro prohibido "Quem ... e X" /
  "Quien ... es X". Es una frase nueva dentro del cuerpo.
- `journey-cast-*` (6 journeys): hay tres o mas voces sostenidas donde el tope
  son dos, o dos personajes nuevos en el mismo tema. Se arregla quitando gente
  de las escenas.
- `journey-quoted-speech-band`, `journey-opening-shape`,
  `journey-repeated-opener`, `body-dialogue-ratio`, `speakers-count`,
  `speaker-lines`, `narrator-sensory-anchor`: todos miden la forma del cuerpo.

Caso limite: **ES/latam A0 conversations** falla `journey-vocab-recirculation`
con 52% de cola contra un tope de 30%. Es una columna (vocab), pero rehacer 185
lemas para que se reencuentren no es un retoque de metadatos; cuenta como
trabajo grande aunque no toque la prosa.

## Lo que pasa solo porque un gate esta roto o ciego

Esto es lo que no se ve en la tabla de arriba.

### 1. El `castOf` de `main` regalaba aprobados

Midiendo lo mismo con `main` y con la rama, 7 journeys cambian de veredicto a
peor y 4 a mejor:

| Journey | regla | main | rama arreglada |
|---|---|---|---|
| DE/germany C1 | cast-fixed-max-two | pass | **fail** |
| DE/germany A1 | cast-one-new-per-topic | pass | **fail** |
| DE/germany A1 | cast-protagonist-in-all | not-implemented | pass |
| DE/germany B1 | introduction-form-variety | pass | **fail** |
| ES/colombia A0 | cast-fixed-max-two | pass | **fail** |
| ES/chile A1 | character-introduction | pass | **fail** |
| ES/spain B1 | character-introduction | pass | **fail** |
| ES/latam A0 cultural | cast-one-new-per-topic | pass | **fail** |
| ES/latam A0 cultural | cast-first-story-only-fixed | pass | **fail** |
| DE/germany C1, DE/germany A1, ES/argentina C1, ES/mexico C1, ES/latam A0 conv. | closing-alone | fail | pass |
| ES/latam A0 conv. | repeated-opener | fail | pass |
| ES/latam A0 conv. | cast-protagonist-in-all | not-implemented | pass |

Con el detector de `main`, **7 journeys** salian con cero fallos de conjunto
(ES/latam A1, ES/colombia A0, IT/italy A1, PT/brazil A1, ES/chile A1,
DE/germany B1, ES/spain B1). Con el arreglado quedan **3**. Cuatro de esos
siete estaban limpios por ceguera del detector.

En la otra direccion, `journey-closing-alone` daba **falsos FAIL** en 4
journeys: el detector no veia el reparto de la escena de cierre.

### 2. `JourneyStory.cast` esta vacia en los 22

Cero historias tienen la columna `cast` poblada. Todo gate de reparto
(`cast-fixed-max-two`, `cast-protagonist-in-all`, `cast-one-new-per-topic`,
`cast-first-story-only-fixed`, `closing-alone`) corre sobre una **heuristica
que lee nombres del cuerpo**. Los numeros de arriba son los mejores que hay,
no la verdad.

### 3. `journey-a0-floor` no se mide en ningun A0

Devuelve `not-implemented` en los 4 journeys A0 escritos (ES/colombia,
ES/latam cultural, ES/latam conversations, PT/brazil) y en los 3 pilotos. El
suelo de A0 no esta medido justo donde importa. ES/colombia A0 y ES/latam A0
conversations son los dos journeys con **0 fallos canonicos**, y uno de sus
gates propios no llego a correr.

### 4. `journey-vocab-recirculation` se salta los tres C1

`not-implemented` en DE/germany C1, ES/argentina C1 y ES/mexico C1. El unico
journey donde SI corrio completo (ES/latam A0 conversations) fallo con 52% de
cola contra un tope de 30%. Un gate que revienta cada vez que se le deja mirar
esta dando un aprobado gratis a tres journeys.

### 5. `journey-vocab-worth-teaching` se salta los Traveler no-espanoles

`not-implemented` en DE A0, DE A1, IT A2, PT A0 y PT B2: no hay lexico
graduado para esos idiomas. Es justo el gate pensado para los Traveler.

### 6. `body-voseo-forms` no sabe de que pais es el journey

Detecta rioplatense **buscando topónimos en el TEXTO de la historia**
(`/\b(Argentina|Uruguay|Buenos Aires|Montevideo|Rosario|La Plata|Córdoba|
Palermo|San Telmo|Recoleta|La Boca|Belgrano)\b/`), no por la variante del
journey. Por eso ES/argentina A1 se lleva **14 FAIL falsos** por usar voseo en
un journey argentino cuya historia no nombra la ciudad. Esos 14 no son deuda.
Del lado contrario: cualquier journey NO rioplatense cuyo texto nombre
"Córdoba" (que tambien es España y Colombia) queda exento del gate.

### 7. `vocab-level-frequency` puntua mal el español regional

Marca como C2 palabras como `acá`, `vos`, `entiendo`, `vendedor`, `afuera`,
`anota`. Falla 21/21 en ES/argentina A1 y 21/21 en PT/brazil A1. Es ruido, no
deuda; pero mientras este asi, ese gate no sirve para decidir nada en esos dos
journeys.

### 8. Los pilotos no-latinos van con tres gates apagados

AR, KO y PL tienen `character-introduction`, `a0-floor` y
`names-target-language` en `not-implemented`. Su unica historia pasa casi
todo porque casi nada la mira.

## Scripts de la medida

`scripts/_medConjunto.ts`, `scripts/_medConjuntoMain.ts`, `scripts/_medDump.ts`,
`scripts/_medCanon.sh`, `scripts/_medList.ts`, `scripts/_medResumen.ts`,
`scripts/_medDelta.ts`, `scripts/_medArc.ts`, `scripts/_medDrafts.ts`.
Son scratch (`scripts/_*`), ninguno escribe en la base.

## verified / not verified

verified:
- `validateJourneyStories` corrido sobre los 22 draft, orden `Journey.topics`,
  `conjuntoCompleto` y `plazasTotales` pasados; misma corrida repetida con el
  validador de `main` para el diferencial de `castOf`.
- `validateGeneratedStory` corrido via `saveStory.ts --dry` sobre los 22, con
  `DATABASE_URL` cargado: se confirma que `vocab-taught-elsewhere` y
  `vocab-taught-same-type` emitieron veredicto (aparecen como FAIL), asi que no
  es el verde falso del `--dry` sin base.
- `JourneyStory.cast` vacia y `arcType` nulo contados en base
  (`scripts/_medArc.ts`).
- La causa del falso FAIL de `body-voseo-forms` leida en el codigo
  (`src/lib/validateGeneratedStory.ts:1629`).

not verified:
- **Ninguna lectura humana.** No se leyo una sola historia entera; no hay juicio
  sobre ritmo, gracia, tono ni si el gato aparece. Un journey con la tabla en
  verde puede seguir siendo aburrido.
- Gestalt entre historias de un mismo journey (plantillas y frases que se
  repiten) mas alla de lo que miden los gates automaticos.
- Los gates marcados `not-implemented` (a0-floor, vocab-recirculation en C1,
  vocab-worth-teaching, character-introduction y names-target-language en
  AR/KO/PL): esas reglas NO se midieron en esos journeys, ni a favor ni en
  contra.
- Cobertura de glosas: no entra en esta medida. Se mide por rama del journey,
  y aqui se midio desde una sola rama.
- Portadas, audio y ejercicios de practica: fuera de alcance.
- No se comprobo si los fallos de `vocab-level-frequency` en PT/brazil A1 son
  ruido del mismo tipo que en ES/argentina A1 o deuda real.
