# Brief de producción: Traveler spanish/latam A2

- **Journey**: `cmtgelq560007j84n3ujx9bpd`
- **Tipo**: Traveler · **idioma**: spanish · **variante**: latam · **nivel**: a2
- **Estado**: draft · **Estructura**: 1 nivel x 7 temas x 3 historias = 21
- **Predecesores del mismo tipo e idioma**: A0 `cmqrtaj1p000032qtda86z6um` (live), A1 `cmt5vxwgd0007324oesy195k8` (live)
- **Público**: anglosajón; definiciones y etiquetas en inglés.

## 1. La espina del journey

Una sola persona recorre las 21: **Marisol Cortés**, fotógrafa de Lima. La espina
es un **cuaderno de rutas** que **Leandro** escribió hace once años; un plan de
viaje que los dos iban a hacer juntos y que él nunca hizo. Marisol lo recibe en
Rosario en la primera historia y recorre ese plan página a página, fotografiando
lo que Leandro solo dejó escrito. La pregunta que arrastra las 21: **¿por qué
Leandro nunca hizo su propio viaje?**

Reglas de uso de la espina:

- El cuaderno **nunca es el tema** de la historia. Aparece una o dos veces por
  historia y dice cuál es la parada siguiente.
- El lector puede leer los temas en cualquier orden sin perderse: la página que
  toca se cuenta entera dentro de su tema, nunca como requisito del anterior.
- **Leandro habla solo en el tema 1.** En los otros seis está por mención, y tiene
  que aparecer nombrado en **11 de las 21 como mínimo**: su letra en una página,
  un mensaje que Marisol contesta o deja sin contestar, una foto que le manda.
- Sirve además al vocabulario: da props compartidos entre temas (cuaderno,
  página, apunte, letra, margen, foto) que sostienen los encuentros 3 y 4 de la
  escalera. Sin un objeto común las siete escenas quedan ajenas y la
  recirculación es imposible por construcción.

**Ruta lineal.** El orden de los temas es el orden del viaje, y es el que tiene
que quedar en el array del journey:

| # | Tema | Parada | País |
|---|---|---|---|
| 1 | Friends & Reunions | Rosario | Argentina |
| 2 | Staying With Locals | Salento | Colombia |
| 3 | Jokes & Misunderstandings | Medellín | Colombia |
| 4 | Borders & Crossings | cruce Leticia / Santa Rosa | Perú |
| 5 | Secrets & Curiosity | Arequipa | Perú |
| 6 | Work Trips & Meetings | Guadalajara | México |
| 7 | Local Life & Routines | Mérida | México |

## 2. Reparto

**Dos personajes fijos y seis interlocutores nuevos.** Tope duro del plan
maestro: nunca más de dos fijos, y como mucho **dos personajes con diálogo por
historia** (Marisol y uno más). Los ocho, entre 30 y 55 años. **Ningún niño y
ningún anciano tienen papel hablante en ninguna historia**, ni de fondo.

Marisol viaja fuera de su país en seis de los siete temas, así que cada
interlocutor es hispanohablante nativo del sitio donde se le oye. La ficha
literal (edad, pelo, color fijo de ropa) se repite igual en las tres historias de
su tema y también en el prompt de portada.

**Candado de voces por pais (2026-09-01).** Marisol es limeña y suena limeña en
los siete paises; ningun personaje imita el acento del sitio donde esta. Cada
interlocutor se dobla SIEMPRE con voz aprobada de SU pais: Leandro argentino,
Yolanda y Fabian colombianos, Karina y Zoila peruanas, Araceli y Salvador
mexicanos. Marisol no vosea nunca, ni cuando le hablan de vos.

Esto es lo que resuelve la regla dura de `project_journey_structure_plan`: todos
los personajes son nativos de la VARIANTE (latam), que es la unidad que fija la
regla, no de la ciudad. El patron ya esta publicado: el A0 latam recorre
Cartagena, Barranquilla, Cusco, Buenos Aires, Oaxaca y Ciudad de Mexico, y el A1
latam Cusco, Buenos Aires y Barranquilla.

### 2.1 Los dos fijos

| Papel | Personaje | Ficha literal | De dónde es | Presencia |
|---|---|---|---|---|
| protagonista | **Marisol Cortés**, fotógrafa | 41 años; pelo castaño oscuro, hasta los hombros, con flequillo; chaqueta verde oliva | Lima, Perú | las 21 historias |
| el amigo de hace años | **Leandro** | 43 años; pelo negro, corto, sin flequillo; camisa azul marino | Rosario, Argentina | habla solo en el tema 1; nombrado en 11 de 21 como mínimo |

### 2.2 Un personaje nuevo por tema

Uno por tema, presentado en la **primera historia de su tema** y presente en las
tres. El tema 1 no estrena a nadie: su interlocutor es Leandro, que ya es fijo,
así que **la primera historia del journey lleva solo a Marisol y a Leandro**.

| # | Tema | Papel | Personaje | Ficha literal | País |
|---|---|---|---|---|---|
| 1 | Friends & Reunions | el amigo de hace años | **Leandro** (fijo, no cuenta como nuevo) | ver 2.1 | Argentina (Rosario) |
| 2 | Staying With Locals | la madre de la casa | **Yolanda** | 49 años; pelo negro, largo y recogido, sin flequillo; delantal amarillo | Colombia (Salento) |
| 3 | Jokes & Misunderstandings | el amigo bromista | **Fabián** | 39 años; pelo negro rizado, corto, sin flequillo; camiseta naranja | Colombia (Medellín) |
| 4 | Borders & Crossings | la oficial de frontera | **Karina** | 38 años; pelo negro liso, largo y recogido, sin flequillo; uniforme azul | Perú (Santa Rosa) |
| 5 | Secrets & Curiosity | la dueña de la pensión | **Zoila** | 54 años; pelo negro con canas, recogido, sin flequillo; chompa verde | Perú (Arequipa) |
| 6 | Work Trips & Meetings | la colega local | **Araceli** | 42 años; pelo negro, largo, sin flequillo; blusa blanca | México (Guadalajara) |
| 7 | Local Life & Routines | el vecino del mercado | **Salvador** | 50 años; pelo negro entrecano, corto, sin flequillo; guayabera blanca | México (Mérida) |

### 2.3 Por qué estos ocho nombres

- **Ninguno coincide con una persona real de `BetaSignup`.** Comprobados los 48
  nombres de pila de la tabla (`firstName`) contra los ocho: cero coincidencias.
  Los que había que esquivar y se esquivaron: Ángela, Alexia, Noelia, David,
  Martín, Rita, Marie.
- **Ninguno se repite con el A0 ni el A1 latam**, que ya gastaron Mateo, Jorge,
  Pablo, Lucía, Julio, Ana, Camilo, Elena, Marta, Carla, Rosa, Lucas, Sofía,
  Alveiro, Nadia, Nidia, Nahuel, Yaneth, Ofelia y Mireya.
- **Ninguno está en el banco `spanish/latam`** de `src/lib/characterNames.ts`, y
  eso es a propósito: el banco `young` cubre 20-40 (Valentina, Camila, Sofía,
  Matías, Santiago, Benjamín) y este reparto va de 38 a 54. Los nombres se
  eligieron por frecuencia en esa franja y en el país concreto, no en "latam" a
  secas. El check `character-names-unverified` va a AVISAR por los ocho; el aviso
  es esperado y esta sección es su justificación por escrito.
