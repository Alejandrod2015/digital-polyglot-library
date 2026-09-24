# Medicion de `castOf`: tamano y forma del fallo (2026-09-24)

Encargo: MEDIR, no arreglar. Nada de `src/lib/validateJourneyStories.ts` se ha
tocado; los scripts `scripts/_cast*.ts` son sondas de lectura.

## 1. Como decide `castOf` que un nombre es del reparto

`castOf(stories, lang)` (`src/lib/validateJourneyStories.ts:163`) es una
INTERSECCION de dos filtros. Un nombre entra solo si pasa los dos:

**Filtro 1, "habla".** Una lista de verbos de habla por idioma,
`HABLA_POR_IDIOMA` (linea 113), se cruza con el nombre en los DOS ordenes:
`(?:VERBO)\s+([\p{Lu}][\p{Ll}]+)` y `([\p{Lu}][\p{Ll}]+)\s+(?:VERBO)`. Se
exige en **2 historias distintas o mas** del lote que se valida. Tamano de las
listas: DE 11 verbos (solo presente, 3a persona singular), ES 42, PT 25, IT 63,
FR 76. Si el idioma no tiene lista, cae en la ALEMANA.

**Filtro 2, `castLegacy`** (linea 180). Recorre `\p{Lu}\p{Ll}{2,}` (mayuscula
inicial, tres letras o mas, sin mayuscula interior) y mira los 14 caracteres
anteriores:
- si hay un ARTICULO pegado (`der|die|das|...|el|los|las|il|lo|gli`, mas
  `o|a|os|as|um|uma` fuera de ES/FR/IT), el nombre queda EXPULSADO del reparto
  para todo el journey;
- si no, cuenta solo si viene precedido por `[\p{Ll}],?\s+$`, es decir, por una
  palabra en MINUSCULA. Se pide en 2 historias o mas.

Consecuencias directas del filtro 2, y son las que mas duelen:
- un nombre **al empezar frase o parrafo** no cuenta nunca (detras hay punto o
  salto de linea, no minuscula);
- un nombre en una **etiqueta de dialogo** (`Mariana: ...`) no cuenta nunca,
  por lo mismo;
- **un solo** `o Caio` / `die Nadia` en 21 historias borra al personaje entero.

El orden de salida es por numero de historias descendente, y varios gates leen
`cast[0]` como protagonista.

## 2. Metodo de la medicion

Universo: los **48 journeys live + draft con texto** (de 51; el arabe, el
coreano y el polaco tienen 1 historia y quedan fuera por falta de texto). Los
archivados no entran.

Reparto REAL, por una senal independiente de los verbos de habla:
1. token capitalizado presente en **3 historias o mas** del mismo journey;
2. descartado todo token que aparezca alguna vez en minuscula en el journey
   (mata `entonces`, `nadie`, `allora`, `merci`);
3. curacion a mano del resto para separar personas de ciudades, meses y
   sustantivos comunes alemanes (`Tisch`, `Hand`, `Leute`), en
   `scripts/_castNames.json`;
4. contrastado con `JourneyStory.dialogueSpec.speaker` en los 12 journeys que
   lo tienen guardado, que es un dato escrito por el pipeline de voces y no por
   este detector. `JourneyStory.cast` esta VACIO en los 51, no sirve de senal.

`castOf` se ejecuta VERBATIM: `scripts/_castExtract.ts` es una copia literal de
las lineas 113-216 del fichero real (verificado con `diff`), para que la sonda
no mida una reimplementacion.

## 3. Resultado

**335 personajes reales en 48 journeys. `castOf` encuentra 196 y pierde 139
(41,5%). Falsos positivos: 0.**

El detector no ensucia: recorta. Los cinco nombres que al principio parecian
sobrar (Luisa, Felix, Nicola, Fernanda, Deivis) son personas de verdad que mi
umbral de 3 historias dejaba fuera de la lista curada, no basura de `castOf`.

Por idioma:

