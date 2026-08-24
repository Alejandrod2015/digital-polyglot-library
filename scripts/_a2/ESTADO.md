# Traveler ES/spain A2, estado al 2026-08-24

Journey `cmt70xfyt000l3283gxd70wck` (spanish / spain / a2 / traveler, **draft**,
7 temas x 3 = 21). Las 21 historias estan escritas, validadas y **guardadas en
la base**, con practica y glosas. Faltan portadas y audio, que gastan creditos.

## Lo primero, porque manda el diseno: que quedaba de la pool

El B1 se escribio antes que el A2 y se llevo su parte del cubo A1-A2. Medido
antes de elegir un solo tema (`scripts/_a2/pool.ts`):

| | |
|---|---|
| lista A1+A2 de espanol | 2731 lemas |
| cubo de tolerancia CERO (Traveler del pool de Espana: A1 + B1) | 890 |
| cubo de tope 2 por historia (Friends ES/spain A0) | 296 |
| **libres para el A2** | **2200** (193 con tope 2) |

Los 2200 en bruto enganan: quitando gramaticales, numerales, meses, flexiones y
americanismos quedan **1660 usables** (`scripts/_a2/palette.py` ->
`paleta.txt`), y de ahi salen las 438 plazas.

**Lo que la medicion tumbo antes de escribir nada:** el sexto tema iba a ser
"Teasing & Being Funny", con la frase de Jaelyn sobre ser mas graciosa que su
novio. La lista A1+A2 casi no tiene humor y lo poco que tiene (`broma`,
`chiste`, `reirse`, `sonriente`) ya lo ensenan el A1 y el B1 de Espana. Un tema
cuyo dominio lexico esta entero fuera de alcance no es un tema; se cambio por
"Pots & Home Cooking" con otra frase de la misma solicitante.

Tambien esta el reves del mismo golpe: la casa entera esta quemada. `caja`,
`escalera`, `puerta`, `rellano`, `bolsa`, `maleta`, `cubo`, `persiana` las tiene
el A1; `techo`, `armario`, `manta`, `lampara`, `grifo`, `cerradura`, `tornillo`,
`martillo`, `polvo`, `cuerda` las tiene el B1. Un A2 sobre mudarse a un piso era
imposible, y por eso el journey sale a la calle: al monte, a la huerta, a la
cocina de otra persona y a las manos.

## Los siete temas

Porton de evidencia en verde: siete frases distintas de **seis solicitantes**
distintos de espanol (`scripts/_a2/proposeTopics.ts`). El corpus entero son 31
frases escritas (`scripts/_a2/_corpus.ts`) y de esas solo seis o siete nombran
un dominio; el B1 gasto siete, asi que dos de estas son otra mitad de una frase
que el B1 ya cito por su lado.

| # | tema | cita | quien |
|---|---|---|---|
| 1 | Fetching & Handing Over | "that I can't seem to understand, reached for or fixed" | Jaelyn |
| 2 | Company & Long Afternoons | "Liquido en espanol con mis amigo Alexandros" | Sascha |
| 3 | Hands & Gestures | "instantly check translations that I don't understand" | Ty |
| 4 | Orchards & Baskets | "when travelling to Spain" | Geraldine |
| 5 | Pots & Home Cooking | "He lives with his grandmother who only speaks Spanish" | Jaelyn |
| 6 | Nerves & Courage | "want to try all the chances which are available" | Christoph |
| 7 | Keys & Signatures | "Holiday home in Spain and I wish to talk to neighbours" | Vincent |

## El arco

Otono en Nerja, entre el julio del A1 y el enero del B1. Reparto heredado:
Irene, Rocio, Quique, Rosa y Marta, mas **Alvaro** (el del huerto), que es el
unico nombre nuevo y sale del banco `spanish/spain`.

Deseo: quedarse. Obstaculo: sigue siendo una invitada. Coste: el dinero y el
puente de vuelta. **Espina:** el pueblo da por hecho que se va en octubre, y la
misma vecina que le da de comer cada jueves tiene medio prometido su piso a
otra. Se planta en 1.2, se lee mal en 3.2, se destapa en 5.3 y 7.1, y se cierra
en 7.2.

## Gates

- **Validador canonico**: 21/21 en verde (`saveStory --narrator`).
- **Gate de journey**: 12 de 13 pasan. La 13 **INFORMA**: `1,33 historias por
  plaza`, sin liston, porque no hay ningun A2 en el catalogo del que sacarlo.
  Referencias con la misma formula: B1 de Espana 1,48; los A1 del catalogo entre
  1,43 y 1,88; los C1 entre 0,82 y 1,56.
