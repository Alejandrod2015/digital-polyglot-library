# Traspaso: PRACTICE_Distractores_sinonimos_1-Barrido (2026-09-20)

Encargo del chat de planificacion (Journey-planning-2), cerrado y aceptado con
el commit `215a3c97`. Rama `claude/admiring-allen-c5f4f0`, sobre `335707e4`
de `claude/beta-test-nivel-1-puntuacion` (ahi vive
`src/lib/persistedPracticeExercises.ts`, que main aun no tiene). Sin push.

## Por que

La prueba de nivel nueva sirve los ejercicios curados de practica
(`StoryPracticeSet` / `StoryPracticeExercise`) de las historias live de
espanol. En el Pixel, el `meaning_in_context` de "opinar"
(`un-tinto-que-nadie-pidio`) parecia sin sentido a un nativo. El encargo lo
leyo como un distractor sinonimo; en la base, "what do you think" era la
RESPUESTA. El defecto real: las opciones traducian la frase "¿qué opina?" y
no el verbo, y el movil pinta la palabra sin la frase
(`mapSharedExerciseToMobile`, `sentence: null`). Se arreglo cambiando
`answer` y `options` a glosas del verbo.

## El script: `scripts/checkDistractorSynonyms.ts`

    npx tsx scripts/checkDistractorSynonyms.ts                     espanol
    npx tsx scripts/checkDistractorSynonyms.ts --language german
    npx tsx scripts/checkDistractorSynonyms.ts --story <slug>

Recorre los `meaning_in_context` y `listen_choose` de las historias
PUBLICADAS de journeys ACTIVOS del idioma. Solo lee; imprime tabla Markdown
(journey, historia, palabra, respuesta, distractor, motivo) y sale con 1 si
hay filas. Es un detector, no un juez: cada fila dice "sospechoso".

Normalizacion: minusculas, sin acentos ni puntuacion, sin stopwords inglesas
(las direccionales `in/out/up/down/off/back/over/again/away` NO son
stopwords: en un phrasal verb son el significado), stem ligero
(`ies/ing/ed/es/s`).

| criterio | que mira | ejemplo que marca | ejemplo que NO marca |
| --- | --- | --- | --- |
| 1 clave compartida | las claves del distractor y de la respuesta se contienen, o Jaccard >= 0,5 | "the counter" / "the serving counter" | "without hurry" / "without paying" (par paralelo) |
| 2 glosa de la misma palabra | el distractor coincide con la CABEZA de la definicion que `JourneyStory.vocab` da a esa palabra en esta historia, o con la glosa de la misma palabra en otra historia del idioma (vocab o respuesta de otro meaning) | contar: "to tell" / "to count" | "small" / "big" (la definicion "Small; not big" define por contraste) |
| 3 traduce la misma palabra (listen_choose) | misma palabra con otra forma (plural, acento), o glosas cuyas cabezas dicen lo mismo | lentamente / despacio | asiento / asombro |

La cabeza de una glosa es lo que va antes de `; , : (` y antes de una
negacion o relativa (`not, no, never, without, rather than, that, which,
who, where, when, because, here`). Coincidir = la cabeza cabe en el
distractor, o el distractor cabe en la cabeza e incluye su primera palabra
de contenido.

Primera version sin estas dos podas: 440 filas, casi todas ruido
("without X" contra "without Y", antonimos dentro de la definicion). Con
ellas, 69.

## Las 7 filas cambiadas (`scripts/_fixDistractoresSinonimos.ts`)

Solo `payload.options`; en "opinar" tambien `payload.answer`. Cada sustituto
es la glosa de OTRA palabra de la MISMA historia y del MISMO tipo
gramatical, nunca un sinonimo. El script corre con `--dry` y se niega a
escribir si las opciones actuales no son las esperadas (ya no lo son: esta
aplicado).

