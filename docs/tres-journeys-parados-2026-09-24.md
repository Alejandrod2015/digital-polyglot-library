# Tres journeys parados: que falta exactamente y que comando lo cierra (2026-09-24)

Encargo del chat de planificacion: MEDIR y PREPARAR. No se genero ni un clip,
ni una portada, no se escribio en la base, no se publico nada y no se hizo
push. Todo lo de abajo sale de consultas de lectura contra produccion, de
peticiones HEAD contra R2 (gratis), del historial de git y de leer los guards.

Se lee sin haber seguido ninguna conversacion: cada seccion dice el id, el
hueco, el comando y el coste.

## 0. Los tres ids, verificados contra la base

El encargo traia un id literal y dos por buscar. Los tres se comprobaron uno a
uno (`journey.typeSlug` + `language` + `variant` + `levels`) antes de tocar
nada, porque hoy mismo casi se escribe encima de un journey publicado con un id
equivocado.

| Journey | Id | typeSlug | status | Historias |
|---|---|---|---|---|
| `spanish/mexico` Friends a0 | `cmud5qhu00006j81cmkl4u5ks` | relationships | draft | 21 |
| `spanish/latam` Conversations a0 | `cmub5my8d000432ye0v6pv5ng` | conversations | draft | 21 |
| `german/germany` Friends a2 | `cmubidgaf0007j8np6g7n89iu` | relationships | draft | 21 |

Dos avisos sobre los ids: hay **dos** journeys `spanish/latam a0` en draft, y el
otro (`cmu410zep000732szrw94t2sl`) es el **Cultural**, no el Conversations. Y el
`spanish/latam a0` publicado (`cmqrtaj1p000032qtda86z6um`) es el Traveler. El
unico Conversations es el de la tabla.

Cuota de ElevenLabs al medir: **390.255 / 600.000 usados**, quedan **209.745**
hasta el reset del 2026-10-07 (`npx tsx scripts/_quota.ts`, GET, gratis).

## 1. Resumen de los tres

| Journey | Clips de palabra | Clips de frase | Portadas | Otro bloqueo | Caracteres (1 toma) | % de la cuota restante |
|---|---|---|---|---|---|---|
| mexico a0 | faltan **254** (6 ya en R2) | 0, estan las 82 | 0, estan las 21 | **20 historias narradas con los nombres viejos** | ~12.513 | 6,4% a 6,9% |
| latam a0 Conversations | faltan **285** | faltan **51** | faltan **21** | ninguno | ~4.115 | 3,0% a 3,9% |
| germany a2 | falta **1** | 0, estan las 63 | faltan **21** | ninguno | 9 | 0,01% |
| **Los tres** | **540** | **51** | **42** | | | **9,4% a 10,8%** |

El porcentaje de la derecha ya lleva dentro la re-tirada del gate F0 (los
generadores tiran hasta 6 tomas por clip; la horquilla asume de 1,5x a 2x sobre
los clips de practica). La narracion no re-tira: va a una toma.

Las 42 portadas **no gastan cuota de ElevenLabs**: gastan creditos de imagen, y
esos van por su propio contador y su propio permiso.

## 2. Lo que bloquea, agrupado por tipo

Salida de `npx tsx scripts/publishJourney.ts <id> --dry`, transcrita y agrupada.
El gate mira siete cosas: 21 historias, texto, titulo, narracion (`audioUrl`),
portada (`coverUrl`), continuidad de arco (un `mini-cliffhanger` no puede cerrar
un tema) y audio de practica (`wordClipUrl` en cada `meaning_in_context`,
`clipUrl` en cada `fill_blank`).

| Tipo de bloqueo | mexico a0 | latam a0 | germany a2 |
|---|---|---|---|
| Menos de 21 historias | - | - | - |
| Sin texto o titulo | - | - | - |
| Sin narracion | - | - | - |
| Sin portada | - | 21 historias | 21 historias |
| `mini-cliffhanger` en el ultimo slot | - | - | - |
| Sin set de practica | - | - | - |
| Audio de practica: palabra | 21 historias, 254 clips | 21 historias, 285 clips | 1 historia, 1 clip |
| Audio de practica: frase | - | 21 historias, 51 clips | - |
| **Lineas de BLOQUEADO** | 21 | 42 | 22 |

### Lo que el gate NO mira y si esta roto: mexico a0

`npm run lint:karaoke-fresh` (`scripts/checkKaraokeFresh.ts`, enganchado al
pre-push) saca **20 de las 21 historias de mexico a0** con el karaoke por
detras del texto. La unica limpia es `poquito-son-dos-dedos`.