| Idioma | Journeys | Reparto real | Faltan | % perdido |
| --- | --- | --- | --- | --- |
| DE | 9 | 61 | 38 | 62% |
| PT | 6 | 34 | 16 | 47% |
| ES | 24 | 185 | 72 | 39% |
| IT | 4 | 25 | 8 | 32% |
| FR | 5 | 30 | 5 | 17% |

**Cinco journeys con el reparto VACIO** (los gates de reparto no miden nada):
Traveler DE A1 draft, Expat DE C1 active, Conversations ES latam A0 draft,
Traveler ES mexico A1 active, Friends ES latam C1 active.

**Seis journeys donde falta alguien que sale en el 90% de las historias o
mas**: Lena y Miriam en el Friends DE B1, Nadia en los dos journeys de Berlin
(Friends DE C1 y Expat DE C1), Sofia en el Traveler ES mexico A1, Lucia en el
Friends ES spain A1, y Mariana y Nicolas en el Conversations ES latam A0. En esos casos `cast[0]` senala a un secundario: en el Friends DE C1
el "protagonista" que imprime el gate de cierres es **Steffi**, que sale en 3
de 21, mientras Nadia sale en 21.

## 4. Reparto de causas (139 nombres perdidos)

| Causa | Nombres | Que pasa |
| --- | --- | --- |
| C. Umbral: habla en 1 sola historia | 41 | El nombre SI va pegado a un verbo de la lista, pero en una historia; el filtro pide 2 |
| F. Solo sujeto de verbo de accion | 36 | Habla entre comillas, pero el narrador no lo atribuye con verbo: `Marta mira`, `Miriam bleibt`, `Rosa compra` |
| A. Formato dialogo (etiqueta `Nombre:`) | 33 | El hablante va en la etiqueta de la linea, donde no hay verbo ni minuscula delante |
| B. Verbo de habla fuera de la lista | 18 | `meint`, `erklaert`, `wiederholt` en DE; `comenta`, `propone` en ES; se recuperarian ampliando la lista |
| D. `castLegacy`: articulo delante | 6 | Habla de sobra (2 a 5 historias) pero `die Nadia` / `o Caio` lo expulsan |
| E. `castLegacy`: solo al empezar frase | 5 | Habla de sobra, pero solo aparece tras punto o salto de linea |

Ejemplos reales, uno por causa:
- **C**: Emilia, Traveler DE A0, 5/21 historias, `habla=1`.
- **F**: Rosa y Gaia, Traveler IT A1, 3/21, `habla=0`, sin etiquetas.
- **A**: el Traveler DE A1 entero esta en formato dialogo; sus 15 personajes
  llevan entre 12 y 16 etiquetas `Nombre:` cada uno y el reparto sale VACIO.
  El Friends DE B1 de Munich es MIXTO: Bastian y Tobias tienen narracion
  (`Bastian sagt`, 5 veces) y salen; Lena (67 apariciones, todas como
  etiqueta), Miriam y Verena no.
- **B**: Verena, Friends DE B1, va con `meint` dos veces; `meint` no esta en la
  lista alemana. Svenja, Theresa y Philipp en el Friends DE A1, lo mismo.
- **D**: Nadia (21/21) y Timo (15/21) en el Friends DE C1 hablan y aun asi
  quedan fuera, por un articulo delante. Caio, en el Traveler PT A0, 14/21.
- **E**: Baptiste, Friends FR A1: `habla=3`, pero siempre abre frase.

Dos lecturas de conjunto:
1. **La causa dominante NO es la lista de verbos.** Ampliarla recupera 18 de
   139. Bajar el umbral a 1 recupera 41 mas. Lo gordo (33 + 36 = 69) es que el
   detector solo ve un modo de atribuir habla: narracion con verbo pegado.
2. **El fallo del aleman no es "en prosa detecta de menos".** El Friends DE B1
   esta escrito con etiquetas de dialogo, igual que el Conversations ES A0 que
   ya se conocia: es la MISMA ceguera, no una segunda. Lo que si es propio del
   aleman es el tamano de la lista (11 verbos, solo presente singular: `sagte`,
   `fragte`, `sagen` no casan) y el articulo delante del nombre, que en aleman
   coloquial y en portugues es gramatical.