- **Hueco conocido**: no existen bancos `spanish/colombia`, `spanish/mexico`,
  `spanish/argentina` ni `spanish/peru` en `characterNames.ts`, así que el aviso
  de generación no funciona para este reparto. Nadie lo comprueba salvo esta
  tabla.
- **Seis nombres quedan liberados** al pasar de siete protagonistas a uno:
  Ernesto, Cecilia, Gerardo, Silvina, Liliana y Percy ya no se usan en este
  journey y vuelven a estar disponibles para otro.
- Ortografía: solo alfabeto español. Sin apellidos exóticos ni diminutivos.

## 3. Reglas de escritura que aplican a las 21

Van aquí porque se cumplen al PLANIFICAR, no al validar.

1. **Presentación en tres frases de narración** antes de la primera línea citada,
   y con un sintagma que diga QUÉ ES la persona ("una fotógrafa de Lima"), no qué
   hace ni una ironía sobre su oficio. **Prohibido el gentilicio** en esa frase
   (nada de limeña, tapatío, rosarina). Se alternan las tres formas aprobadas
   (aposición, descriptor tras el lugar, con ser en frase propia); usar siempre la
   misma en 21 historias es una fórmula y se nota.
2. **Comillas curvas “”**. Las angulares «», las rectas "" y las bajas „" están
   prohibidas.
3. **Habla citada: 30% de las palabras del cuerpo, banda 25-35%.** Una réplica por
   párrafo, ninguna historia muda, y el diálogo no siempre al final. Se mide con
   `scripts/_quotedRatio.ts`.
4. **El narrador dice quién habla antes de cada cambio de voz**: acotación en el
   mismo párrafo o una línea de narración justo antes. El listón del catálogo es
   97-100% de párrafos citados con narrador al lado. Cero tiradas de tres o más
   réplicas sin acotar. Se mide con `scripts/_acotacion.ts` y `_quienHabla.ts`.
5. **Regla i+2 sobre TODO el cuerpo**, no solo sobre `vocab[]`: para target A2 se
   permite A1-B2 y se prohíbe C1 y C2.
6. **Sin slang a nivel A.** Sí el registro gramatical del país (voseo argentino,
   ustedeo colombiano) y sí el regionalismo funcional que el viajero necesita
   nombrar. No: parce, chido, órale, gacho, po, che como muletilla. Tampoco
   superlativos en -ísimo; se usa la forma base o "muy" más el adjetivo.
7. **Ninguna persona real de `BetaSignup`** entra como personaje, ni su nombre, ni
   su biografía, ni un detalle que permita reconocerla. Las motivaciones se leen
   para decidir qué construir y ahí se quedan.
8. **Cada historia necesita algo en juego**: se puede decir en una frase qué
   quiere el protagonista, el obstáculo dura más de dos réplicas, algo cuesta
   (dinero, orgullo, una comida, una relación) y el final cambia algo. Queda
   prohibido el motor "choca con una costumbre, un local se la explica, la
   acepta", que es lo que se coló 11 veces de 21 en el Expat FR A0.
9. Al medir un tic, medir también el que lo sustituye: si se prohíbe abrir con
   día u hora, vigilar que no abran todas con el nombre del protagonista más verbo.
10. Sin guion largo ni en dash en ningún campo. Sin emojis.
11. **TEXTO y PLAZA no son lo mismo.** La exclusión de la sección 5 prohíbe que
    una palabra ocupe una PLAZA de vocab; no prohíbe usarla en el texto. La
    espina se llama **el cuaderno** en el texto de las 21 y **nunca gasta una
    plaza**, igual que los encuentros 2, 3 y 4 de la escalera van en el texto y
    no en un slot. Cuando el objeto que la escena necesita esté gastado, se
    escribe igual y la plaza se gasta en otra palabra del campo que sí esté
    libre. (Regla puesta el 2026-08-31 al escribir H1: la plaza "libreta de
    notas" reenseñaba la "libreta" del A1 latam y se cambió por "película", del
    campo fotográfico; el objeto siguió llamándose cuaderno en el texto.)
12. **Nada de compás fijo (anti-metrónomo, 2026-08-31; enmendada el mismo día).**
    Las 21 no pueden entrar y salir todas igual. **Oraciones: 12-16, variando
    entre historias.** Además, **al menos una historia de cada tema abre en otra
    cámara** (un sonido, un objeto, o una réplica si el reparto ya quedó
    presentado antes) y **al menos una cierra en réplica**, no en narración
    sobre la protagonista.
    **Los bloques quedan FUERA de la regla: a banda de un minuto son 5 y punto.**
    La primera versión pedía 5-7 variando, y con 125-145 palabras eso es
    imposible: seis bloques exigen 16 oraciones o más, o sea menos de nueve
    palabras por oración, que ya es prosa entrecortada. Y pesa poco: el lector
    tira los párrafos de la prosa narrada y reagrupa de tres en tres
    (`readerParagraphs`), así que el bloque autoral casi no se ve.
    (Puesta tras leer las tres del tema 1 seguidas: las tres tenían exactamente
    18 oraciones y 6 bloques, todas abrían con Marisol o con el sitio y todas
    cerraban en tercera persona sobre ella. Ninguna estaba mal sola.)

## 4. Escalera de vocab

### 4.1 Forma

- **20 plazas por historia**, 420 en el journey.
- **Historias 1-15: 14 portables + 6 ancladas.** El 6 es el tope duro del gate
  `journey-vocab-recirculation`, no una preferencia.
- **Historias 16-21: 20 ancladas.** Toda palabra portable tiene que entrar como
  muy tarde en la 15 para que le quepan sus encuentros 3 y 4.
- Cuatro encuentros por palabra portable y no más: (1) la enseña con glosa, (2)
  otra escena o inflexión en la misma historia, (3) dos o tres historias después,
  (4) seis o siete historias después.
- **Los encuentros 2, 3 y 4 van en el TEXTO y no gastan plaza.** Re-enseñar la
  palabra en otro slot desperdicia la promesa "llévate esta palabra".
- El encuentro 2 vale menos que los otros: pasa en la misma sesión, con la glosa a
  la vista. El marcador del journey cuenta reencuentros en OTRA historia y reporta
  el intra-historia aparte.

Reparto de las 14 portables de cada historia en dos grupos de 7, para que ninguna
historia receptora tenga que alojar 14 palabras de una sola fuente:

- **grupo A** (7 palabras): encuentro 3 en `n+2`, encuentro 4 en `n+6`.
- **grupo B** (7 palabras): encuentro 3 en `n+3`, encuentro 4 en `n+7`.

### 4.2 Tabla: quién aloja qué