No es un desfase de parrafos: es que el texto se renombro DESPUES de narrar.
Comparando el texto actual con la copia que se guardo al alinear, la unica
diferencia en los **78 bloques** afectados son dos nombres propios:

- **Itzel → Karla** (la mayoria de los bloques)
- **Citlali → Renata** (`el-timbre-si-suena`, `tu-propia-firma`, `pintan-el-14`)

Viene del commit `3b6bf4c2f` ("Itzel pasa a Karla y Citlali a Renata", en la
rama `claude/sad-leakey-1993ae`), que lo dice en su propio cuerpo: "Queda el
audio: 78 de 159 fragmentos dicen el nombre viejo". Los nombres se cambiaron
porque la voz no sabia decirlos.

**Consecuencia: esos 78 bloques hay que volver a narrarlos.** `_realinea.ts` no
sirve aqui: realinea el audio que ya existe, y ese audio literalmente dice
"Itzel". Es el unico hueco de los tres que cuesta caracteres de narracion, y es
el que nadie estaba mirando: `publishJourney --dry` lo da por bueno porque
`audioUrl` existe en las 21.

Lo bueno: **las frases de practica ya estan con los nombres nuevos** (0 de los
357 ejercicios menciona Itzel o Citlali), asi que los 82 clips de frase ya
generados no se tiran.

## 3. mexico a0 Friends (`cmud5qhu00006j81cmkl4u5ks`)

### Huecos con numero exacto

| Hueco | Cuantos | Detalle |
|---|---|---|
| Clips de PALABRA (`wordClipUrl`) | **254** | 107 featured + 147 del pool; 251 palabras distintas |
| De esos, ya en R2 (recuperables gratis) | **6** | sonda HEAD contra la clave determinista (w5..w1) |
| Clips de palabra que hay que sintetizar | **248** | ~1.970 caracteres a una toma |
| Clips de FRASE (`clipUrl`) | **0** | 82 de 82 hechos |
| Portadas | **0** | 21 de 21 hechas |
| Bloques narrados con el nombre viejo | **78** en 20 historias | 10.543 caracteres |

### Comandos, en este orden

Los sets de este journey tienen JSON en `scripts/_sets/` en la rama
`claude/sad-leakey-1993ae` (21 archivos). Por eso el orden importa: **si en
algun momento hay que resembrar, se resiembra ANTES de generar clips**, nunca
despues.

**1. Recuperar los 6 punteros que ya estan pagados (cero creditos, sin gate):**

```
npx tsx scripts/_restoreWordClipUrls.ts cmud5qhu00006j81cmkl4u5ks --apply
```

**2. Reponer los 78 bloques narrados con el nombre viejo.** La herramienta
existe (`scripts/_reponeParrafo.ts`: resintetiza UN parrafo, lo empalma en el
master y realinea), pero esta cableada al journey `latam a2` y a
`scripts/_a2Voces`. Hace falta un hermano de una linea de diferencia,
`scripts/_reponeParrafoMxA0.ts`, con `JOURNEY = "cmud5qhu00006j81cmkl4u5ks"` y
la voz de este journey. Con el hermano puesto, el bucle es:

```
DPL_AUDIO_FULL_OK=1 NODE_OPTIONS="--conditions=react-server" \
  npx tsx scripts/_reponeParrafoMxA0.ts <slug> <indice-de-parrafo-1>
```

La lista exacta de `<slug> <indice>` la imprime `npm run lint:karaoke-fresh`,
que nombra el primer bloque discrepante de cada historia; para los 78 hay que
recorrer todos los bloques, no solo el primero.

**3. Los 248 clips de palabra** (el generador canonico ya trae el gate F0
anti-uptalk; no hay otro que lo lleve):

```
npx tsx scripts/publishJourney.ts cmud5qhu00006j81cmkl4u5ks --dry \
  | grep "audio de practica" | sed 's/^ *· //; s/:.*//' > /tmp/mx-a0-slugs.txt

while read -r slug; do
  DPL_AUDIO_FULL_OK=1 npx tsx scripts/_genWordClips.ts "$slug"
done < /tmp/mx-a0-slugs.txt
```

`publishJourney --dry` sale con codigo 1 cuando bloquea; dentro de una tuberia
no pasa nada, pero no lo metas bajo `set -e`.

**4. Publicar:**

```
npx tsx scripts/publishJourney.ts cmud5qhu00006j81cmkl4u5ks --dry
npx tsx scripts/publishJourney.ts cmud5qhu00006j81cmkl4u5ks --apply
npx tsx scripts/setJourneyStatus.ts --revalidate
```

