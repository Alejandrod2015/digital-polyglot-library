# Spec: pedirlo una vez (arreglar la causa, no los ejemplos)

Queja del usuario (2026-09-05, literal): "Estoy cansado de pedir a los chats
que se aseguren de revisar y respetar todas las reglas. Solo lo quiero pedir
una vez y que el chat siga todo y revise que ha seguido todas las reglas. O
muchas veces le pido la tabla del journey y me inventa cosas."

Causa raiz, del diagnostico del mismo dia: el cumplimiento depende de que el
chat RECUERDE las reglas (memoria probabilistica) y de que se AUTOCERTIFIQUE
("listo" es una frase, no un registro). Los ejemplos (historias, vocab, audio,
tablas) son instancias. La prueba de la tabla: hay 8 scripts de tabla de
journeys en scripts/ porque cada chat se fabrico el suyo.

Cuatro invariantes que lo invierten:

- I1. Toda regla dura es una fila de un inventario con su gate declarado
  (o "process"/"none" explicitos). Ya no hay reglas que viven solo en prosa.
- I2. Toda tarea de dominio entra por una puerta que CARGA las reglas desde el
  inventario; ningun flujo depende de que el chat las recuerde.
- I3. "Listo" es un registro verificable escrito por un script que corrio las
  comprobaciones, nunca una afirmacion del chat.
- I4. Todo entregable recurrente tiene UN generador canonico; una version
  compuesta a mano no es el entregable.

## Punto 1: inventario maestro y lint bidireccional (I1)

- `docs/rules-inventory.json`: la union de `docs/story-rules.json` (74 filas,
  se absorbe y queda como vista o se migra) mas las reglas de vocab, audio,
  covers, journeys, practica y comms que hoy viven en CLAUDE.md y en las
  memorias. Campos por fila: `id`, `domain` (story|vocab|audio|cover|journey|
  practice|comms|process), `rule` (una linea), `gate` (id de check, ruta de
  script, hook `.sh`, `"process"` o `"none"`), `source`.
- Semilla mecanica: las 174 memorias duras ya llevan linea `**Enforcement`
  (saldada el 2026-09-05); parsearlas para generar las filas iniciales, mas
  las secciones BLOQUEANTES de CLAUDE.md.
- `scripts/checkRulesInventory.ts` (`lint:rules-inventory`, enganchado al
  manifiesto del pre-push, que el trinquete de enrolamiento ya obliga):
  1. Todo `gate` citado existe en el arbol (reusar la logica de fantasmas de
     `checkHardRules.ts`, con el mismo lookbehind).
  2. Todo check id implementado en `validateGeneratedStory.ts` y
     `validateJourneyStories.ts` tiene fila (direccion inversa: no hay checks
     huerfanos sin regla documentada).
  3. Trinquete de `"none"`: el numero de filas sin gate solo puede bajar
     (linea base como la de hard-rules; `--apretar`).

## Punto 2: puertas que cargan reglas (I2)

- `scripts/rulesFor.ts <dominio>`: imprime compactas las reglas del dominio
  desde el inventario. Es la fuente que usan las skills; el chat no recita de
  memoria.
- Skills nuevas en `.claude/skills/` (patron de `grill`):
  - `/tema`: crear o cerrar un tema. Empieza ejecutando `rulesFor story` y
    `rulesFor vocab`; genera via el flujo existente (`generate-story` +
    `saveStory --dry`); al cerrar llama `cierraTema.ts` (punto 3). Nunca
    reporta "listo" sin el registro.
  - `/tabla`: ejecuta `scripts/journeysTable.ts` (o el de un journey concreto)
    y pega SU salida tal cual. Si falta una columna pedida, se amplia el
    script en un commit; prohibido componer la tabla a mano.
  - `/audio-tema`: envoltorio fino sobre el orden de narracion ya gateado
    (`_narraUnaA2.ts`, muestra registrada, gates 4 y 6d).
- CLAUDE.md gana una seccion corta "Pedir una vez" que remite a las tres
  skills y declara: una tabla de journeys compuesta a mano esta prohibida.

## Punto 3: listo = registro (I3; punto 5 del diseño original)

- `scripts/cierraTema.ts <journeyId> <topic>`: corre TODAS las comprobaciones
  aplicables al tema (validador canonico en dry sobre las 3 historias,
  acotacion, emojis, guiones, escalera de vocab si aplica) y, solo si todo
  pasa, escribe en `scripts/tema-cierres.json` una entrada con hash del
  contenido de las 3 historias.
- `saveStory.ts` se niega a guardar historias del tema N+1 de un journey si el
  tema N no tiene cierre registrado vigente (el hash caduca si el texto del
  tema cambio). Mismo patron que la muestra de narracion: sin variable de
  escape, el error escupe el comando que falta.

## Punto 4: gate de conjunto desde la historia 1 (punto 4 del diseño original)

- `validateJourneyStories.ts` deja de saltarse todo bajo 7 historias: los
  checks prefix-safe (solape de vocab entre las historias existentes,
  plantillas de titulo y arranque, no-acentos, suelo A0) corren con las que
  haya; los que exigen el conjunto completo (fijo en 6 de 7, distribucion)
  quedan listados como "pendientes de conjunto" en la salida de
  `cierraTema.ts`, no en silencio.

## Punto 5: entregable canonico de tablas (I4, el ejemplo que dolia)

- `scripts/journeysTable.ts` es LA tabla de journeys; borrar las 7 variantes
  scratch (`_journeyTable.ts`, `_journeysTable.ts`, `_journeysTable2.ts`,
  `_journeysTable3.ts`, `_tablasJourney.ts`, `_a2Tablas.ts`,
  `_ptJourneyTable.ts`). Si alguna tiene una columna que la canonica no tiene,
  la columna se migra a la canonica antes de borrar.
- La canonica respeta la regla de clasificacion (live+draft, archived solo si
  se pide explicito) y lo dice en su cabecera.
- Fila de inventario: dominio journey, gate "process + skill /tabla".

## Orden de ejecucion (commits, sin push)

1. Punto 1: inventario + lint + enganche al manifiesto.
2. Punto 2: rulesFor + las tres skills + seccion de CLAUDE.md.
3. Punto 3: cierraTema + candado en saveStory.
4. Punto 4: conjunto desde la historia 1.
5. Punto 5: tabla canonica + limpieza de variantes.

Verificacion sin base de datos (este worktree no tiene cliente Prisma): los
lints y el parseo se prueban directo; cierraTema y el candado de saveStory se
prueban con fixtures en dry; lo que exija DB queda anotado como "no
verificado aqui" en el informe, nunca saltado en silencio.