| historia | palabra | antes | despues |
| --- | --- | --- | --- |
| muy-interesante | contar | to tell / to count / to ask / to hide | to tell / to send / to ask / to hide |
| muy-interesante | llevar | to have been for / to bring along / to take away / to carry out | to have been for / to remember / to send / to write |
| lo-que-si-se-acepta | echar | to pour / to throw away / to weigh / to taste | to pour / to lend / to weigh / to taste |
| carla-paga-sin-probar-la-horchata | caliente | served him / warm / hot to the touch, not cold at all / to put up with (Argentine slang) | served him / soft / hot to the touch, not cold at all / to put up with (Argentine slang) |
| nerja-huele-a-pan | mañana | tomorrow / tonight / last week / this morning | tomorrow / tonight / last week / a greeting |
| pase-manana | caja | the till / the box of tools / the door / the book | the till / the prize / the door / the book |
| un-tinto-que-nadie-pidio | opinar | what do you think / what do you sell / what do you pay / what do you hear | to give an opinion / to sell / to pay / to hear (answer: to give an opinion) |

## Las 62 que quedan y por que no se tocan

Decision del chat de planificacion: no se tocan. Tres grupos:

- **Pares paralelos (criterio 1, 47 filas).** Misma estructura y significado
  opuesto o distinto: this time / last time, for once / at once, five to /
  five past, to turn on / to turn off, it's on the house / the house is full.
  Es buen diseno de distractor, no sinonimia; el criterio 1 los marca porque
  comparten la mitad de las claves.
- **listen_choose (criterio 3, 4 filas).** acera/carretera, cola/fila,
  deber/regresar, lentamente/despacio. Se oye la palabra: un sinonimo no da
  dos respuestas defendibles.
- **Sentido figurado vs literal, o glosa vecina (criterio 2, 11 filas).**
  "qué más" (how are you / what else is there) y "venirse abajo" (to erupt in
  a frenzy / to collapse in ruins) son C1 y distinguir el figurado ES el
  ejercicio. Las demas (vender / to give, voz / a sound, hija / my daughter,
  vida / all year, cajón, mirar largo, deber una, otra vez) coinciden con la
  cabeza de una definicion larga sin ser la misma cosa.

Tabla completa: correr el script; hoy da exactamente esas 62.

## Nota: el set viejo del autobuilder

`carla-paga-sin-probar-la-horchata` (y `rosa-afila-una-varilla-de-copal`,
`baja-con-el-canasto-lleno`, `rocio-rompe-su-papel`, ids `cmt7...`) tienen
opciones que no son glosas de la historia: "served him", "to put up with
(Argentine slang)", "overgrown", "I reckon, I like the idea (Mexican
slang)". Son sets del autobuilder anterior, no curados. Aqui solo se cambio
el distractor sinonimo de "caliente"; el set entero necesita rehacerse, y es
otro encargo.

## Repetirlo para otro idioma

1. `npx tsx scripts/checkDistractorSynonyms.ts --language <idioma>` (el
   valor es el de `Journey.language`, en minusculas: `german`, `italian`,
   `portuguese`, `french`).
2. Leer la tabla con la frase de cada candidata (la tabla no la trae; el
   `sentence` esta en la fila de `StoryPracticeExercise`). Descartar los
   pares paralelos y todo `listen_choose`. Quedarse con los casos en que el
   distractor es otro sentido real de la misma palabra o una parafrasis.
3. Pasar la lista al chat de planificacion y esperar la confirmacion.
4. Copiar `scripts/_fixDistractoresSinonimos.ts`, rellenar `FIXES` con id,
   `expect` (opciones actuales, literales) y `options` nuevas: la glosa de
   otra palabra de la misma historia y del mismo tipo gramatical. `--dry`,
   luego sin flag.
5. Volver a correr el script y comprobar con `diff` que solo desaparecen las
   filas cambiadas. Correr `npx tsx scripts/checkLevelTestStations.ts` si el
   idioma tiene prueba de nivel (hoy solo espanol).
6. Commit con la tabla antes/despues en el cuerpo. Sin push salvo verbo del
   usuario.

Los stopwords y el stem son ingleses porque las glosas lo son en todos los
idiomas; el criterio 3 compara palabras del idioma solo por forma
(plural en `-s`/`-es`, acentos), asi que en aleman o italiano detectara
menos variantes de la misma palabra.

## Verificacion del cierre

verified: `checkDistractorSynonyms --language spanish` 69 -> 62, el diff
quita exactamente las 7 y no anade ninguna; `checkLevelTestStations` ok
(latam A1-C1, spain A1-B2, dos historias por peldano); `lint:no-emdash`
limpio.
not verified: las opciones nuevas abiertas en el movil o en la web; la
lectura de las 62 restantes se hizo sobre frase y opciones, no sobre las
historias enteras.