## 5. Gates afectados

Simulando los cinco gates con el reparto detectado y con el real: **25 de 48
journeys cambian de color en al menos un gate.**

| Gate | Falsos VERDES | Falsos rojos |
| --- | --- | --- |
| `journey-cast-fixed-max-two` | 8 | 0 |
| `journey-cast-first-story-only-fixed` | 8 | 2 |
| `journey-cast-protagonist-in-all` | 5 | 5 |
| `journey-cast-one-new-per-topic` | 4 | 1 |
| `journey-closing-alone` | 0 | 13 |

Como se produce cada uno:

- **`fixed-max-two` (8 falsos verdes).** Cuenta fijos sobre `cast`. Menos
  nombres, menos fijos. Friends DE B1: detectado 2 (Tobias, Bastian), real 5.
  Friends DE A1: detectado 2, real 5. El tope de dos voces sostenidas, que es
  una regla de oido del usuario, no se esta midiendo en ocho journeys.
- **`first-story-only-fixed` (8 falsos verdes).** Cuenta cuantos del reparto
  salen en la primera historia. Friends DE B1: detectado 2, real 5.
- **`protagonist-in-all` (5 y 5).** Los 5 falsos verdes son donde el reparto
  recortado deja justo a uno que sale en todas y el gate da por bueno el hilo.
  Los 5 falsos rojos, lo contrario. En los 5 journeys de reparto vacio el gate
  no da ni verde ni rojo: sale `NO MIDE`, que es lo unico honesto que hace hoy.
- **`one-new-per-topic` (4 falsos verdes).** Personajes nuevos que el detector
  no ve no cuentan para el tope del tema.
- **`closing-alone` (13 falsos rojos).** El peor en volumen. Marca cierre a
  solas cuando el ultimo parrafo no lleva a NADIE de `cast.slice(1)`; si faltan
  secundarios, casi todos los cierres parecen a solas. Traveler DE A1: 21/21
  marcados, con el reparto real 1/21. Friends DE C1: 19/21 contra 11/21.
  Ademas imprime `protagonista ?` o un secundario en 8 journeys.

El falso verde es el peor de los dos y aqui suma **25 casos** repartidos en
cuatro gates; el falso rojo, 21, concentrado en los cierres.

## 6. Tabla por journey

