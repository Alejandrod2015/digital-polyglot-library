# Plan: Friends IT A0 (Genova)

Estado: APROBADO por el usuario el 2026-09-14 (via Journey-planning) con un cambio: Matteo no es cocinero (Jan, del Friends DE A0, ya lo es y los dos journeys pasan en un edificio antiguo). Ahora es marinero de los ferris a Cerdeña; el tema Cooking & Recipes se queda.
Fecha: 2026-09-14. Chat ejecutor: IT_Italy_A0_Friends_1-Texto.

## 0. Estado comprobado antes de planear

| Comprobacion | Resultado |
|---|---|
| Friends IT A0 de julio (`cmrsiz1n40000320d6h8p8f5g`) | archivado con `setJourneyStatus.ts` (nada borrado); `journeysTable.ts` ya no lo lista en draft |
| Journeys italianos live+draft | Traveler A1 (live, `cmss0fkc40007j8dub1zpa1kc`), Traveler A2 (draft, `cmt5wqsf7000032ghesowd0jy`). No existe Traveler IT A0 |
| Escalera Friends italian/italy | vacia en live+draft: crear A0 no deja hueco |
| Corpus de motivaciones `Italian` | 4 solicitudes, 4 applicationReason, 4 clics descartados |
| `assertTopicsGrounded` (modo journey-level, sin escribir) | pasa, 2 personas detras; ninguna etiqueta choca con la tabla `Topic` |

## 1. Forma

| Campo | Valor |
|---|---|
| Tipo | Friends (`typeSlug` relationships), italian / italy, a0, 1x7x3 |
| Estilo | narrador, una voz, citas cortas dentro de la prosa, banda 25-35% de palabras citadas |
| Largo | 135-150 palabras por cuerpo (~1 minuto de audio), 4-6 parrafos variando dentro de cada tema |
| Lugar unico | un palazzo viejo del centro storico de Genova: la terraza del tejado, la escalera, el piso de Alice (arriba) y el de Matteo (segundo) |
| Fijos | 2: Alice (protagonista, en las 21) y Matteo (en mas de la mitad; valen menciones) |
| Nuevos | 1 por tema desde el tema 2, presentado en la primera historia del tema; su nombre NO sale fuera de su tema (el check cuenta como fijo a quien aparece en 2 temas) |
| Hablan por historia | maximo 2, y el narrador ancla cada cambio de voz |

Por que Genova: ninguna historia italiana live, draft ni del journey de julio la usa (julio: Roma, Firenze, Venezia, Milano, Napoli, Bologna, Palermo; Traveler A1/A2: Roma, Napoli, Firenze, Bologna, Catania, Palermo, Torino, Verona, Padova, Messina). El lector anglosajon la reconoce (Genoa) y da anclas propias: focaccia, pesto, el derby Genoa-Sampdoria, las alertas de lluvia.

## 2. Suelo A0 (frase a frase, ademas del gate `journey-a0-floor`)

- Solo presente de indicativo: ni passato prossimo, ni imperfetto, ni futuro, ni condizionale, ni congiuntivo. El pasado que la espina necesita se dice en presente ("Alice e Matteo sono amici dall'università").
- Una idea por oracion; objetivo mediana ~6 palabras, techo 9 (referencia aprobada: la demo del jambu).
- Sujeto explicito cuando cambia quien hace la accion (el italiano lo omite y el oyente A0 se pierde).
- Sin clitico doble (glielo, me lo), sin `ne`, sin `stare` + gerundio. `c'è` / `ci sono` si: son nucleo A0 en italiano.
- Nada de argot ni dialecto genoves; `belin` y similares fuera.
- Frases hechas de A0 permitidas: "Ti voglio bene", "Tanti auguri", "Non importa".
- Emocion en tres piezas (sensacion, motivo, gesto); ultima linea en imagen concreta, nunca maxima.
- Prohibido: apertura dia + hora + lugar, el recurso "Pensa: ..." / "Si chiede: ..." repetido entre historias, niños, adolescentes y ancianos (tampoco "la nonna" mencionada).

## 3. Reparto (propio)

Ningun nombre aparece en el Friends de julio ni en los Traveler italianos (A1, A2 ni el test archivado): comprobado sobre los textos completos. Matteo es del banco `italian/italy`; los demas estan fuera del banco (sus 8 jovenes ya se usaron o se evitan), asi que daran el aviso `character-names-unverified`. Todos son nombres frecuentes entre nacidos en Italia en 1988-1996.