| H | Tema | Plazas | Port. | Anc. | Manda e3 a | Manda e4 a | Aloja e3 de | Aloja e4 de | Total alojado |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 Friends & Reunions | 20 | 14 | 6 | H3 (A), H4 (B) | H7 (A), H8 (B) | - | - | 0 |
| 2 | 1 Friends & Reunions | 20 | 14 | 6 | H4 (A), H5 (B) | H8 (A), H9 (B) | - | - | 0 |
| 3 | 1 Friends & Reunions | 20 | 14 | 6 | H5 (A), H6 (B) | H9 (A), H10 (B) | H1 | - | 7 |
| 4 | 2 Staying With Locals | 20 | 14 | 6 | H6 (A), H7 (B) | H10 (A), H11 (B) | H1, H2 | - | 14 |
| 5 | 2 Staying With Locals | 20 | 14 | 6 | H7 (A), H8 (B) | H11 (A), H12 (B) | H2, H3 | - | 14 |
| 6 | 2 Staying With Locals | 20 | 14 | 6 | H8 (A), H9 (B) | H12 (A), H13 (B) | H3, H4 | - | 14 |
| 7 | 3 Jokes & Misunderst. | 20 | 14 | 6 | H9 (A), H10 (B) | H13 (A), H14 (B) | H4, H5 | H1 | 21 |
| 8 | 3 Jokes & Misunderst. | 20 | 14 | 6 | H10 (A), H11 (B) | H14 (A), H15 (B) | H5, H6 | H1, H2 | 28 |
| 9 | 3 Jokes & Misunderst. | 20 | 14 | 6 | H11 (A), H12 (B) | H15 (A), H16 (B) | H6, H7 | H2, H3 | 28 |
| 10 | 4 Borders & Crossings | 20 | 14 | 6 | H12 (A), H13 (B) | H16 (A), H17 (B) | H7, H8 | H3, H4 | 28 |
| 11 | 4 Borders & Crossings | 20 | 14 | 6 | H13 (A), H14 (B) | H17 (A), H18 (B) | H8, H9 | H4, H5 | 28 |
| 12 | 4 Borders & Crossings | 20 | 14 | 6 | H14 (A), H15 (B) | H18 (A), H19 (B) | H9, H10 | H5, H6 | 28 |
| 13 | 5 Secrets & Curiosity | 20 | 14 | 6 | H15 (A), H16 (B) | H19 (A), H20 (B) | H10, H11 | H6, H7 | 28 |
| 14 | 5 Secrets & Curiosity | 20 | 14 | 6 | H16 (A), H17 (B) | H20 (A), H21 (B) | H11, H12 | H7, H8 | 28 |
| 15 | 5 Secrets & Curiosity | 20 | 14 | 6 | H17 (A), H18 (B) | H21 (A y B) | H12, H13 | H8, H9 | 28 |
| 16 | 6 Work Trips & Meetings | 20 | 0 | 20 | - | - | H13, H14 | H9, H10 | 28 |
| 17 | 6 Work Trips & Meetings | 20 | 0 | 20 | - | - | H14, H15 | H10, H11 | 28 |
| 18 | 6 Work Trips & Meetings | 20 | 0 | 20 | - | - | H15 | H11, H12 | 21 |
| 19 | 7 Local Life & Routines | 20 | 0 | 20 | - | - | - | H12, H13 | 14 |
| 20 | 7 Local Life & Routines | 20 | 0 | 20 | - | - | - | H13, H14 | 14 |
| 21 | 7 Local Life & Routines | 20 | 0 | 20 | - | - | - | H14, H15 | 21 |
| **total** | | **420** | **210** | **210** | | | | | **420** |

Lectura de la tabla: en régimen (historias 8 a 17) cada cuerpo aloja **28
apariciones** de palabras que enseñan otras historias. **El cuerpo A2 mide
125-145 palabras**; sobre esa extensión las 28 apariciones son el **21%**, por
encima del 16% de la forma canónica. Las tres primeras no alojan nada porque no
hay historia anterior que devolver.

**POR QUÉ 125-145 (fijado el 2026-08-31 por el usuario).** La duración manda:
una historia dura **~60 segundos**. La medida no es una estimación, son las **13
duraciones reales del A0 de España**, que dan **134 palabras por minuto** (rango
131-136). A 134 ppm, 135 palabras son el minuto justo, y la banda se abre diez
palabras a cada lado. Un cuerpo de 250 dura casi dos minutos y uno de 185 dura
85 segundos: los dos incumplen la promesa del producto.

Para que esa banda se pueda guardar, `isOneMinuteTier` se extendió al A2 en
`src/lib/validateGeneratedStory.ts` el 2026-08-31, así que el gate pasa de
180-320 a **100-190 duro y 115-170 bueno**, la misma ventana del A0 y del A1. No
es aflojar el gate: la tabla "Criterios por nivel" del spec ya decía **A2 =
128-155** desde el 2026-08-19, y el validador era lo único que no lo había
recogido.

**Cuenta que este cambio ROMPE y hay que mirar:** con 28 apariciones alojadas
sobre 134 palabras, el 21% del cuerpo de una historia en régimen son palabras
que enseñan otras. Es un tercio más de siembra que en la forma canónica, y en un
cuerpo corto se nota mucho más. Si al escribir el tema 3 la prosa empieza a
sonar a lista, la palanca es bajar de 14 portables por historia, no estirar el
cuerpo. **No está resuelto; queda anotado.**

Historial de esta línea, que se equivocó tres veces en el mismo día: "unas 155
palabras" (ventana de A0/A1, no se podía guardar en A2), luego 220-280 (mirando
la banda buena del gate en vez de la duración), luego 180-190 (mirando el
mínimo duro del gate, que da 85 segundos y no un minuto). **La duración manda y
el gate se ajusta a ella, no al revés.**

**Consecuencia de diseño que hay que aceptar antes de escribir:** las 28 palabras
que aloja una historia vienen de temas y países distintos. Solo funciona si son
portables de verdad (verbo, adjetivo, adverbio, expresión de uso diario). Un
sustantivo pegado a su escena no viaja entre temas y no sirve para esto.

**De dónde salen las portables (2026-08-31).** De los 976 lemas libres, **809 no
solapan con ningún journey** y de esos **solo 144 son verbo, adjetivo o
expresión**; el resto son sustantivos. Las plazas PORTABLES se sirven primero de
esos 144; los sustantivos van preferentemente a ANCLADAS. El hueco que quede lo
cubren únicamente sustantivos capaces de viajar entre temas. La lista completa,
con categoría, está en `/tmp/a2-lemas-libres.tsv`.

**Aviso aritmético y su resolución (2026-08-31).** 144 portables de verdad no
llegan para las 210 plazas portables que pide la tabla; faltan 66. **Decidido:
se reabren portables del nivel anterior, pero SOLO en una forma que el A0 y el
A1 no enseñaron: verbos en PASADO (pretérito o imperfecto) que allí se
enseñaron en presente.** Máximo **4 por historia**, y la glosa tiene que
justificar la forma nueva, no repetir la vieja. La forma 14+6 no se toca. El
pasado es la gramática que estrena este nivel (ver "Criterios por nivel"), así
que la reapertura enseña algo de verdad en vez de cobrar dos veces la misma
palabra.

### 4.2.1 Envíos reales del tema 1 (anotado el 2026-08-31)

Las 14 portables de cada historia, partidas en los dos grupos de la tabla. El
tema 2 tiene que ALOJAR estas palabras en su texto desde el primer borrador, sin
gastarles plaza.

| De | Grupo | Las 7 palabras | Encuentro 3 en | Encuentro 4 en |
|---|---|---|---|---|
| H1 | A | viajar, sentar, cenar, bosquejar, simple, doblada, tres horas | **H4 y H5** (ver abajo) | H7 |
| H1 | B | auto, interés, reflejo, cámara, arte, mesita, trabajo | H4 | H8 |
| H2 | A | escoger, cepillar, echar, manchar, orientar, conocido, perdido | H4 | H8 |
| H2 | B | cuadras, cuarenta años, llevamos así, casi termino, darse vuelta, imposible, callada | H5 | H9 |
| H3 | A | desdoblar, verter, depender, remendar, desprenderse, encontrado, retrasado | H5 | H9 |
| H3 | B | nublada, cerrada, rápida, mermelada, próxima semana, casi listo, escritas | H6 | H10 |