### Coste

| Concepto | Clips / bloques | Caracteres a 1 toma |
|---|---|---|
| Clips de palabra por sintetizar | 248 | ~1.970 |
| Bloques de narracion por reponer | 78 | 10.543 |
| **Total a 1 toma** | | **~12.513** |
| Con re-tirada F0 sobre los clips (1,5x a 2x) | | **13.500 a 14.500** |
| Sobre los 209.745 que quedan | | **6,4% a 6,9%** |

### Que queda despues

Nada mas para publicar: con los clips y la narracion repuesta, el gate pasa
entero. Fuera del gate quedan dos cosas: la rama `claude/sad-leakey-1993ae`
(43 commits, con una **migracion de prisma** y cambios en `src/`) sigue sin
subir, y el journey no tiene `nextJourneyId` ni nadie que le apunte.

## 4. latam a0 Conversations (`cmub5my8d000432ye0v6pv5ng`)

### Huecos con numero exacto

| Hueco | Cuantos | Detalle |
|---|---|---|
| Clips de PALABRA (`wordClipUrl`) | **285** | 138 featured + 147 del pool; 285 palabras distintas |
| De esos, ya en R2 | **0** | ninguna de las 285 resuelve contra ninguna version de la clave |
| Clips de FRASE (`clipUrl` de `fill_blank`) | **51** | los 51 son featured, repartidos por las 21 historias |
| Portadas | **21** | ninguna historia tiene `coverUrl` |
| Narracion | 0 | 21 de 21 |

### Comandos, en este orden

Este journey es **DB-native**: no tiene ni un JSON en `scripts/_sets/`, ni en
main ni en su rama. **No se corre `_seedAllSets` aqui, ni antes ni despues**; no
hay nada que sembrar y un resembrado solo puede quitar. Por eso el generador de
frases tiene que ser el que lee y escribe la base (`_genFillBlankClips.ts`), no
el que pasa por el JSON (`_genPracticeClips.ts`).

**1. Las 51 frases** (gate F0 cerrado en este generador: si el gate no corre, la
toma no se sube):

```
npx tsx scripts/publishJourney.ts cmub5my8d000432ye0v6pv5ng --dry \
  | grep "audio de practica" | sed 's/^ *· //; s/:.*//' | sort -u > /tmp/latam-a0-slugs.txt

while read -r slug; do
  DPL_AUDIO_FULL_OK=1 npx tsx scripts/_genFillBlankClips.ts "$slug"
done < /tmp/latam-a0-slugs.txt
```

Para ver que frases son y cuanto miden, sin sintetizar nada y sin gate:
`npx tsx scripts/_genFillBlankClips.ts <slug> --dry`.

**2. Las 285 palabras, DESPUES de las frases y sin sembrar nada en medio:**

```
while read -r slug; do
  DPL_AUDIO_FULL_OK=1 npx tsx scripts/_genWordClips.ts "$slug"
done < /tmp/latam-a0-slugs.txt
```

**3. Las 21 portadas.** Los prompts ya estan cerrados y viven en
`scripts/_esLatamA0Conversations/portadas.json`, en la rama
`claude/es-latam-a0-conversations`: una hoja de reparto principal que vale para
las 21, una hoja extra solo para `la-manguera-gris`, el registro visual y un
prompt por historia con su lista de adjuntos. Generar las imagenes gasta
creditos de imagen y es un permiso aparte. Para subirlas, el patron del
proyecto es un script por journey que ademas calcula el thumbhash; aqui toca
copiar `scripts/_deA0CoversApply.ts` cambiando una linea
(`const JOURNEY = "cmub5my8d000432ye0v6pv5ng"`) y llamarlo con un mapa
slug -> jpg:

```
NODE_OPTIONS="--conditions=react-server -r dotenv/config" DOTENV_CONFIG_PATH=.env.local \
  npx tsx scripts/_esLatamA0CoversApply.ts /tmp/latam-a0-portadas.json --dry
```

(`scripts/_setCoverJpg.ts <storyId> <jpg>` tambien sube, pero NO escribe
`coverThumbhash`; no lo uses para un lote.)

**4. Publicar:** igual que arriba, `--dry`, `--apply`, `setJourneyStatus.ts --revalidate`.

### Coste

| Concepto | Clips | Caracteres a 1 toma |
|---|---|---|
| 285 palabras | 285 | 2.326 |
| 51 frases | 51 | 1.789 |
| **Total a 1 toma** | **336** | **4.115** |
| Con re-tirada F0 (1,5x a 2x) | | **6.200 a 8.200** |
| Sobre los 209.745 que quedan | | **3,0% a 3,9%** |
| 21 portadas | | creditos de imagen, no ElevenLabs |