| Nombre | Rol | Edad | Ficha fija (se repite en cada escena) | Presentacion (que ES) | Tema |
|---|---|---|---|---|---|
| **Alice** | protagonista, en las 21 | 34 | pelo castaño oscuro a la altura de la mandibula, con flequillo; cardigan amarillo mostaza | "un'infermiera di Genova" | todos |
| **Matteo** | fijo; marinero en los ferris Genova-Cerdeña, fuera algunos dias, en casa los domingos | 35 | pelo negro rizado corto, barba corta; camiseta azul marino | "un marinaio di Genova" | todos |
| Francesca | nueva | 33 | pelo rubio largo en coleta, sin flequillo; chaqueta verde | "una biologa dell'Acquario" | 2 |
| Riccardo | nuevo | 36 | cabeza rapada, barba negra; jersey azul claro | "un tassista del terzo piano" | 3 |
| Federica | nueva | 31 | pelo rojo rizado largo, sin flequillo; impermeable naranja | "un'architetta del quarto piano" | 4 |
| Lorenzo | nuevo | 38 | pelo castaño corto, sin barba; delantal blanco sobre camiseta negra | "il fornaio della focacceria sotto casa" | 5 |
| Valentina | nueva | 30 | pelo negro liso largo, sin flequillo; abrigo morado | "una collega di Alice" | 6 |

Tema 7 no estrena a nadie: es de los dos fijos. Las tres formas de presentacion se alternan; ninguna en mas de la mitad del reparto.

## 4. Espina

Alice y Matteo son amigos desde la universidad. Alli, en una servilleta de bar, firmaron un pacto medio en broma: **"Se a 35 anni siamo soli, ci sposiamo."** Matteo cumple 35 en la primera historia y se acuerda del pacto riendo. Para Alice no es una broma, y no lo dice.

La pregunta del journey: **¿se lo dice, y que queda de la amistad si lo dice?** Cada tema es un momento en que la gente del palazzo se junta, y en cada uno el silencio de Alice le cuesta algo. En el tema 7, en su propio cumpleaños, se lo dice. Matteo la quiere, pero no asi. Acaba peor de como empezo y sin gancho: el domingo siguiente hay otra vez dos platos en la terraza, y la servilleta ya no esta en el cajon.

No es un "se va / vuelve": el Friends FR A0 va de Hugo que se muda a Paris y el Friends DE A0 de Anna que vuelve a Bremen. Aqui nadie se mueve; lo que cambia es lo que se dice.

Evidencia (modo journey-level, salida de `assertTopicsGrounded`):

```
MODO JOURNEY-LEVEL · 2 persona(s) detras de todo el journey
  <- I will be going on a solo trip to Italy
  <- understand and speak some basic Italian
  <- as I learn foreign languages
```

Lectura honesta del corpus: solo la frase de Susan es de proposito (viaje sola, entender y hablar italiano basico). La de Irina es generica y esta ahi porque el porton exige dos personas. Lo que la evidencia sostiene de verdad es el SUELO (italiano basico, entender a gente hablando entre si), no los dominios concretos; los temas salen del tipo Relationships (momentos en que un grupo se junta).

## 5. Los siete temas

Nombres de DOMINIO lexico (`project_topic_naming_rule`), ingles, ampersand, 2-4 palabras, sin pais. Ninguno repite los 14 temas del Traveler IT A1 y A2 (Trains & Tickets, Coffee & Bars, Eating Out, Markets & Money, Churches & Squares, Meeting People, Sea & Islands, Roads & Driving, Phones & Signal, Rooms & Keys, Forest & Hiking, Village Festivals, Pharmacy & Emergencies, Bureaucracy & Paperwork) ni los del journey de julio. Slugs nuevos derivados del nombre, `isUniversal: false`.

| # | Tema (slug) | Nuevo | Arco del tema | Coste no devuelto |
|---|---|---|---|---|
| 1 | Birthdays & Wishes (`birthdays-and-wishes`) | - | Alice prepara en la terraza la fiesta sorpresa de los 35 de Matteo; los invitados fallan y quedan los dos con una tarta para doce; Matteo sopla las velas y saca la servilleta del pacto riendo; Alice rie tambien y se la guarda | miente ("È uno scherzo") y desde ahi carga con la mentira |
| 2 | Dating & First Impressions (`dating-and-first-impressions`) | Francesca | Matteo tiene una primera cita y le pide ayuda a Alice: la ropa, el mensaje; Alice escribe el mensaje y funciona; Francesca sube a la terraza y es encantadora; al final le dice a Matteo, amable, que el solo habla de Alice | las palabras de Alice sirven para que Matteo quede con otra; la cita se acaba y Matteo no entiende por que |
| 3 | Football & Rivalries (`football-and-rivalries`) | Riccardo | Derby en la tele de la terraza: Alice y Matteo del Genoa, Riccardo de la Samp; Alice apuesta contra Riccardo la vieja camiseta del Genoa que le regalo Matteo; gana la Samp | la camiseta se va al tercer piso y no vuelve |
| 4 | Weather & Storms (`weather-and-storms`) | Federica | Alerta roja de lluvia; Alice y Matteo suben a salvar las plantas de la terraza; se va la luz y se quedan en la escalera a oscuras con Federica; a oscuras, Alice casi lo dice y Federica enciende una linterna justo antes | la terraza pierde su albahaca y la pergola; la frase de Alice se queda sin decir |
| 5 | Cooking & Recipes (`cooking-and-recipes`) | Lorenzo | Cada domingo Matteo hace el pesto de su familia en la terraza; esta vez vuelve tarde del ferry y Alice quiere hacerselo a el; Lorenzo, el fornaio de abajo, le enseña con el mortero de marmol de Matteo; el pesto sale bien | el mortero se rompe al fregarlo; Matteo dice "Non importa" y a Alice si le importa |
| 6 | Quarrels & Apologies (`quarrels-and-apologies`) | Valentina | Matteo cuenta el pacto como chiste delante de Valentina; Alice se enfada en la escalera y le dice cosas feas; una semana sin domingos en la terraza; Valentina la empuja a pedir perdon y hacen las paces con focaccia | el primer domingo sin terraza en quince años; la amistad queda con una grieta |
| 7 | Secrets & Confessions (`secrets-and-confessions`) | - | Cumpleaños de Alice, 35; en la terraza le enseña a Matteo la servilleta y le dice la verdad; Matteo le dice que la quiere, pero no asi; el domingo siguiente hay dos platos en la terraza | la esperanza de Alice; la servilleta rota en la papelera |