**Los seis encuentros del grupo A de H1 se mudan a H4 y H5 (2026-08-31).**
Estuvieron alojados en H3 mientras el cuerpo medía 216 palabras. Al bajar la
banda a 125-145, H3 no puede cargar sus 20 plazas, la frase candado y seis
palabras ajenas: son 27 obligaciones léxicas en 135 palabras, una cada cinco
palabras, y eso es una lista, no una historia. Reparto nuevo:

| Palabra | Encuentro 3 en |
|---|---|
| viajar, sentar, cenar | **H4** |
| bosquejar, simple, tres horas | **H5** |

`doblada` ya se reencontró en H3 y se queda como está. El encuentro 4 de las
siete sigue en H7, sin cambios. **H3 queda con sus 20 plazas y la semilla
candado, y nada más.**

### 4.2.2 La escalera se recalibra a 7 ajenas por receptora (2026-09-01)

**El problema.** La tabla 4.2 reparte 14 portables por historia en dos grupos de
7, asi que cada receptora aloja 14 palabras ajenas. Con las tres mudadas de H1,
H4 y H5 tenian que alojar 17. Sumadas a sus 20 plazas propias son **37
obligaciones lexicas en 125-145 palabras**, una cada 3,6. El propio brief ya
habia declarado imposible 27 en 135 palabras ("una cada cinco palabras, y eso es
una lista, no una historia") y por eso saco seis de H3. 37 es mucho peor.

**Y la tabla se monto sobre un supuesto que ya no vale**: 14 portables por
historia. El tema 1 reescrito a un minuto tiene 17, 18 y 19. Los envios son mas
grandes de lo que la tabla cree.

**Lo que el gate pide de verdad.** `journey-vocab-recirculation` para A2 pide
media 1,3 y cola por debajo del 80%. Con 18 portables por historia y 21
historias son 378 portables:

| Objetivo | Reencuentros que hacen falta | Por historia |
|---|---|---|
| media 1,3 | 113 | 5,4 |
| media 1,4 (margen) | 151 | 7,2 |
| cola por debajo del 80% | 76 | 3,6 |

**Decision: 7 portables ajenas por historia receptora, no 17.** Cubre la media
con margen y deja la historia en 27 obligaciones, que es el orden de lo que ya
esta escrito y leido. Las 14 de la tabla no venian de ninguna regla: venian de
partir en dos un numero inventado.

**Metodo, que es lo que fallo antes:** los envios se anotan aqui ANTES de
escribir la receptora.

| Receptora | Aloja (7) | De |
|---|---|---|
| H4 | limpiar, dejar, aceptar, insistir, caliente, entender, despacio | H1, H2 |
| H5 | escuchar, quieto, apoyar, soltar, tardar, elegir, bajito | H1, H2 |
| H6 | abrir, guardar, pedir, reconocer, apurado, juntos, todavia | H3 |

**Lección de método:** los envíos hay que anotarlos ANTES de escribir la historia
receptora, no después de cerrar el tema. Dentro de un mismo tema la receptora
suele estar ya escrita cuando se hace la cuenta.

### 4.3 El conflicto aritmético, cuantificado

Con esta forma las ancladas suman **210 de 420 plazas, el 50%**. El gate
`journey-vocab-recirculation` rechaza que pasen del **30%** (126 plazas). El
journey va a suspender ese check por construcción, no por descuido: si las
portables solo entran hasta la 15, las 120 plazas de las seis últimas solo pueden
ser ancladas.

Es el mismo conflicto que la forma canónica documenta sin resolver. No se toca
ahora. **Se mide al cerrar la historia 15**, con `scripts/_ladderTable.ts` y
`scripts/_ladderCompare.ts`, y ahí se decide con datos. La única palanca conocida
que movió la cifra en un journey real (A0 argentino, 2026-08-23) es la
re-enseñanza acotada de portables en la cola: solo palabras que salen en tres
historias o más, a seis historias o más de distancia, máximo seis por historia.
Aplicarla contradice "de la 16 en adelante solo ancladas", así que es una decisión
del usuario, no del que escribe.

### 4.4 Aviso al clasificar portable frente a anclada

**Cómo elegir el `surface`, y hasta dónde (2026-08-31).** El marcador de
recirculación compara el `surface` EXACTO contra los tokens del cuerpo, así que
`sentarte` en una historia y `se sienta` en otra son dos palabras distintas para
él, y **toda expresión de varias palabras cuenta cero siempre**, porque el cuerpo
se parte en tokens sueltos. Regla: **lema desnudo como `surface` siempre que sea
subcadena literal del cuerpo** (`sentar` dentro de "dónde sentarte" vale y
`vocab-in-body` sigue verde).

**Límite duro de esa regla: nunca torcer la prosa para que puntúe el marcador.**
Si la elección correcta es una expresión de varias palabras, entra aunque cuente
cero. Ese déficit se anota como **límite de medición**, no como defecto de la
historia. De las 60 plazas del tema 1, 13 son expresiones y no van a puntuar
nunca; el journey no está peor por eso, el medidor sí ve menos.

El campo `type` es un proxy grueso. No dar por portable todo verbo y todo
adjetivo: `sellar`, `declarar`, `regatear`, `madrugar` existen solo dentro de su
escena y no reaparecen. En el A1 latam etiquetar a mano movió 40 palabras a
anclado y subió del 46% al 55% lo que de verdad reaparece, sin tocar prosa. La
clasificación se hace a mano, tema por tema, en el momento de elegir las 20.

### 4.2.3 Envíos del tema 3 (anotados el 2026-09-01, antes de escribir)

Siete portables ajenas por receptora, segun la recalibracion de 4.2.2. Van en el
TEXTO y no gastan plaza.

| Receptora | Aloja (7) | De |
|---|---|---|
| H7 | esperar, aguantar, callar, molestar, raro, seguro, amable | H4, H5 |
| H8 | repetir, sobrar, tranquilo, devolver, seco, justo, lento | H5, H6 |
| H9 | probar, prestar, aprender, listo, limpio, mostrar, pagar | H4, H6 |

Campo del tema comprobado libre entero contra el gate real: invitada,
celebracion, fiesta, musica, guitarra, companero, cafeteria, restaurante,
gaseosa, apariencia, mas cuento, foto y larga. Trece sustantivos para nueve
plazas ancladas, que es el primer tema con holgura.

`invitada` gasta una de las DOS reaperturas que el journey se permite en total
(la otra fue `camara` en el tema 1). No queda ninguna mas.

### 4.2.4 Envíos del tema 4 (anotados el 2026-09-01, antes de escribir)

La tabla por historias del tema 3 enseño el problema que hay que corregir aqui:
**H8 y H9 tienen 0 en "vuelven despues"**, o sea que todo lo que ensenan muere
ahi. Y las ancladas suben de 11 en H1 a 18 en H8, al reves de lo que pide el
diseno (70/30 a favor de portables).

| Receptora | Aloja (7) | De |
|---|---|---|
| H10 | preparar, tragar, tenso, callado, amargo, borrar, doler | H8 |
| H11 | empezar, arreglar, ocultar, faltar, anotar, decidir, pronto | H9 |
| H12 | firmar, reducir, apuntar, entregar, rechazar, apenas, alcanzar | H9 |

Los siete de H8 que quedan sin reencuentro aqui (casi, luego, dejarse, parar,
cambiar, esconder, proponer) van al tema 5, y se anotan alli antes de escribir.

Campo del tema comprobado libre entero: canoa, balsa, puerto, costa, isla,
ticket, panel, balde, mas corriente y espera. Diez sustantivos para nueve
plazas ancladas.

**Gastados y por tanto fuera**: rio, orilla, lancha, muelle, fila, sello. El
lexico del tramite lo agotaron el A0, el A1 y los journeys de Espana, que es lo
que ya decia la escena aprobada del 2026-08-31.

## 5. Exclusión de vocab: cero solape

Extraído de la base el 2026-08-31: **731 superficies distintas** entre el A0 y el
A1 latam (A0: 313, A1: 418).

### 5.1 Capa ANCLADA: prohibición absoluta (363 superficies)

Ninguna de estas puede ocupar una plaza del A2. Sin excepción de umbral; como
mucho dos por journey si el SIGNIFICADO cambia en la escena nueva, y se justifica
en su propia glosa.

abrigo, abuela, abuelo, acera, agua, alguien, almohada, alquiler, altavoz, andén, apellido, aplicación, arcoíris, asado, asiento, avenida, aviso, avión, ayuda, azulejo, azúcar, año, años, bajada, banca, banco, barniz, barrio, bienvenida, billetera, birome, boda, boleto, bolsita, bolso, bombilla, bondi, borde, bordillo, bote, botón, brazo, cadena, caja, cajón, calle, calles, cambio, camino, campera, canción, candado, canela, cantidad, canto, cara, cargador, cariño, carpeta, carta, casa, casas, casilla, celular, cerradura, cerrojo, chofer, churros, cielo, cifra, cinturón, ciudad, clase, clavo, clima, cola, colchón, colectivo, columna, comida, conexión, contacto, contraseña, corazón, correo, cortado, cortina, cosas, cuadra, cuarto, cubeta, cuchillo, cuidado, cumpleaños, curva, cédula, desagüe, descuento, desfile, destornillador, disfraces, disfraz, docena, domingo, dos, ducha, durante, día, dónde, electricidad, ella, empanadas, empleada, empresa, enchufe, ensayo, entradas, equipaje, escalones, escenario, escoba, escritorio, espuma, esquina, estacionamiento, este, esto, extraños, extremo, factura, farol, febrero, fecha, feria, figura, fila, flores, fondo, frase, frazada, fresas, frío, galleta, gasto, gente, gesto, globo, globos, goma, grifo, hacia, hermana, hermano, herramientas, hija, hijos, hoja, hombre, hora, horario, horas, horchata, hueco, idioma, inquilino, interruptor, izquierda, jarra, jefa, jitomate, labio, lago, lavabo, leche, letra, letrero, libreta, libro, limpieza, linterna, lista, llamada, llegada, lluvia, local, lomito, luces, lugar, luna, lunes, luz, lápiz, madera, madre, mamá, mancha, manga, manta, manteca, mariposas, martes, mañana, mejilla, mensaje, mentira, menú, mesa, mesero, metal, micrófono, miedo, mirada, mirador, mitad, miércoles, mochila, modo, monedero, montaña, montañas, morral, mujer, nada, nadie, nevera, nieve, noche, nota, noticia, nubes, número, oferta, oficina, orden, oscuridad, palabra, palabras, palma, pantalla, paquete, parada, partes, pasaje, pasaporte, pasillo, pata, patio, patrón, pausa, país, paño, pecho, pedido, pegamento, perdón, pero, personas, picada, piernas, pies, pileta, pincel, pintura, pizarra, plan, planilla, planta, plumas, pollo, polvo, portón, precio, primo, principio, pueblo, puerta, puesto, punta, pájaro, quién, raya, red, regalo, regla, reja, repisa, retraso, roca, ropero, ruido, ruta, río, sala, saludo, según, sello, semana, sencillo, servicio, señal, señora, sobre, sobrina, sonido, sonrisa, subida, submarino, suelo, sueño, sábado, sábana, taburete, tambores, tapa, tapia, taquilla, teclado, temor, terminal, termo, terraza, todo, todos, tono, tormenta, torta, total, trayecto, tren, trozo, turno, tía, tío, tú, uno, valija, vapor, varilla, vaso, vasos, vecino, vecinos, vela, ventana, ventanilla, ventilador, verano, verdad, verdura, vez, viaje, viajero, vidrio, viento, vista, voz, yo, zapatillas, zumbido, árboles

**Ojo con `pasaporte`, `cédula`, `equipaje`, `valija`, `sello`, `parada`,
`terminal`, `viajero` y `retraso`**: son justo las que un tema de fronteras y un
tema de viajes de trabajo pedirían primero, y están todas gastadas. El tema 4 y
el tema 5 tienen que buscar su léxico en el TRÁMITE y en el ACUERDO, no en el
objeto de viaje.

### 5.2 Capa PORTABLE: se reabre, con cuidado (368 superficies)

La capa portable se reabre entre niveles del mismo tipo, porque el A0 se llevó
casi todos los portables del idioma y sin ellos la escalera es aritméticamente
imposible. `saveStory.ts` pre-filtra los portables de la lista de "ya enseñadas"
antes de contar, en los dos cubos (`vocab-taught-same-type` y
`vocab-taught-elsewhere`).

Que se pueda no quiere decir que convenga: **reabrir una portable gasta una de
las 210 plazas portables del A2 en algo que el lector ya tiene en su repaso**.

**Regla cerrada el 2026-08-31, y es la única puerta de reapertura que queda
abierta:** se reabre **solo un verbo, y solo en pasado** (pretérito o
imperfecto) cuando el A0 o el A1 lo enseñaron en presente: `llegó` y `llegaba`
frente a `llega`. **Máximo 4 por historia.** La glosa define la forma nueva y
dice qué cambia respecto de la que el lector ya tiene. Ni sustantivos, ni
adjetivos, ni la misma forma con otro sentido: solo el tiempo verbal que este
nivel estrena.

Aparte de esto, el journey gasta **dos reaperturas de otro tipo de journey en
total**, `cámara` e `invitada` (ver 5.3), y ninguna más.

a mano, a tiempo, a veces, abanica, abierta, abre, ahora, ahorra, al fin, alcanza, alegre, algunas, algún, alrededor, alta, amable, amarillas, amplia, ancha, anda, ansioso, antigua, antiguo, apaga, apagado, apenas, apoya, aprende, aprender, aprueba, apurado, aquí, arregla, arriba, así, ata, aunque, avisá, azul, baila, bailan, bailar, bailo, bajo, barato, bastante, bien, blanca, blando, borra, busca, buscan, cabe, cada, cae, calienta, caliente, calla, cambia, camina, caminan, cansada, cansados, canta, carga, caro, casi, casi vacío, cerca, cerrada, cierra, cinta adhesiva, clara, compara, completa, complicado, común, conoce, conocer, contenta, contento, contentos, contesta, correcta, corto, cuenta, cuesta, cuida, cómodo, da las gracias, de más, de repuesto, debo, deja, delgada, demora, descansan, despacio, después, detrás, dice, diferente, difícil, disculpe, disponible, doblar, duelen, duerme, dulce, dura, duro, elige, empieza, empiezan, empuja, en punto, en rojo, en silencio, encendido, enciende, encuentra, enojado, enorme, enormes, entonces, entra, envuelve, escucha, escuchar, esperan, estira, estrechas, está, está todo mal, exactamente, exacto, extraña, extraño, falta gente, faltan, feliz, fina, firme, frena, frente, fresco, fuera, fuerte, fácil, gano, gira, gotea, gran, grande, grises, grita, gusta, habla, hablan, hay, hazme el favor, hermosa, hermoso, hoy, ida y vuelta, incluso, incorrecto, intenta, invitan, jamás, joven, junta, juntar, juntos, justo, la gente con plata, late, le gusta, lejos, lenta, lentamente, levantan, ligero, limpia, listos, llamar, llega, llegan, llena, llenas, lleno, lleva, llora, llover, malas noticias, marca, me equivoco, medio, mete, mientras, mira, miran, mirá vos, moja, mojado, mucha, muchas, mucho, muestra, mueve, muy, más, necesario, necesitas, nerviosa, niega, no te preocupes, nota de voz, nueva, nuevo, nunca, ofrece, olvida, orgullosa, otra vez, para, parece, parecido, pasa, pasan, paso a paso, pequeña, pequeño, perdida, pesa, pesada, pesado, picante, pide, piensa, pierde, pliega, poco, ponlo, por ciento, por eso, por noche, pregunta, prende, presta, primera, primero, profundo, propio, próximo, puede, quedamos, quiere, quiero, quieto, quizás, reconoce, recta, recuerda, regresa, repara, responde, resta, revisa, rica, rojas, romo, rompe, rota, rápido, ríe, ríen, sabe, saca, salado, salir, se come, se da cuenta, se despierta, se duerme, se equivoca, se llama, se prepara, se queja, se rompió, se sienta, seguidos, seguramente, sentado, seque, seria, siente, sigue, silencioso, simpática, sin darse cuenta, sin prisa, sirvió, sobra, sola, solo, somos, sonríe, sorprender, sos, sostiene, soy, suavemente, sube, subraya, sucio, suelta, suena, sueña, suficiente, sujeta, suma, suya, tal vez, también, tampoco, tan, tanto, tarda, tarde, tengo, termina, tiene, tiene hambre, tiene miedo, toca, toma, torcida, trae, tranquilo, trato hecho, triple, triste, tímido, un poco, une, uno por uno, untas, usado, va, vacía, ven, vení, venís, verdadero, verde, verdes, ves, vieja, vive, viven, vivo, voy, vuela, ya, ya no, último, único

### 5.3 Dónde se decide de verdad: en la escena

El solape se evita eligiendo campos léxicos que el A0, el A1 y los journeys de
España no tocaron, no cambiando qué palabras se marcan. Los siete campos de abajo
están APROBADOS (2026-08-31) y todos sus lemas están verificados libres del cubo
de tolerancia cero y dentro de la lista curada A1/A2.

**Regla de uso para los campos de objetos (temas 2, 6 y 7): cada plaza aparece en
una ACCIÓN de la escena, nunca en catálogo.** Tres objetos seguidos en una frase
son un catálogo y hay que romperlos. Un objeto que no cabe en una acción concreta
no entra, aunque esté libre.

| Tema | Campo aprobado | Lemas de muestra | Campo que hay que esquivar |
|---|---|---|---|
| 1 Friends & Reunions | la foto como oficio | cámara, película, portarretratos, blanco y negro, luz suave, reflejo, bosquejar, arte, marco, espejito | fiesta y familia (A0) |
| 2 Staying With Locals | la casa prestada y sus cacharros | alojamiento, percha, guardarropa, cobertor, cafetera, licuadora, plato hondo, merienda, lavado, frigorífico | piezas y averías de la casa (A1) |
| 3 Jokes & Misunderstandings | la mesa larga y el público | invitada, celebración, fiesta, música, guitarra, compañero, cafetería, restaurante, gaseosa, apariencia | conversación básica (A0) |
| 4 Borders & Crossings | el río y la espera | canoa, balsa, puerto, costa, isla, ticket, panel, balde | billetes y equipaje (A1) |
| 5 Secrets & Curiosity | la pensión y lo escrito | inquilinos, diario, escritos, candil, velón, frascos, cajita, librero, propósito | miedo y emoción básicos (A0) |
| 6 Work Trips & Meetings | el acuerdo y la comida de trabajo | ensalada, plato llano, mantequilla, salchicha, chuleta, modelo, experiencia, tarta, sorbete, panel | oficina como objeto (A1) |
| 7 Local Life & Routines | el puesto y la vuelta del pasillo | frutería, carnicería, heladería, dulcería, supermercado, tomate, melón, sandía, durazno | mercado y comida (A0 y A1) |

Podados a propósito por no ser nativos de su escena: `chequera` y `brújula` del
tema 4, `atalaya` del 5, `movimiento bancario` del 7.

**Reaperturas de otro tipo de journey: solo dos en todo el A2**, `cámara` e
`invitada`. `vocab-taught-elsewhere` tolera dos por historia, pero el journey
gasta esas dos y ninguna más. Cualquier otro lema del cubo blando queda fuera.

## 6. Los siete temas

Cada tema son tres historias con un arco cerrado y se lee suelto. Marisol está en
las 21. El interlocutor del tema aparece en sus tres historias y no habla nadie
más: dos voces por historia como mucho. El cuaderno abre y cierra cada tema, y al
cerrarlo dice cuál es la parada siguiente.

---

### Tema 1. Friends & Reunions (`friends-and-reunions`) · Argentina, Rosario

**Interlocutor**: Leandro, el amigo de hace años. Es el único tema en el que
habla. **Reparto de la primera historia del journey: solo Marisol y Leandro.**
**En juego en el arco**: Marisol le debe a Leandro una respuesta desde hace once
años y viene a darla en persona; si se va sin darla, la amistad se acaba de
verdad.

**H1. Once años tarde.** Marisol llega a Rosario un martes con una sola noche
libre y la dirección de un taller que Leandro ya no ocupa. Lo encuentra en el
patio de al lado y lo primero que él dice no es hola, es una cifra: once. Ella
había prometido volver al año siguiente y no volvió, y ninguno de los dos sabe
todavía si esta visita es una disculpa o un trámite. Marisol quiere contarle por
qué desapareció; Leandro corta el tema dos veces y le ofrece cena en su lugar. El
coste: ella acepta la cena y deja la explicación para mañana, y mañana ya no está
en la ciudad. Sale de la casa con un cuaderno que Leandro le pone en la mano sin
explicar para qué, y con la conversación intacta.

**H2. Lo que no se dijo en la cena.** Al día siguiente Marisol cambia el pasaje y
se queda. Va a buscar a Leandro al lugar donde trabaja y él la recibe delante de
gente, que es su manera de que no se hable de nada. Ella insiste; él responde con
una versión de la historia en la que ella queda mal, y lo dice en voz alta. Aquí
Marisol descubre que Leandro lleva once años contando ese cuento a otros, y que a
esta altura ya no importa quién tenga razón. Lo que pierde: la idea que tenía de
sí misma en esa amistad. Lo que gana: entiende, por fin, qué le está reprochando
de verdad, y no es la ausencia.

**H3. El plan que nunca hizo.** Última mañana. Marisol no va a discutir; abre el
cuaderno y ve que está escrito entero de la letra de Leandro, hace once años: un
plan de viaje, parada por parada, que los dos iban a hacer juntos. Le pregunta si
lo hizo y **él dice que nunca lo hizo**, ni solo ni con nadie. El narrador no lo
confirma: la frase es de Leandro y Marisol se la cree. Ella le pregunta por qué y
él contesta con la única frase del tema que no es una defensa. Marisol no devuelve el cuaderno: se lo lleva y le
dice que va a hacer el viaje y a fotografiarlo. Leandro no lo aprueba ni lo
impide. No hay reconciliación grande; hay un acuerdo pequeño y frío que los deja
mejor de como estaban, pero no bien. **Siguiente parada según el cuaderno**:
Salento.

---

### Tema 2. Staying With Locals (`staying-with-locals`) · Colombia, Salento

**Interlocutor**: Yolanda, la madre de la casa.
**En juego en el arco**: la página de Salento dice "casa de Yolanda, tres
semanas", y Marisol llega con alojamiento gratis que necesita que dure; cada
intento suyo de ser buena huésped ofende un poco más, y a la tercera se queda en
la calle o se queda de verdad.
**Candado de contraste con el tema 7**: aquí la norma **no se enuncia nunca** y
Marisol la rompe a ciegas. Si en el texto final este arco y el del tema 7 se
resuelven igual, uno de los dos está mal escrito.

**H4. La huésped que paga sin que le pidan.** Marisol llega con una regla propia:
no deber nada a nadie. La primera noche deja dinero sobre la mesa de la cocina.
Yolanda no lo toca ni lo menciona, y a la mañana siguiente el dinero sigue ahí y
el desayuno es para uno. Marisol tarda media historia en entender que ofendió, y
cuando pregunta, Yolanda le contesta con una pregunta peor. Lo que cuesta: tres
días de trato helado en una casa donde comparte cocina. Termina sin arreglarlo,
guardando el dinero en el bolsillo como quien recoge una cosa que se le cayó.

**H5. La regla que nadie dijo.** Marisol decide corregirse trabajando: friega,
barre, se ofrece para todo, y de paso pide fotografiar la casa. Yolanda la deja
hacer y después rehace lo que ella hizo, delante de ella, sin comentarlo. La
tensión sube hasta que Marisol pierde la paciencia y dice algo que no debía sobre
cómo se hacen las cosas en su casa. Yolanda no contesta esa noche. La casa tiene
una norma que nunca se enuncia y que ella lleva cinco días rompiendo: la que se
hospeda no manda en la cocina. Acaba peor de como empezó, con Yolanda diciéndole
a qué hora tiene libre la habitación el domingo.

**H6. Lo que sí se acepta.** Marisol no se disculpa con palabras, que ya probó.
Le pide a Yolanda que le enseñe a hacer una cosa concreta y se deja corregir en
público, delante de dos vecinas, que es exactamente lo que a ella le cuesta.
Yolanda no cede de golpe; le hace repetirlo mal tres veces. El domingo la
habitación sigue siendo suya, pero ahora paga, y paga porque Yolanda se lo pidió,
que era el punto desde el principio. La única foto que se lleva de la casa se la
hace Yolanda a ella, y no al revés. **Siguiente parada**: Medellín.

---

### Tema 3. Jokes & Misunderstandings (`jokes-and-misunderstandings`) · Colombia, Medellín

**Interlocutor**: Fabián, el amigo bromista.
**En juego en el arco**: Marisol viene a cerrar el encargo de fotos que paga el
resto del viaje, y el amigo que la aloja convierte todo en chiste, incluida ella,
delante de la persona que tiene que contratarla.

**H7. En serio no era.** Fabián recoge a Marisol y la presenta a sus amigos con
una historia inventada sobre ella que todos celebran. Marisol sigue la broma para
no quedar mal y al final de la noche descubre que dos de los presentes se la
creyeron y que uno de ellos es quien decide su encargo. Lo que quiere: aclararlo
sin dejar a Fabián en ridículo. Lo que se lo impide: Fabián insiste en que
aclararlo es peor. Termina riéndose de algo que no le hace gracia y con el
malentendido intacto.

**H8. La broma que se cobra.** Marisol decide devolverla y le prepara a Fabián
una broma calculada, con público. Le sale bien y le sale cara: Fabián se ríe
delante de todos y después no le habla en tres días, y ella se entera de que hay
un tema del que en ese grupo no se bromea y que acaba de tocar. Aquí explota su
defecto: Marisol mide a la gente por si aguanta o no aguanta, que es exactamente
lo que Leandro le reprochó en Rosario. Pierde al único que podía hablar por ella
antes de la reunión.

**H9. Quién explica qué.** Día de la reunión. Marisol va sola, sin Fabián, y
tiene que deshacer ella misma el cuento de la primera noche delante de la persona
que la va a contratar, sin gracia y sin red. Lo hace mal y honesto. Fabián
aparece al final, no para salvarla sino para decir su parte, y lo dice sin chiste
por primera vez en el tema. El encargo sale a medias: dos semanas de trabajo se
quedan en una, y el presupuesto del viaje se acorta. **Siguiente parada**: el
cruce del sur, escrito en el cuaderno con una fecha que Leandro no llegó a usar.

---

### Tema 4. Borders & Crossings (`borders-and-crossings`) · Perú, Santa Rosa

**Interlocutor**: Karina, la oficial del puesto fluvial peruano.
**En juego en el arco**: Marisol tiene que estar del otro lado el jueves, porque
la persona a la que va a fotografiar se va el viernes, y su permiso de equipo
lleva una fecha mal escrita que no puso ella.
**Candado de ruta**: las tres historias pisan solo el lado peruano, Santa Rosa.
Leticia se nombra y no se muestra. **Ninguna escena en Brasil y ningún personaje
brasileño con línea de diálogo.**
**Escena aprobada el 2026-08-31: el EMBARCADERO, no el mostrador.** El léxico del
trámite (sello, fila, pasaporte, cédula, equipaje, formulario, plazo, requisito)
está gastado entero por el A0, el A1 y los journeys de España, así que el campo
que sí existe es el del río y la espera: canoa, balsa, puerto, costa, isla,
ticket, panel, balde. El cruce es fluvial de verdad, así que la escena no se
fuerza: se corrige.

**H10. Un motivo que no convence.** Marisol llega al embarcadero con todo en regla
menos una fecha, que está mal en un papel que le dieron a ella. Karina no discute:
le explica dos veces qué le falta y le dice que puede volver mañana en la primera
canoa. El problema es que mañana es tarde. Marisol prueba a explicar el encargo,
la urgencia, la cadena entera; Karina escucha todo y no cambia nada, porque no
depende de ella. Lo que cuesta: un día, el alojamiento de un día, y la primera
llamada incómoda a quien la espera. Vuelve al pueblo con el cuaderno abierto en la
página del cruce, donde Leandro había apuntado la misma fecha.

**H11. El que sí puede firmar.** Marisol pasa el día buscando a quien pueda
corregir la fecha y descubre que la oficina que la emitió cierra a mediodía y que
hay un modo rápido que le ofrece un tipo en el muelle por dinero. Casi lo toma. Lo
que la detiene no es la moral, es que Karina, fuera de servicio y esperando su
propia balsa, la ve hablando con él y no le dice nada, solo la mira. Marisol hace
la cola larga, llega a las once y media y no alcanza. Segunda noche perdida, y
ahora sí, la foto por la que vino se cae.

**H12. Del otro lado.** Miércoles. Marisol cruza por fin, con la fecha corregida y
con la persona a la que iba a fotografiar ya de viaje. Karina la despacha en dos
minutos y, al devolverle el papel, le hace la única pregunta personal del tema:
por qué lleva un cuaderno con la letra de otro. Marisol cruza sin nada que hacer
al otro lado, y esa es la historia: consiguió exactamente lo que pedía y llegó
tarde. **Siguiente parada**: Arequipa, y en esa página hay un nombre.

---

### Tema 5. Secrets & Curiosity (`secrets-and-curiosity`) · Perú, Arequipa

**Interlocutor**: Zoila, la dueña de la pensión.
**En juego en el arco**: en la página de Arequipa, Leandro escribió un nombre y
una dirección. Marisol viene a buscar a esa persona, y la única que sabe dónde
está es la dueña de la pensión, que no piensa decírselo.
**Candado de continuidad con H3**: en H3 la afirmación de que Leandro nunca hizo
el viaje es SUYA, no del narrador, y Marisol se la creyó. Su letra en el libro de
huéspedes de H14 es el giro que la desmiente. Si al escribir H3 el narrador da
por hecho que no fue, H14 deja de ser un giro y pasa a ser una contradicción.

**Y la semilla concreta que lo paga vive en H3, en esta frase: "Ella no le cree
del todo y a la vez quiere creerle."** Es la duda que hace creíble que Marisol
cruce medio continente para que le confirmen lo que ya le dijeron. **No se toca
en ningún retoque de H3.** Si se cae por recorte, el motivo del tema 5 se queda
sin apoyo y hay que reponerla antes de escribir H13.

**Lo que Marisol no dice hasta la tercera**: no busca a esa persona por Leandro,
sino para que le confirme que Leandro nunca hizo el viaje. Si él tampoco fue,
sus once años de ausencia pesan menos. Ese es el motivo y la deja mal.

**H13. La pregunta que no se hace.** Marisol lleva cuatro días preguntando por un
nombre y nadie le contesta lo mismo dos veces. Zoila la escucha preguntar y no
interviene hasta el cuarto día, cuando le dice que deje de preguntar así, que va
a conseguir que esa persona se vaya de la ciudad. Marisol entiende dos cosas a la
vez: que Zoila sabe, y que decírselo depende de que ella explique para qué lo
busca. No lo explica. Se queda sin la información y con Zoila enterada de todo.

**H14. Lo que la dueña calla.** Marisol intenta el atajo: revisa el libro de
huéspedes de la pensión cuando Zoila no está. La pilla otra huésped, que no habla
en la historia pero lo cuenta, y la cosa se sabe en la casa antes de la cena.
Zoila no la echa. Le sirve la comida y le habla del clima delante de todos, que
es peor. Lo que Marisol pierde ahí es el derecho a preguntar, y lo pierde por su
culpa. Y lo que encuentra en el libro no es lo que buscaba: es la letra de
Leandro, de hace once años, en una línea que ella no esperaba.

**H15. Por qué lo busca.** Última noche. Marisol cuenta por fin para qué vino, y
lo cuenta mal, porque la razón no la deja bien a ella: quería que le dijeran que
él tampoco fue. Zoila la deja terminar y después le dice lo que sabe, que es la
mitad de lo que Marisol esperaba y le cambia el viaje entero. No hay abrazo. Hay
una advertencia de Zoila sobre qué va a pasar si aparece sin avisar, y una página
del cuaderno que Marisol no vuelve a abrir en dos temas. **Siguiente parada**:
Guadalajara.

---

### Tema 6. Work Trips & Meetings (`work-trips-and-meetings`) · México, Guadalajara

**Interlocutor**: Araceli, la colega local.
**En juego en el arco**: Marisol viene tres días a cerrar un acuerdo que su
agencia ya dio por cerrado, y Araceli sabe desde el primer día que no lo está.

**H16. Todo listo, dicen.** Marisol llega con el acuerdo escrito y una reunión de
media hora en la agenda. La reunión dura dos horas y no se decide nada, y Araceli
la saca de ahí antes de que insista una tercera vez. En el pasillo le explica que
aquí eso fue un no, y Marisol no le cree. Lo que quiere: firmar el jueves. Lo que
se lo impide: que ya le dijeron que no y ella no lo oyó. Termina mandando a su
agencia un mensaje que dice que va bien, sabiendo mientras lo escribe que no es
cierto.

**H17. La comida donde se decide.** Araceli la lleva a una comida a la que
Marisol no quería ir porque no era de trabajo. Ahí está la persona que sí decide,
y ahí Marisol tiene que elegir entre defender su propuesta como la traía o
rehacerla en voz alta delante de todos, quitándole a su propia agencia la parte
que más le importaba. Elige rehacerla. Gana la conversación y pierde el respaldo
de los suyos: al día siguiente le contestan por escrito y por escrito no la
apoyan.

**H18. Firmar menos.** Jueves. Marisol firma un acuerdo más chico que el que
traía y con una condición que Araceli le pidió en privado y que no está en ningún
papel. Vuelve con la mitad de lo que fue a buscar y con la única colega que le va
a contestar el teléfono el año que viene. Esa noche le manda a Leandro la primera
foto desde Rosario, sin texto. **Siguiente parada**: Mérida, la última página.

---

### Tema 7. Local Life & Routines (`local-life-and-routines`) · México, Mérida

**Interlocutor**: Salvador, el vecino del mercado.
**En juego en el arco**: Marisol se queda tres semanas cubriendo a alguien en un
puesto de revelado del mercado, y el pasillo tiene un orden de turnos y favores
que ella rompe por eficiente.
**Candado de contraste con el tema 2**: aquí la norma **se la dicen a la
primera**, con claridad, y ella la descarta porque técnicamente no hace nada mal.
Y el cierre es económico (la caja, el fiado, el turno de Salvador), no social.

**H19. La que abre primero.** Marisol abre a las cinco y media porque en su
ciudad se abre a las cinco y media, y a las siete tiene cola y a las siete y
media tiene al resto del pasillo sin clientes. Salvador se lo dice a la primera y
sin rodeos, y ella lo oye y lo descarta, porque técnicamente no está haciendo
nada mal. Al tercer día alguien le mueve la mesa de sitio por la noche. Lo que
cuesta: una mañana entera de trabajo y la certeza de que tenía razón.

**H20. Fiado.** Una clienta pide fiado por costumbre y Marisol dice que no,
porque la caja no es suya. Se entera esa tarde de que esa mujer lleva ocho años
pagando los viernes y de que la persona a la que cubre le fiaba a media calle.
Marisol tiene que decidir si sostiene su regla o hereda las deudas de otro sin
saber cuánto suman. Elige mal a propósito: apunta todo en el cuaderno, que usa
como libreta de fiados porque no tiene otra cosa a mano, y el viernes no aparece
la mitad.

**H21. De siempre.** Último día del reemplazo. Marisol entrega el puesto con la
cuenta hecha, y la cuenta le da en contra. Salvador aparece con la mitad del
dinero que faltaba, no como regalo sino como el turno que le tocaba a él, y ahí
Marisol entiende cómo funcionaba el pasillo desde el principio. Arranca la hoja
de los fiados y deja el cuaderno cerrado: el plan de Leandro está hecho entero,
once años tarde y por otra persona. Si se lo dice o no, la historia lo deja en
una línea y no lo explica.

---

## 7. Lo que este brief NO decide

1. **Voces.** Las ocho quedan pendientes. El audio es el último paso del
   journey y ninguna voz entra sin que el usuario la apruebe de oído. Ninguna
   síntesis de prueba sobre voces aprobadas.
2. **Las 420 palabras.** El brief fija la forma, los campos léxicos y las
   exclusiones; las 20 plazas de cada historia se eligen al escribirla y se
   clasifican a mano en portable o anclada, no por el campo `type`.
3. **Los 21 títulos definitivos.** Los de arriba son de trabajo.
4. **Qué hacer con el 50% de ancladas.** Se mide al cerrar la historia 15 y se
   decide con datos.
5. **Portadas.** El prompt de cada portada se cierra antes de la primera tirada,
   con la ficha literal de la sección 2, registro visual anclado a una portada de
   referencia, reparto corto y completamente descrito, y prohibición de texto
   explícita. Tope de dos tiradas por portada.
