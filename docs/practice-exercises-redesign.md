# Practice Exercises — Rediseño (propuesta)

Estado: propuesta para revisión. Autor: análisis sobre journey LATAM (2026-06).
Objetivo: ejercicios **confiables y predecibles** (audio incluido) y
**pedagógicamente buenos**, en vez de generación por muestreo + clip de audio
impredecible.

---

## 1. Diagnóstico (con evidencia del LATAM)

Datos: 55 historias, solo **3** con `StoryPracticeSet`; 75 ejercicios, 50 con
audio pre-render. Análisis de `la-promesa-del-mole` (24) y `sin-cumbia`.

Problemas, por causa raíz:

1. **Distractores incoherentes.** `getDistractorWords/Meanings` toma de un
   **pool agregado de vocab de todas las historias del idioma**, filtrado solo
   por *forma* (multi/una palabra) + un `wordType` grueso. No filtra por **nivel
   CEFR**, **subcategoría gramatical**, ni **campo semántico**. Resultado real:
   - `"acabo de"` (locución) compite con `"Parque Nacional de Chingaza"`,
     `"Indígena Wayuu"` (lugares multiword) → se resuelve por absurdo.
   - `"fácil"` (A2) compite con `"exuberante"`, `"imborrable"`, `"bulliciosa"`
     (C1) → off-level.
   - Sustantivos propios/culturales y mayúsculas a media oración.
2. **Duplicación.** Las 24 son ~12 ítems repetidos con distractores re-tirados.
   No es práctica adicional; es el mismo ítem dos veces.
3. **`listen_choose` degenerado.** La "oración" es la **palabra suelta**; eliges
   ortografía entre 4 palabras sin relación. Sin valor de comprensión auditiva.
4. **Etiquetas de hablante** en las oraciones (`"Mateo: …"`).
5. **Idioma mezclado** en opciones (definición en español entre 3 en inglés).
6. **Audio impredecible.** El web clipa del master por `audioWordTimings`; a
   mitad de turno no hay silencio y el timing de aeneas es aproximado → el clip
   "sangra" al inicio de la oración siguiente (no hay punto de corte determinista
   dentro de un turno). El mobile usa un `audioUrl` Piper pre-render → **dos
   fuentes de audio distintas para el mismo ejercicio**.
7. **Cobertura mínima:** 3/55.

Conclusión: el problema no es solo el clipping; es que **la autoría de
ejercicios** (distractores, nivel, dedup, tipos, audio) es débil de raíz.

---

## 2. Principios de diseño

- **No resoluble por descarte.** Un ítem solo debe poder responderse sabiendo el
  idioma, no por nivel/categoría/longitud de las opciones.
- **Audio determinista.** Cada ejercicio tiene un audio **propio, pre-renderizado
  y conocido exactamente** (no clips por timing aproximado). Una sola fuente.
- **Calibrado al nivel** de la historia (A1/A2/…): vocab objetivo y distractores
  en banda CEFR (target ±1), nunca arriba.
- **Curado y bloqueado.** Cada set se autoría una vez (con Claude), se valida y se
  `locked=true`. Editable en Studio sin redeploy.
- **Cobertura total:** toda historia con audio tiene su set completo.
- **Misma voz que la historia.** El audio del ejercicio usa la **voz del personaje**
  (ElevenLabs), reforzando reconocimiento, no una voz genérica.

---

## 3. Catálogo de tipos (mantener / rediseñar / quitar)

| Tipo | Decisión | Qué prueba | Audio |
|---|---|---|---|
| `cloze_context` (ex `fill_blank`) | **mantener, arreglar** | producción léxica en contexto real | oración completa correcta (voz personaje) |
| `meaning_in_context` | **mantener, arreglar** | significado contextual (palabra→glosa EN) | oración (voz personaje) |
| `listen_comprehension` (rediseño de `listen_choose`) | **rediseñar** | comprensión auditiva de una **línea**, no de una palabra | línea completa; pregunta sobre contenido o hueco |
| `natural_expression` | **mantener, acotar** | locuciones/colocaciones | oración con la locución |
| `match_meaning` | **mantener, acotar** | red léxica (4 pares nivel-homogéneos) | opcional (palabra) |
| `dictation` (nuevo, B1+) | **opcional fase 2** | producción ortográfica desde audio | línea completa |
| `order_words` (nuevo) | **opcional fase 2** | sintaxis/orden | oración (voz personaje) |