| Journey | Idioma | n | Detectado por castOf | Reparto real (>=3 hist) | Faltan | Sobran |
| --- | --- | --- | --- | --- | --- | --- |
| Expat german/germany c1 active | DE | 21 | (vacio) | Nadia, Timo, Katja, Brandt, Ronja | **5** (Nadia, Timo, Katja, Brandt, Ronja) | 0 |
| Expat german/germany c1 draft | DE | 21 | Nora | Nora, Ole, Wiebke, Merle, Carstens, Fiete | **5** (Ole, Wiebke, Merle, Carstens, Fiete) | 0 |
| Friends german/germany a0 active | DE | 21 | Anna, Jan, Johanna, Luisa, Felix, Nele, Tim | Anna, Jan, Johanna, Nele, Tim | **0**  | 0 |
| Friends german/germany a1 active | DE | 21 | Julia, Moritz | Julia, Moritz, Svenja, Florian, Theresa, Philipp | **4** (Svenja, Florian, Theresa, Philipp) | 0 |
| Friends german/germany a2 active | DE | 21 | Britta, Malte, Ingo, Kerstin, Torben, Lars | Britta, Malte, Lars, Ingo, Kerstin, Torben | **0**  | 0 |
| Friends german/germany b1 draft | DE | 21 | Tobias, Bastian | Lena, Bastian, Miriam, Tobias, Verena | **3** (Lena, Miriam, Verena) | 0 |
| Friends german/germany c1 active | DE | 21 | Steffi, Jule, Frauke | Nadia, Timo, Micha, Jule, Hauke, Steffi | **4** (Nadia, Timo, Micha, Hauke) | 0 |
| Traveler german/germany a0 draft | DE | 21 | Hannah, Elias, Sophie, Leon, Katrin | Hannah, Elias, Emilia, Sophie, Leon, Katrin, Noah | **2** (Emilia, Noah) | 0 |
| Traveler german/germany a1 draft | DE | 21 | (vacio) | Anja, Kai, Lena, Jonas, Tobias, Hanna, Lukas, Sofie, Max, Ben, Clara, Mia, Finn, Greta, Bernd | **15** (Anja, Kai, Lena, Jonas, Tobias, Hanna, Lukas, Sofie, Max, Ben, Clara, Mia, Finn, Greta, Bernd) | 0 |
| Conversations spanish/latam a0 draft | ES | 21 | (vacio) | Mariana, Nicolás | **2** (Mariana, Nicolás) | 0 |
| Cultural spanish/latam a0 draft | ES | 21 | Alondra, Ulises, Daniela, Efraín, Rosa, Mayra, Perla, Saúl, Yesenia, Flor | Alondra, Ulises, Camila, Daniela, Mateo, Perla, Efraín, Rosa, Saúl, Yesenia, Flor, Mayra | **2** (Camila, Mateo) | 0 |
| Friends spanish/argentina a1 draft | ES | 21 | Julieta, Damián, Emanuel, Facundo | Julieta, Damián, Emanuel | **0**  | 0 |
| Friends spanish/argentina c1 draft | ES | 21 | Juli, Ciro | Juli, Julieta, Ramiro, Cami, Seba, Sole, Bauti, Rocío, Ariel | **8** (Julieta, Ramiro, Cami, Seba, Sole, Bauti, Rocío, Ariel) | 0 |
| Friends spanish/chile a1 draft | ES | 21 | Paulina, Matías, Claudio, Marcelo, Francisca, Macarena | Paulina, Matías, Claudio, Marcelo, Francisca, Macarena | **0**  | 0 |
| Friends spanish/colombia a0 draft | ES | 21 | Andrés, Mariana, Sofi | Mariana, Andrés, Lina, Camilo, Sofi | **2** (Lina, Camilo) | 0 |
| Friends spanish/colombia c1 active | ES | 21 | Manu, Ronny, Nubia, Deivis | Manu, Manuela, Yina, Ronny, Camilo, Nubia, Andrés | **4** (Manuela, Yina, Camilo, Andrés) | 0 |
| Friends spanish/latam a1 draft | ES | 21 | Natalia, Adriana, Gustavo, Patricia, Carolina, Eduardo | Adriana, Natalia, Gustavo, Patricia, Eduardo, Víctor, Carolina, Ricardo | **2** (Víctor, Ricardo) | 0 |
| Friends spanish/latam c1 active | ES | 21 | (vacio) | Nico, Marina, Julián, Sofía, Mateo, Renata, Pablo, Camila, Flor, Benjamín, Javiera, Nayeli, Rodrigo, Itzel, Diego, Pilar, Beto, Andrés, Daniela, Yuly | **20** (Nico, Marina, Julián, Sofía, Mateo, Renata, Pablo, Camila, Flor, Benjamín, Javiera, Nayeli, Rodrigo, Itzel, Diego, Pilar, Beto, Andrés, Daniela, Yuly) | 0 |
| Friends spanish/mexico a0 active | ES | 21 | Karla, Bruno, Mauricio, Arturo, Renata, Valeria, Omar, Fernanda | Karla, Bruno, Mauricio, Arturo, Renata, Valeria | **0**  | 0 |
| Friends spanish/mexico c1 draft | ES | 21 | Regina, Beto, Marisol | Regina, Nayeli, Beto, Chucho | **2** (Nayeli, Chucho) | 0 |
| Friends spanish/spain a1 active | ES | 21 | Ander, Nuria, Iñaki | Lucía, Pau, Ander, Nuria, Marta, Iñaki, Carmen, Vicente | **5** (Lucía, Pau, Marta, Carmen, Vicente) | 0 |
| Friends spanish/spain a2 active | ES | 21 | Rubén, Lorena, Raúl, Olga, Silvia | Lorena, Rubén, Lore, Raúl, Jaime | **2** (Lore, Jaime) | 0 |
| Friends spanish/spain b1 draft | ES | 18 | Martín, Elena, Lucía, Marta | Elena, Martín, Lucía, Rosa, Marta | **1** (Rosa) | 0 |
| Traveler spanish/latam a0 active | ES | 21 | Marta, Julio, Pablo | Camilo, Ana, Lucía, Mateo, Pablo, Marta, Valentina, Elena, Julio | **6** (Camilo, Ana, Lucía, Mateo, Valentina, Elena) | 0 |
| Traveler spanish/latam a1 active | ES | 21 | Pablo, Jorge, Alveiro, Camilo, Mateo, Rosa, Elena, Julio, Ana, Lucía, Sofía | Pablo, Lucía, Jorge, Camilo, Alveiro, Mateo, Rosa, Marta, Lucas, Elena, Julio, Ana | **2** (Marta, Lucas) | 0 |
| Traveler spanish/latam a2 active | ES | 21 | Leandro, Liliana, Salvador, Zoila, Amparo, Yolanda, Ernesto, Percy, Araceli | Percy, Karina, Marisol, Leandro, Liliana, Fabián, Gabriela, Salvador, Cecilia, Zoila, Amparo, Yolanda, Ernesto, Araceli | **5** (Karina, Marisol, Fabián, Gabriela, Cecilia) | 0 |
| Traveler spanish/latam b1 active | ES | 21 | Rocío, Esteban, Ximena, Teresa, Nicanor, Delia, Hugo, Adrián, Damián | Rocío, Esteban, Ximena, Óscar, Teresa, Wilson, Nicanor, Delia, Hugo, Brenda, Adrián, Silvana, Valentina, Damián | **5** (Óscar, Wilson, Brenda, Silvana, Valentina) | 0 |
| Traveler spanish/latam b2 active | ES | 21 | Ariel, Griselda, Jairo, Yamileth, Joaquín, Aurelio, Maricarmen, Norma, Marcela, Ignacio, Ofelia, Emiliano, Baldomero | Griselda, Ariel, Jairo, Yamileth, Renata, Joaquín, Maricarmen, Aurelio, Emiliano, Norma, Marcela, Ignacio, Baldomero, Ofelia | **1** (Renata) | 0 |
| Traveler spanish/mexico a1 active | ES | 21 | (vacio) | Sofía | **1** (Sofía) | 0 |
| Traveler spanish/spain a1 active | ES | 21 | Irene, Rocío, Quique, Rosa, Marta | Irene, Rocío, Quique, Rosa, Marta | **0**  | 0 |
| Traveler spanish/spain a2 active | ES | 21 | Irene, Rocío, Rosa, Quique, Álvaro, Marta | Irene, Rocío, Quique, Rosa, Álvaro, Marta | **0**  | 0 |
| Traveler spanish/spain b1 active | ES | 21 | Celia, Emilio, Sole | Celia, Emilio, Rosa, Sole | **1** (Rosa) | 0 |
| Traveler spanish/spain b2 active | ES | 21 | Claudia, Marcos, Martina, Hugo, Pablo | Claudia, Marcos, Martina, Carla, Hugo, Pablo | **1** (Carla) | 0 |
| Expat french/france a1 draft | FR | 21 | Manon, Sylvie, Juliette, Camille, Pauline | Manon, Sylvie, Juliette, Camille, Pauline, Baptiste | **1** (Baptiste) | 0 |
| Friends french/france a0 active | FR | 21 | Hugo, Léa, Antoine | Hugo, Léa, Clara | **1** (Clara) | 0 |
| Friends french/france a1 active | FR | 21 | Amélie, Marc, Camille, Sophie, Mathieu, Olivier | Amélie, Marc, Baptiste, Camille, Mathieu, Olivier, Sophie | **1** (Baptiste) | 0 |
| Friends french/france a2 active | FR | 21 | Romain, Justine, Karim, Nathalie, Anaïs, Mathilde | Romain, Justine, Karim, Élise, Nathalie, Anaïs, Mathilde | **1** (Élise) | 0 |
| Friends french/france b1 active | FR | 21 | Aurélien, Élodie, Guillaume, Marion, Yasmine, Charlotte, Quentin | Aurélien, Élodie, Guillaume, Marion, Yasmine, Charlotte, Florian | **1** (Florian) | 0 |
| Friends italian/italy a0 active | IT | 21 | Matteo, Alice, Lorenzo, Riccardo, Francesca, Valentina | Alice, Matteo, Lorenzo, Francesca, Riccardo | **0**  | 0 |
| Friends italian/italy a1 draft | IT | 21 | Davide, Elisa, Serena, Tommaso, Nicola | Davide, Elisa, Arianna, Serena, Tommaso, Gabriele | **2** (Arianna, Gabriele) | 0 |
| Traveler italian/italy a1 active | IT | 21 | Teo, Dario | Marta, Teo, Irene, Nico, Dario, Gaia, Rosa | **5** (Marta, Irene, Nico, Gaia, Rosa) | 0 |
| Traveler italian/italy a2 draft | IT | 21 | Rosa, Teo, Nico, Martina, Dario, Chiara | Rosa, Teo, Nico, Martina, Marco, Chiara, Dario | **1** (Marco) | 0 |
| Friends portuguese/brazil a1 draft | PT | 21 | Juliana, Letícia, Leonardo, Carolina, Natália, Isabela, Gustavo | Juliana, Letícia, Leonardo, Carolina, Amanda, Natália, Isabela | **1** (Amanda) | 0 |
| Traveler portuguese/brazil a0 draft | PT | 21 | Larissa, Cláudia, Mariana, Camila, Diego, Gabriel, Bruna | Larissa, Caio, Cláudia, Mariana, Camila, Diego | **1** (Caio) | 0 |
| Traveler portuguese/brazil a1 active | PT | 21 | Nara | Tiago, Bia, Lia, Nara, Vitor, Dani, Caio | **6** (Tiago, Bia, Lia, Vitor, Dani, Caio) | 0 |
| Traveler portuguese/brazil a2 active | PT | 21 | Rafaela, Larissa, Selma | Rafaela, Matheus | **1** (Matheus) | 0 |
| Traveler portuguese/brazil b1 active | PT | 21 | Renata, Edilson, Damião, Nilza | Renata, Neuza, Edilson, Damião, Wilson, Nilza, Gilson | **3** (Neuza, Wilson, Gilson) | 0 |
| Traveler portuguese/brazil b2 draft | PT | 21 | Rafaela, Cristiane, Matheus | Rafaela, Wagner, Jussara, Ivo, Rosane | **4** (Wagner, Jussara, Ivo, Rosane) | 0 |