Ningun tema termina en mini-cliffhanger en la historia 3: cada tema cierra su arco dentro de si, y la espina avanza por el coste, no por el suspense.

## 6. Vocabulario

- 20-22 plazas por historia (el tope escala con el largo), ninguna palabra en mas de 2 historias, nunca cognados transparentes (derby, stadio, gol van en el texto, no en plaza) ni universales (ciao, grazie, sì).
- Capa anclada: **cero solape con lo enseñado en los tres journeys italianos, incluido el de julio archivado** (el gate de `saveStory` excluye los archivados, asi que el de julio se comprueba a mano contra su volcado antes de cada guardado). Capa portable (verbo, adjetivo, adverbio, expresion): se reabre segun `project_vocab_portable_layer_between_levels`.
- Ancla cultural siempre en plaza: focaccia, pesto, Genoa/Samp como `tifoso`, `allerta`.

Campo de cada tema cruzado contra las 1.163 superficies de vocab de los tres journeys italianos (2026-09-14):

| # | Libres (candidatas a plaza) | Ya enseñadas en otro journey italiano (van en el texto, nunca en plaza) |
|---|---|---|
| 1 | torta, candeline, auguri, desiderio, regalo, spumante, invitato, soffiare, palloncino | compleanno, candela, festa, brindisi |
| 2 | carino, messaggio, fidanzata, innamorato, geloso, rossetto | appuntamento, simpatico, bacio, profumo, specchio, vestito, nervoso |
| 3 | partita, squadra, tifoso, scommessa, arbitro, maglia, rigore, campionato | sciarpa, vincere, perdere |
| 4 | temporale, fulmine, tuono, allerta, bagnato, tempesta, corrente | pioggia, vento, ombrello, buio, luce, finestra |
| 5 | pesto, basilico, pinoli, mortaio, focaccia, pentola | ricetta, aglio, olio, sale, sapore, assaggiare, cucinare, forno |
| 6 | arrabbiato, scusa, colpa, pace, offeso, piangere, sbattere, perdonare, torto, ragione | litigare, urlare, porta |
| 7 | verità, coraggio, patto, confessare, amore, bugia, sincero | segreto, cuore, promessa, paura, tovagliolo |

## 7. Proceso por tema (fase 2, tras aprobacion)

Paso previo al tema 1: script de creacion que llama a `assertLadderContiguous` y a `assertTopicsGrounded` antes de escribir, crea los 7 temas y el journey en draft con 21 slots.

1. `rulesFor.ts story vocab journey` y `journeysTable.ts --journey <id>`.
2. Plan del tema en JSON (registro, espina, recursos; quiere/impide/cuesta/cambia/emocion por historia) y numero de parrafos (4, 5 o 6) distinto entre las tres.
3. Esqueleto con el golpe emocional, despues prosa; las tres en un unico JSON. Cruce del vocab con el volcado del journey de julio.
4. `saveStory.ts <data.json> --journey <id> --lang IT --level a0 --variant italy --narrator --dry`; un fallo se arregla en la historia, nunca en el gate.
5. Guardado sin `--dry`, en draft.
6. `cierraTema.ts <id> <tema> --plan <plan.json>`.
7. Fila de `journeysTable.ts` y reporte a Journey-planning con `verified:` / `not verified:`.

Al final: lectura seguida de las 21 buscando plantillas repetidas, e informe de conjunto.

Fuera de este encargo: audio, portadas, glosas, practica, push y correos.

## 8. Decisiones para el usuario

1. Genova y el palazzo con terraza como lugar unico.
2. La espina del pacto, con final agridulce (Matteo no siente lo mismo).
3. Los siete temas y su orden.