Quitar el `listen_choose` actual (palabra suelta + distractores random).

### Compuerta de auto-validación (correr ANTES de mostrar cada set)

No mostrar un set sin pasar cada ítem por esto (el autor lo corre, no el
usuario):

1. ¿Practica una palabra del vocab? (si no, fuera — ej. comprensión de trama en inglés)
2. ¿Respuesta única? (ningún distractor sinónimo ni igual de válido)
3. ¿Distractores mismo nivel CEFR (±1), misma categoría, insertables (género/persona/tiempo), sin nombres propios, minúscula?
4. ¿La opción correcta NO se delata (no más larga/específica/detallada que las otras)?
5. ¿Andamiaje en inglés (instrucción + opciones meta), español solo para lo que se aprende?
6. ¿Forma de la glosa = forma de la palabra mostrada?
7. ¿Sin etiqueta de hablante, sin em-dash, sin idioma mezclado en las opciones?
8. ¿Match con significados desalineados de las palabras?
9. ¿Resoluble solo sabiendo el idioma (no por descarte de nivel/longitud/categoría)?
10. Gestalt: leer los ~9 seguidos — ¿variedad real de tipos? ¿algún patrón repetido?
11. **Poca carga de texto.** Instrucción ≤ ~8 palabras; máximo UNA línea española corta; opciones de pocas palabras. NUNCA opciones que sean oraciones largas (eso fue el bug de la comprensión). Si un ítem exige leer mucho, se simplifica o se descarta.
12. **Dificultad de distractores calibrada al nivel (CLAVE).** En **A2** los distractores son **claramente distintos** (significados obvios y separados) → el que entiende la oración elige el correcto. PROHIBIDO en A2: 4 opciones que son **sentidos de la misma palabra** (llevar = require/carry/take-time/wear) o casi-sinónimos — eso es discriminación de sentidos = **B1+**. Polisemia/idioms: testear su sentido básico o moverlos a niveles altos.
13. **Resaltar la palabra objetivo** en la oración de ejemplo (envolver en `[[palabra]]`; el renderer la pone en negrita/subrayada).

### Inventario de tipos (SOLO TEXTO, sin audio)

La monotonía actual ("match + muro de meaning") no es por falta de audio: es
por inventario pobre. Con texto solo hay variedad cognitiva real. Cada tipo
prueba una faceta distinta y aplica a un perfil de palabra distinto:

| Tipo | Tarea cognitiva | Cuándo aplica |
|---|---|---|
| `meaning_in_context` | reconocer el sentido | polisemia / idiom / figurado |
| `reverse_recall` | **producir** la palabra desde su significado | palabra de alto valor que conviene producir |
| `cloze` | producir en contexto | SOLO colocación fuerte / slot con respuesta única |
| `collocation` | completar el chunk fijo | locuciones, colocaciones (dar la vuelta, fuego lento) |
| `odd_one_out` | categorizar (el intruso) | conjunto de palabras de un campo (aprovecha transparentes) |
| `word_order` | sintaxis (armar la frase) | una línea cuya estructura vale practicar |
| `error_correction` | detectar la palabra mal | colocación / pares confundibles |
| `comprehension` / `dialogue_next` | comprensión + pragmática de la escena | trama / qué diría el personaje |
| `match_meaning` | reconocer (rápido) | calentamiento de un set chico |

Regla de oro: **emparejar tipo↔palabra** (perfil §3) y **filtrar por valor**
(descartar transparentes salvo que entren en un `odd_one_out`/`match`); ~6-9
ejercicios buenos por historia, no 10 forzados. El audio añade una modalidad
(reconocimiento auditivo) pero NO es requisito de variedad.