### Que queda despues

Es el unico de los tres al que le falta trabajo en las dos monedas: audio e
imagen. Cerradas las dos, el gate pasa. Su rama
`claude/es-latam-a0-conversations` (17 commits) toca `src/lib/approvedVoices.ts`,
que lleva su propio guard: ese archivo no se edita sin la frase de aprobacion
del usuario.

## 5. germany a2 Friends (`cmubidgaf0007j8np6g7n89iu`)

### Huecos con numero exacto

| Hueco | Cuantos | Detalle |
|---|---|---|
| Clips de PALABRA | **1** | `zwei-strophen-im-stadion`, la palabra `der Text` |
| De esos, ya en R2 | **0** | la sonda falla en las cinco versiones de la clave |
| Clips de FRASE | **0** | 63 de 63 hechos |
| Portadas | **21** | ninguna historia tiene `coverUrl` |
| Narracion | 0 | 21 de 21, y los veredictos de oido estan cerrados |

335 de 336. Es, con diferencia, el mas cerca de publicar.

### Comandos

**1. El clip que falta** (9 caracteres):

```
DPL_AUDIO_FULL_OK=1 npx tsx scripts/_genWordClips.ts zwei-strophen-im-stadion --only="der Text"
```

Ojo: `der Text` lleva un espacio, asi que `_genWordClips` lo trata como
SINTAGMA y le pone el marco de frase, no el anuncio de palabra. Es lo correcto
y es lo que evita el uptalk.

Este journey SI tiene sus 21 JSON de set en rama (`claude/de-a2-portadas` y
`claude/goofy-easley-9152ae`). Si alguien resiembra despues de generar, hay que
hacerlo desde un checkout cuyo `_seedAllSets.ts` lleve el carry-forward de
`wordClipUrl` y `clipUrl` (main hoy lo lleva; las ramas viejas, no). La opcion
segura sigue siendo no resembrar.

**2. Las 21 portadas.** Los prompts estan cerrados en la rama
`claude/de-a2-portadas`: `scripts/_deA2portadas/portadas.json` (21 prompts + 7
hojas de reparto, una por tema) y `scripts/_deA2portadas/para-el-doc.txt`, que
es el mismo material en texto plano listo para pegar. Llevan ya las cuatro
cosas que el proyecto exige antes de la primera tirada: ficha literal por
personaje con color de ropa fijo, registro visual anclado, reparto completo y
prohibicion de texto. El orden que dice el propio archivo es: primero la hoja
del tema, despues las tres escenas de ese tema adjuntando esa hoja, tope de 2
tiradas por portada.

Subida, igual que el otro: copia de `_deA0CoversApply.ts` con
`const JOURNEY = "cmubidgaf0007j8np6g7n89iu"`.

**3. Publicar:** `--dry`, `--apply`, `setJourneyStatus.ts --revalidate`.

### Coste

| Concepto | Clips | Caracteres |
|---|---|---|
| 1 palabra | 1 | 9 a una toma, 14 a 18 con re-tirada |
| Sobre los 209.745 que quedan | | **0,01%** |
| 21 portadas | | creditos de imagen, no ElevenLabs |

### Que queda despues

Cerradas las portadas, publica. Pero el trabajo de este journey esta repartido
en varias ramas sin subir y **el bundle de glosas `german-friends-a2` no esta
en main**: es codigo (`vocab-layer-bundles.json` + la fila de FAMILIES en
`rebuildTapGlosses.ts`), asi que el journey puede publicarse y las glosas no se
veran hasta que se suba. `integracion-de-a2` ya reune las portadas, los sets y
las glosas; los 49 commits de `claude/goofy-easley-9152ae` (el audio) NO estan
dentro de esa rama.

## 6. Dos reglas que van pegadas a estos comandos

1. **El orden del audio de practica es frases, sembrar, y SOLO ENTONCES
   palabras, sin volver a sembrar.** `_genWordClips.ts` y
   `_genFillBlankClips.ts` escriben el puntero DIRECTAMENTE en la base;
   `scripts/_sets/*.json` nunca ha llevado `wordClipUrl`, asi que un
   `_seedAllSets --apply` con un script sin carry-forward borra lo que se acaba
   de pagar. Ya paso en DE A1 (253 filas), en IT A0 (281) y esta semana otras
   107. De los tres, latam a0 no tiene JSON (no hay nada que sembrar) y mexico
   a0 y germany a2 si lo tienen en rama.