- `body-word-count`: **A2 entra en el tramo de UN MINUTO**. No es decision nueva,
  es la que ya estaba escrita ahi para A1 y B1; A2 estaba fuera por omision y eso
  dejaba la cadena con un bulto en medio (132-168 palabras, 220-280, 132-168).
  Meterlo APRIETA la ventana, no la abre.

## Lo que solo se vio leyendo las 21 seguidas

- **34 vocativos** (guapa 19, hija 12) en 21 cuerpos, casi uno por linea citada.
  El A1 de Espana, que es el patron, tiene 15; el B1 ya iba por 24. Bajado a 13.
- "Irene mira" abria frase en cuatro; "se rie" cerraba cuatro; en una historia
  "la alegra" salia dos veces en dos frases seguidas.
- Ninguna de las tres la caza un gate: son de conjunto y de oido.

## Practica y glosas

- **21 sets sembrados**, 588 ejercicios, sin audio (no gasta creditos).
- De paso salio un fallo de catalogo: el arreglo del 2026-08-23 hizo que
  `fill_blank` EMITIERA los distractores en su superficie, pero el tramo de
  concordancia espanola seguia comparando el LEMA. Con control: A1 1%, B1 2%,
  A0 5%, este A2 (que marca `surface` en media plaza) **44%**. Arreglado en
  `src/lib/practiceExercises.ts`; queda en 11%, y de esos solo tres son de una
  palabra.
- **Glosas**: `src/data/tapGlosses/spanish-traveler-spain-a2.json`, 21 slugs,
  952 entradas, **0 palabras muertas** al tocarlas. 686 copiadas de un paquete
  hermano y 266 escritas; de las copias, **118 traian el sentido de otro
  journey** y se corrigieron leyendolas contra la frase de esta historia
  (`rosa` decia "pink" y aqui es la panadera; `banqueta` decia "the sidewalk",
  que es el sentido mexicano; `coraje` decia "anger"; `julio` era un nombre).

## Cadena

`a0 Friends -> a1 Traveler -> a2 Traveler -> b1 Traveler`, escrita en
`Journey.nextJourneyId` (`scripts/_a2/encadenar.ts`). El A1 apuntaba al B1 y
ahora apunta al A2.

## Reglas sin gate, medidas a mano (2026-08-24)

`scripts/_a2/reglas.ts`. De las que ningun check mide, tres fallaban y se
arreglaron; el resto ya estaban bien.

| regla | antes | ahora |
|---|---|---|
| frase que cierra en relativa colgada | 7 | 0 |
| plazas marcadas `anchor` | 0 de 438 | 126 de 439 (28%) |
| ancla cultural con plaza (`guapa` como trato) | no | si, en `el-atajo-no-era-un-atajo` |
| imperativo breve solo en su turno | 0 | 0 |
| glosas con `=` | 0 | 0 |
| comillas angulares o rectas | 0 | 0 |
| guiones largos | 0 | 0 |
| argot en nivel A | 0 | 0 |
| arco 1 a 3 dentro de cada tema | leido, encaja | |

Las siete relativas se cortaron ANTES de generar un segundo de audio, que es
cuando sale gratis: esa forma sube el tono al final y el gate F0 agota sus tres
tomas sin arreglarlo, porque no es azar de la toma sino la forma de la frase.

## Pendiente

- **Portadas**: ninguna. Gastan creditos de imagen y esperan al verbo del
  usuario. El prompt tiene que ir cerrado antes de la primera tirada (ficha de
  personaje, registro anclado, reparto completo, prohibicion de texto).
- **Audio**: ninguno. Narrador heredado del A1: Maia `jipeLrCHZ6ByxrU2JP9i` a
  2,45 palabras por segundo. Gasta creditos y espera al verbo.
- **Publicar**: el journey sigue en `draft`.

## Herramientas

`pool.ts` + `pick.ts` + `paleta.txt` (que se puede ensenar) · `proposeTopics.ts`
(el porton) · `createJourney.ts` · `quick.ts` (chequeo mecanico antes de
saveStory) · `weave.ts` (la escalera, plaza a plaza) · `tics.ts` (los vocativos
contra el A1) · `auditPractica.ts` · `glosas.ts` + `glosas/build.ts` +
`glosas/check.ts`.