### Reglas por tipo
- **cloze_context**: hueco = la **forma `surface`** que aparece en la historia
  (no el lema), para que la opción concuerde con la sintaxis. Oración corta
  (≤ 12 palabras), **sin etiqueta de hablante**.
  - **REGLA (objetivo = comprensión de la palabra, no memoria de la trama):** el
    cloze debe resolverse **solo por significado**. Quien nunca leyó la historia
    debe poder elegir la palabra correcta por el contexto de la oración. La frase
    lleva una **pista semántica** (causa/efecto, objeto, descriptor) que solo la
    palabra objetivo satisface. **NO copiar la oración de la historia cuando
    depende de un evento o chiste del argumento** (ej. "quemar el agua"); en ese
    caso se redacta una micro-oración nueva, autosuficiente, que revela el
    significado (ej. "Dejaste la olla en el fuego demasiado tiempo y _____ la
    sopa." → `quemaste`; distractores enfriaste/serviste/probaste). Si el
    significado no se puede forzar por contexto, mover la palabra a
    `meaning_in_context`. Esto se suma a la regla dura de respuesta única (§4.8).
- **meaning_in_context**: 4 glosas en inglés, todas del **mismo registro/longitud**,
  semánticamente cercanas pero distinguibles; nunca mezclar idioma; nunca una
  glosa "obvia" (la correcta no debe ser la única plausible).
  - **Oración ≤ 12 palabras**, recortada a la cláusula que contiene la palabra
    marcada. NO usar la oración entera de la historia si trae cláusulas de
    ambientación (nombres, ciudad/país, subordinadas): se cae fuera de la tarjeta
    y carga de lectura innecesaria. La palabra ya se muestra arriba; la oración
    solo da contexto mínimo. (Mismo tope que el cloze, §3.)
  - **Headline = forma de diccionario, NUNCA la flexionada.** La palabra grande
    que se enseña va en su forma de cita: sustantivo en singular, adjetivo/
    participio en masculino singular, verbo en infinitivo, AUNQUE el vocab guarde
    la forma flexionada como `word` (LATAM guarda "ollas", "destinos",
    "agachados"). La flexión vive solo dentro del `[[ ]]` de la oración. Al pasar
    el sustantivo a singular, las glosas también van en singular ("a cooking pot",
    no "cooking pots"; el adjetivo inglés es invariable). Excepciones: plurales
    lexicalizados ("ganas"), idiom verbal completo solo cuando el uso ES el idiom.
- **match_meaning**: 4 palabras ↔ 4 glosas. Las palabras-tarjeta también en
  **forma de diccionario** (singular: carro, vecino, bandera, paso, papel…);
  solo se dejan adverbios invariables (lejos, juntos) y plurales lexicalizados.
  No tiene oración, así que no hay superficie que respetar: siempre el lema.
- **listen_comprehension**: reproduce una **línea completa** (voz personaje) y
  pregunta (a) qué palabra completó el hueco, o (b) cuál de 4 paráfrasis es
  verdadera. El audio es el activo central → debe ser exacto.

**Mezcla por set (sin audio aún):** 10 ejercicios = 6 `meaning_in_context` + 3
`cloze_context` + 1 `match_meaning`; 13 palabras distintas, ninguna repetida.

---

## 4. Distractores — el corazón del rediseño

Un distractor válido cumple **todas**:

1. **Misma categoría gramatical** (POS) y subcategoría (verbo↔verbo conjugado a
   la misma persona/número; sustantivo común↔sustantivo común; locución↔locución).
   Nunca un nombre propio/lugar como distractor de palabra funcional.
2. **Banda CEFR = nivel de la historia ±1**, jamás por encima. (Usar el juez CEFR
   ya existente + nivel de historia.)
3. **Insertable en el hueco** (cloze): que encaje sintácticamente, para que no se
   descarte por gramática. **Gramaticalmente neutro:** los 4 comparten conjugación/
   género/número, para que la GRAMÁTICA nunca delate la respuesta (la única señal
   debe ser el significado). La oración misma debe estar bien concordada ("la combi
   iba llena", NO "el autobús llena"); los verbos reflexivos conservan -se
   ("mudarse", no "mudar").
4. **Plausible / near-miss semántico**: idealmente del mismo campo o cercanos en
   significado, de modo que distinguir exija comprensión (p.ej. para `fácil` →
   `simple`, `rápido`, `claro`; no `exuberante`).
5. **Forma y caja consistentes** (minúscula a media oración, misma flexión).
6. **Sin solape** con la respuesta ni entre sí.
7. **Paralelismo, sin tronco repetido.** Las opciones no deben compartir un
   prefijo redundante ("Indicates something… / Indicates something…"); se
   factoriza el tronco común al enunciado y cada opción deja solo lo que la
   distingue, con estructura gramatical paralela y longitud similar.
9. **Forma de la glosa = forma de la palabra mostrada.** Si arriba se muestra
   el lema infinitivo (`llevar`), las opciones van en infinitivo ("to require",
   no "it requires"); si la entrada es un chunk en 1ª persona (`acabo de`),
   glosas en 1ª persona ("I just…"); sustantivo → sustantivo; expresión → la
   expresión. Para testear un idiom verbal, la palabra mostrada debe ser la
   frase (`levantar la vista`), no el sustantivo suelto (`vista`).
8. **Cloze = respuesta ÚNICA (regla dura).** Un `fill_blank` solo es válido
   si el contexto fuerza una sola palabra. Falla si (a) los distractores son
   **sinónimos** del target (ej. "Entre los tres lo ___" con
   sacamos/logramos/hacemos/terminamos → los 4 valen), o (b) el hueco acepta
   alternativas del mismo campo (ej. "compramos todo en el ___" con
   mercado/súper/tienda). Remedios, en orden: dar **más contexto** en la
   oración; usar distractores **no sinónimos** claramente incorrectos en el
   slot; o si la palabra es intercambiable por naturaleza (locuciones como
   "lo sacamos"), **moverla a `meaning_in_context`** (respuesta única por
   construcción). El validador debe rechazar clozes donde >1 opción complete
   gramatical y semánticamente la oración.

**Cómo conseguirlos de forma confiable:** no por muestreo de pool. Se
**autorían con Claude** en tiempo de creación (igual que las historias se
escriben con `/generate-story`, no con el botón OpenAI), dándole: texto +
vocab (`word/surface/type/definition`) + nivel + cast/voces, con estas reglas
como contrato, y se **validan + bloquean**. Es costo único, revisable, editable.

---

## 5. Audio — arquitectura

**Dejar de clipear del master.** Cada ejercicio pre-renderiza su propio mp3:

- **Texto a renderizar** = la **oración modelo completa y correcta** (para cloze,
  la oración con la palabra puesta, no el hueco), sin etiqueta de hablante.
- **Voz** = la del **personaje** que dice esa línea en la historia (mapeo
  `dialogueSpec`/`cast`); narrador → voz de narrador del journey. ElevenLabs.
- **Determinismo total:** lo que suena es exactamente lo que autorizamos; no
  depende de timings ni de silencios.
- Reusa el campo `audioUrl` de `StoryPracticeExercise` (hoy "Piper + 150ms tail").
  Añadir `audioText` (texto exacto renderizado) y `audioVoiceId` para trazabilidad
  y re-render idempotente (caché content-addressed: mismo texto+voz = misma toma).

**Costo (a confirmar contra el tier de ElevenLabs, no inventar $):** orden de
magnitud = (nº ejercicios con audio) × (longitud de línea ≈ 10–15 palabras). Si
~10 featured/historia × 55 ≈ 550 líneas cortas, es un activo **perpetuo de una
sola vez**. Las líneas de audio ya existen casi todas en los masters; alternativa
**gratis** sería cortar el **turno** (frontera con silencio real `GAP_SEC`, de
`audioFragments`) — determinista pero a veces incluye 2 oraciones. Recomendación:
**pre-render por ejercicio con voz de personaje** (confiable + exacto + on-brand);
es justo el "gastar en créditos por algo confiable" que planteaste.

---

## 6. Pipeline de autoría + validación

1. **Autoría (Claude)** por historia: genera M ejercicios (featured 10 + pool),
   con distractores que cumplen §4, oraciones limpias, y para cada uno el
   `audioText` + speaker→voz.
2. **Validador determinista** (estilo validator de historias) que rechaza:
   - etiqueta de hablante en `sentence`;
   - distractor fuera de banda CEFR / POS distinta / es nombre propio;
   - opciones con idioma mezclado, mayúscula espuria, duplicados, <4 opciones;
   - respuesta ausente de la oración (cloze) o no única;
   - palabra repetida dentro del set featured.
3. **Pre-render de audio** (voz personaje, ElevenLabs, content-addressed).
4. **Revisión humana + `locked=true`.**

Lectura gestalt obligatoria antes de aprobar: leer las 10 featured seguidas
para cazar repetición de patrón/oración entre ítems.

---

## 7. Cambios de modelo

`StoryPracticeExercise` (aditivo):
- `audioText String?` — texto exacto renderizado.
- `audioVoiceId String?` — voz usada.
- `cefr String?` — nivel del ítem (para filtrar pool y validar distractores).
- (opcional) `distractorSource String?` — `authored` | `pool` (auditoría).

Sin cambios destructivos; backfill perezoso.

---

## 8. Migración / rollout

- Los 3 sets actuales están `locked=false` → se regeneran.
- Rollout **historia por historia** (empezar por las que ya tienen audio del
  LATAM A2), `locked=true` tras revisión.
- Web y mobile leen el mismo `audioUrl` pre-render (elimina la divergencia y el
  bug de clip).

---

## 9. Decisiones que necesito de ti

1. **Voz del audio del ejercicio:** ¿voz de personaje (ElevenLabs, créditos) o
   Piper gratis? (recomiendo personaje).
2. **Alcance fase 1:** ¿solo arreglar los 3 tipos núcleo (cloze, meaning, listen)
   o incluir match/natural desde ya? (recomiendo núcleo + natural).
3. **Distractores:** ¿autoría con Claude (recomendado) o intentar primero mejorar
   el muestreo de pool con filtros CEFR+POS+semántica?
4. **Tipos nuevos (dictation/order_words):** ¿fase 2 o descartar?

---

## 10. Hallazgos de arquitectura (preview localhost, 2026-06)

Descubierto al sembrar el set curado de `la-promesa-del-mole` y verlo en
`/practice`:

1. **El practice web tiene DOS caminos** (`src/app/practice/page.tsx`,
   `const exercises = useMemo`):
   - `if (isJourneyCheckpoint) return prefabExercises;` → usa el
     `StoryPracticeSet` persistido (lo que devuelve `/api/story-practice`
     vía `loadPersistedExercises`).
   - `else → buildPracticeSession(orderedFavorites, selectedMode, …)` →
     **genera en cliente desde el vocab**, ignorando el set curado.
   - `isJourneyCheckpoint = searchParams.get("checkpoint") === "1"`.
   Consecuencia: hoy el set curado **solo** se ve en el flujo de checkpoint
   (fin de historia) y con `?…&checkpoint=1`. Los modos sueltos del tab de
   práctica (Context/Meaning/…) muestran ejercicios generados al azar.
   **Acción del rediseño:** rutear también los modos sueltos al set curado
   (el `StoryPracticeSet` debe ser la fuente de verdad en web, no solo en
   mobile/checkpoint).

2. **`loadPersistedExercises` solo conoce 5 tipos** (fill_blank,
   meaning_in_context, listen_choose, natural_expression, match_meaning) y
   exige `story.status = "published"`. Tipos nuevos sin su `case` se
   descartan.

3. **NO forzar stand-ins.** Meter un ítem de listening (comprensión de una
   línea) dentro del renderer `meaning_in_context` produjo un ejercicio
   incoherente ("What does *acabo de* mean?" con opciones que son
   comprensión de toda la frase). Cada tipo nuevo necesita **su propio
   `case` en `loadPersistedExercises` + su renderer + su audio**, no
   encajarse en otro tipo. `listen_comprehension` es un tipo nuevo
   pendiente de renderer + audio.