2. **Todo script que sintetice TTS de practica lleva el gate F0 anti-uptalk.**
   Los tres generadores que aparecen aqui (`_genWordClips.ts`,
   `_genFillBlankClips.ts`, `_genPracticeClips.ts`) lo llevan, y el guard 6e
   bloquea cualquier `.ts` que toque `/v1/text-to-speech` sin referenciar
   `_f0gate`. No escribas uno nuevo.

Y los dos gates que no abre este informe: cada uno de esos comandos necesita el
**verbo de audio del usuario** en el chat que lo ejecute, y el opt-in
`DPL_AUDIO_FULL_OK=1` va en la misma linea porque el guard 6d mira el CONTENIDO
del `.ts` invocado, no su nombre.

verified:
- Los tres ids, contra `dp_journeys_v1`: `typeSlug`, `language`, `variant`,
  `levels`, `status` y numero de historias. Descartados los dos homonimos
  `spanish/latam a0`.
- Los bloqueos de los tres, con la regla literal del gate
  (`scripts/publishJourney.ts --dry`), contra la base de produccion.
- El conteo por tipo y por reparto pool / featured de cada hueco, con la misma
  consulta que se uso en la medicion de los cinco journeys LIVE del 2026-09-24.
- Existencia en R2 de cada clip de palabra que falta, con las cinco versiones
  de la clave determinista (w5..w1) via HEAD: 6 en mexico a0, 0 en latam a0,
  0 en germany a2.
- El desfase de karaoke de mexico a0: 20 de 21 historias,
  `npm run lint:karaoke-fresh`, y el diff palabra a palabra de los 78 bloques
  contra la copia guardada al alinear, cruzado con el commit `3b6bf4c2f`.
- Que ninguna de las 357 frases de practica de mexico a0 menciona los nombres
  viejos.
- Caracteres de cada hueco, contados sobre `word` y sobre
  `payload.audioClip.sentence` de las filas que fallan.
- Cuota de ElevenLabs (`scripts/_quota.ts`, GET): 390.255 / 600.000.
- Que los tres generadores citados referencian `_f0gate`, y que los tres caen
  bajo el candado 6d por CONTENIDO (leido en `.claude/safety/pre-bash-guard.sh`).
- Que latam a0 no tiene JSON de set en ninguna de las ramas, y que mexico a0 y
  germany a2 tienen 21 cada uno.
- Donde viven los prompts de portada de los dos journeys que las necesitan, y
  que son 21 + hojas de reparto en cada caso.
- Que el bundle de glosas `german-friends-a2` no esta en el checkout de main.

not verified:
- **La sonda R2 de las 51 frases de latam a0 no termino**: a 9 historias de 21
  llevaba 0 encontradas, y el informe asume 0 en las 21. Si alguna resolviera,
  el coste de ese journey baja un poco; no sube nunca.
- No se escucho ni un clip ni un fragmento de narracion. Que los 78 bloques
  digan el nombre viejo esta medido sobre el TEXTO guardado al alinear, no por
  oido.
- El numero de re-tiradas del gate F0 es una estimacion (1,5x a 2x), no una
  medida de estos lotes.
- No se conto cuantas tiradas de imagen costaran las 42 portadas: el tope del
  proyecto es 2 por portada, pero el gasto real depende de la revision.
- No se ejecuto ninguno de los comandos de generacion, asi que no estan
  probados end to end: estan compuestos leyendo el fuente de cada script y su
  cabecera de uso.
- No se reviso el contenido de las historias (gestalt, ritmo, repeticion entre
  historias) de ninguno de los tres: esto mide huecos de pipeline, no calidad.
- No se miro si a estos tres les falta algo de glosas mas alla del bundle
  aleman, ni si el lector web y el movil pintan igual lo que ya esta.

base: `publishJourney --dry` da por bueno el audio de mexico a0 porque
`audioUrl` existe en las 21 historias; `lint:karaoke-fresh` dice que 20 de esas
21 narraciones dicen un nombre que el texto ya no usa.

**Recomendacion: cerrar primero `germany a2`.** Le falta un clip de nueve
caracteres y las 21 portadas, no tiene sorpresas escondidas y es el unico de los
tres que puede estar publicado sin gastar audio de forma apreciable. `latam a0`
va segundo (4.115 caracteres y 21 portadas, todo previsible). `mexico a0` va
ultimo aunque parezca el mas avanzado: es el que arrastra la reposicion de 78
bloques de narracion, que es unos dos tercios del gasto de audio de los tres juntos y el
unico trabajo que todavia no tiene script.