(Sin columna "sobran" con valores: es 0 en los 48.)

## 7. Estado

verified:
- `castOf` medido VERBATIM (copia literal de las lineas 113-216, `diff` limpio)
  contra los 48 journeys live+draft con texto, leyendo de la base de produccion.
- 335 personajes reales frente a 196 detectados: 139 perdidos, 0 inventados.
- Reparto de causas reproducible con `npx tsx scripts/_castProbe.ts`.
- Efecto en los cinco gates simulado con la logica copiada de las lineas
  630-643 y 1276-1394, con reparto detectado y real:
  `npx tsx scripts/_castGates.ts`.
- Contraste con `dialogueSpec.speaker` en los 12 journeys que lo tienen.

not verified:
- El reparto "real" es un proxy: nombre de persona presente en 3 historias o
  mas, curado a mano. Los personajes de una o dos historias quedan fuera por
  construccion, asi que `one-new-per-topic` esta medido POR LO BAJO.
- La curacion de `scripts/_castNames.json` la hice yo leyendo los candidatos;
  nadie mas la ha revisado. En aleman es donde mas puede fallar, porque todos
  los sustantivos van en mayuscula.
- Los tres journeys de 1 historia (arabe, coreano, polaco) no se han medido.
- No he comprobado que journeys estan hoy en verde en la validacion real: la
  simulacion compara castOf contra reparto real, no contra el historial de
  `saveStory.ts`.
- No he tocado `castOf`. Nada de lo de aqui es un arreglo propuesto ni probado.
