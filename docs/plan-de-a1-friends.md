# Plan: Friends DE A1 (Frankfurt am Main)

Estado: APROBADO por el usuario el 2026-09-14 (via Journey-planning). Journey creado: `cmu0dqr6y0007j8o52i1s3gf7` (draft).
Fecha: 2026-09-14. Chat ejecutor: DE_Germany_A1_Friends_1-Texto.

## 0. Estado comprobado antes de planear

| Comprobacion | Resultado |
|---|---|
| `journeysTable.ts`: Friends german A0 | draft, `cmu047bkz0007326jsgeptkox`, 21/21 escritas (cuadra) |
| `journeysTable.ts`: Friends german C1 | live, `cmroo4w4v0000324ow1o9qlcp` (cuadra) |
| `journeysTable.ts`: Friends german A1 | no existe (cuadra) |
| `FUERA_DE_ESCALERA` en `src/lib/journeyLadder.ts` | **existe en la rama `claude/magical-jepsen-807ad1`, NO en `main`** (ver abajo) |
| `assertLadderContiguous` para un Friends DE A1 (en seco) | pasa |
| Corpus de motivaciones `German` | 4 solicitudes, 2 frases escritas, 2 clics descartados |
| `assertTopicsGrounded` con los 7 temas de este plan (modo journey-level, en seco) | pasa; los 7 slugs y labels estan libres |

**Discrepancia de codigo (no de base).** Todo el trabajo del A0 (el commit de
`FUERA_DE_ESCALERA`, sus registros en `tema-cierres.json`, el arreglo de
`journey-vocab-worth-teaching`) vive en `claude/magical-jepsen-807ad1`, 19
commits por delante de `main` y sin integrar. Desde `main` el porton de escalera
tiraria por el C1 de test, y `cierraTema` no tendria los cierres del A0. Este
plan se escribe en un worktree propio (`claude/de-a1-friends`) que sale de esa
rama. La fase 2 tiene que correr desde ahi (o desde `main` cuando esa rama
aterrice); si no, se para.

Comprobaciones de solo lectura usadas: `scripts/_deA1Friends/dump.ts`,
`ground.ts`, `cand.ts`, `lvl.ts`.

## 1. Forma

| Campo | Valor |
|---|---|
| Tipo | Friends (`typeSlug` relationships), german / germany, a1, 1x7x3 |
| Estilo | narrador, una voz, habla citada dentro de la prosa en banda 25-32% (el FR A1 Friends live esta en 27,9) |
| Largo | 128-155 palabras por cuerpo (banda A1 del spec, un minuto) |
| Parrafos | 4, 5 o 6, variando entre las tres historias de cada tema (se fija en el esqueleto) |
| Lugar | Frankfurt am Main: un edificio de pisos en Bornheim (el rellano de Julia y Moritz), la orilla del Main y el mercadillo del Museumsufer |
| Personajes fijos | 2 (Julia y Moritz) |
| Nuevos | 1 por tema desde el tema 2, presentado en la primera historia del tema; el tema 1 solo lleva fijos |
| Hablan por historia | 2, como mucho 3; toda replica con acotacion o linea de narrador justo antes |
| Cierre de tema | la historia 3 de cada tema cierra su arco; ningun mini-cliffhanger en el ultimo slot |

**Por que Frankfurt.** Ningun journey aleman live o draft la usa (medido sobre
el texto de los seis: Berlin, Hamburgo, Colonia, Munich, Stuttgart, Dortmund,
Leipzig, Essen, Bremen, Kiel, Dresden, Heidelberg, Nuremberg, Friburgo,
Constanza y los pueblos del Traveler A0). Un anglosajon la situa sin ayuda, y
`der Main` le da un rio reconocible sin micro-barrios: Bornheim sale como
direccion, nunca como ancla de titulo.

## 2. Banda A1 (se aplica frase a frase)

El validador no tiene sonda de gramatica para aleman, asi que la medida es
floja y la vara es externa: Goethe-Zertifikat A1 / Profile Deutsch, con i+2 en
el lexico del cuerpo.

- **Nuevo respecto al A0**: Perfekt con `haben` y `sein` en verbos frecuentes
  (2 a 5 usos por historia, es lo que la hace A1 y no A0); verbos modales
  (`können`, `müssen`, `wollen`, `möchten`, `dürfen`); verbos separables, tambien
  partidos (`Sie ruft ihn an.`); pronombres de objeto en acusativo y dativo
  (`mich`, `dich`, `ihn`, `ihr`, `ihm`); inversion V2 tras un adverbio
  (`Am Sonntag läuft sie.`); `denn`, `aber`, `oder`.
- **Dosificado**: como mucho una subordinada con `weil` o `dass` por historia
  (verbo al final, A2 en el perfil; entra por i+2).
- **Prohibido en A1**: Präteritum salvo `war` y `hatte`; Plusquamperfekt; pasiva;
  oraciones de relativo; Konjunktiv II salvo `möchte` y `könnte` de cortesia;
  `zu`-infinitivos; dialecto hessiano y argot (Friends en nivel A no lleva
  jerga).
- Mediana de 7-8 palabras por oracion, techo de densidad 11 (`cierraTema`).
- Emocion en tres piezas (sensacion, motivo, gesto) con el gesto visible.
- Recursos de A1 (spec 3ter): causalidad explicita (`denn`), humor de
  situacion, gancho final literal. Nada figurado.

## 3. Reparto (propio; ningun nombre sale en otro journey aleman live o draft)

Nombres comprobados contra el texto completo de los seis journeys alemanes
(ninguno aparece) y contra los nombres de pila de las solicitudes de la beta
(ninguno coincide). Ninguno esta en el banco `german/germany` (sus diez nombres
jovenes ya los usan los Traveler), asi que todos daran el aviso
`character-names-unverified`; son nombres frecuentes entre nacidos en Alemania
entre 1986 y 1997. Todos adultos en activo, 29-38 anos. Nadie hereda nada del A0:
la continuidad con el A0 es solo de vocabulario.

| Nombre | Rol | Edad | Ficha fija (repetida en cada escena) | Presentacion (que ES) | Forma |
|---|---|---|---|---|---|
| **Julia** | protagonista, en las 21 | 31 | pelo castano claro largo en coleta, sin flequillo; chubasquero amarillo; fisioterapeuta recien llegada de Rostock | "eine Physiotherapeutin aus Rostock" | aposicion |
| **Moritz** | fijo, en la mitad o mas | 34 | pelo negro rizado corto, barba de tres dias; sudadera verde botella; conductor de tranvia, vive enfrente en el mismo rellano, de Frankfurt de siempre | "Moritz ist Straßenbahnfahrer" | `ist` en frase propia |
| Svenja | nueva, tema 2 | 29 | pelo rubio platino muy corto, sin flequillo; chaqueta de correr naranja; policia, lleva el grupo de correr del domingo en el Main | "Svenja, eine Polizistin, ..." | aposicion |
| Florian | nuevo, tema 3 | 36 | pelo pelirrojo corto, barba pelirroja; gorra azul marino; electricista, corre con Svenja y tiene un perro grande marron | "ein Elektriker aus dem Lauftreff" | descriptor tras el lugar |
| Theresa | nueva, tema 4 | 33 | pelo castano oscuro en mono, flequillo recto; chaqueta de punto mostaza; costurera con puesto en el mercadillo del Museumsufer | "Theresa ist Schneiderin" | `ist` en frase propia |
| Philipp | nuevo, tema 5 | 35 | pelo rubio corto rapado a los lados; camisa de cuadros azul; conductor de tranvia, companero y amigo de Moritz desde hace diez anos | "ein Kollege von Moritz" | descriptor |
| Miriam | nueva, tema 6 | 38 | pelo negro largo y liso con raya al medio; polo azul claro de la consulta; fisioterapeuta, dirige la consulta donde trabaja Julia | "Miriam, die Chefin der Praxis, ..." | aposicion |
| Carolin | nueva, tema 7 | 32 | pelo cobrizo por la barbilla, sin flequillo; abrigo gris; comadrona, hermana de Moritz | "Carolin ist Moritz' Schwester" | `ist` en frase propia |

Formas de presentacion: aposicion 3, `ist` 3, descriptor 2 (ninguna pasa de la
mitad del reparto). Personajes solo mencionados y sin nombre: "ihre beste
Freundin in Rostock" y "der Hund" (el perro de Florian no lleva nombre propio
para que no cuente como personaje en los gates de reparto).

## 4. Espina

Julia, fisioterapeuta de Rostock, lleva dos semanas en Frankfurt por un trabajo
nuevo y no conoce a nadie. Cada noche manda notas de voz al chat de sus amigas de
Rostock, y las respuestas llegan cada vez mas cortas. Enfrente, en el mismo
rellano, vive Moritz. La pregunta del journey: **se puede hacer amigos de verdad
a los treinta en una ciudad donde no conoces a nadie, y que hay que soltar de la
vida de antes para eso?** Cada tema le cuesta un hilo con Rostock. En el tema 7
tiene su primera pelea con un amigo de Frankfurt y hacen las paces: se pelea y
vuelve quien ya es amigo, y ese es el cierre, sin decision de mudanza.

Diferencia con la espina del A0 (Anna vuelve a un grupo que siguio sin ella):
aqui no hay grupo al que volver, se construye desde cero; el coste no es la vida
de Munich que se deja, sino los lazos a distancia que se enfrian; y el final no
es "elige quedarse" sino "una amistad aguanta una pelea".

Sale de las frases del corpus: "I made a lot of German friends" (hacer amigos
alemanes de adulta), "Now I would like to reconnect with my friends" (los amigos
a distancia, el chat de Rostock) y "to be able to read and possibly correspond
in German" (mensajes, notas de voz, llamadas: el tema 1 y el hilo del chat en
todo el journey).

## 5. Los siete temas

Nombres al nivel de DOMINIO (`project_topic_naming_rule`): cada uno nombra un
campo lexico amplio, ninguno nombra objetos sueltos. Ingles, ampersand, 2-4
palabras, sin pais, slugs nuevos derivados del nombre, `isUniversal: false`.
Ninguno coincide con las 42 etiquetas alemanas existentes (A0 incluido) ni con
las 309 etiquetas globales de `Topic`.

| # | Tema (slug) | Nuevo | Arco del tema en una linea | Coste no devuelto |
|---|---|---|---|---|
| 1 | Chats & Phone Calls (`chats-and-phone-calls`) | - | Julia graba notas de voz en el rellano para Rostock y Moritz lo oye todo a traves de la pared; le da su numero, ella se pierde su primer mensaje por una videollamada con Rostock; al final lo llama en vez de escribir y quedan para correr el domingo | el "alles super" que contaba a Rostock se rompe delante de Moritz; silencia por primera vez el chat de Rostock |
| 2 | Running & Fitness (`running-and-fitness`) | Svenja | Julia va al grupo de correr de Svenja en el Main y sale demasiado rapido para impresionar; agujetas y orgullo; en la carrera larga se queda atras con Moritz en vez de ganar | su mejor marca, y la llamada del domingo con Rostock, que ya no cabe en la manana |
| 3 | Pets & Animal Care (`pets-and-animal-care`) | Florian | Florian tiene que viajar y le pide a Julia que cuide a su perro un fin de semana; a ella le dan miedo los perros grandes; el perro se escapa en el parque y lo encuentran | cancela su primer viaje a Rostock y pierde el billete de tren |
| 4 | Clothes & Style (`clothes-and-style`) | Theresa | Svenja se casa y Julia no tiene nada que ponerse (sus cajas siguen en Rostock); Theresa le arregla un vestido del mercadillo; una mancha antes de la boda | cambia su vieja chaqueta de Rostock por el vestido y la chaqueta no vuelve |
| 5 | Birthdays & Surprises (`birthdays-and-surprises`) | Philipp | Julia organiza con Philipp la fiesta sorpresa del cumpleanos de Moritz; casi se descubre; la sorpresa sale, a medias y bien | ese mismo sabado es el cumpleanos de su mejor amiga de Rostock y no llama; la amiga se ofende |
| 6 | Moods & Feelings (`moods-and-feelings`) | Miriam | La amiga ofendida no contesta; Julia trabaja de mal humor y llora en la consulta; Miriam, su jefa, lo nota y le habla claro; Julia manda una nota de voz sincera a Moritz diciendo que quiere volver a Rostock | la imagen profesional delante de su jefa; admite en voz alta que tiene morrina |
| 7 | Quarrels & Making Up (`quarrels-and-making-up`) | Carolin | Moritz, preocupado, cuenta la morrina de Julia al grupo de correr; ella se enfada, discuten y cancela el domingo con una excusa; Carolin, la hermana de Moritz, le cuenta por que lo hizo; se piden perdon los dos en el rellano | su secreto: el grupo ya sabe que lo pasa mal, y ella acepta que la conozcan; cierre sin gancho: dos tazas en el rellano, entre las dos puertas abiertas |

La espina avanza por el coste, no por el suspense: ningun tema deja nada
pendiente para el siguiente salvo el estado de animo de Julia.

Evidencia (modo journey-level, salida de `assertTopicsGrounded` en seco):

```
MODO JOURNEY-LEVEL · 2 persona(s) detras de todo el journey
  <- Now I would like to reconnect with my friends
  <- I made a lot of German friends
  <- to be able to read and possibly correspond in German
```

## 6. Vocabulario

### Forma

- 20 plazas por historia: unas 14 portables y 6 ancladas
  (`project_vocab_recirculation_ladder`), ninguna palabra en mas de 2 historias
  como plaza.
- **Solape** (corregido el 2026-09-14, aprobado via Journey-planning): lo
  ANCLADO (sustantivos) va a cero contra los seis journeys alemanes; la capa
  PORTABLE (verbo, adjetivo, adverbio) se reabre, tambien la del Friends A0
  (`project_vocab_portable_layer_between_levels`, la regla que ya aplica
  `saveStory`); nada se repite dentro de este journey. La version anterior de
  esta linea pedia cero tambien en portables, y con plazas de una sola palabra
  y la lista A1/A2 no cabia (855 lemas libres frente a 1.147).
- **Techo de nivel**: el A1 si pasa por `vocab-level-frequency` (el A0 no), con la
  lista `germanA1A2.ts`: 0 fuera de lista pasa, 1-2 avisa, 3 o mas falla. Cada
  historia planifica como mucho 2 plazas fuera de lista.
- Nunca cognados transparentes (Party, Sport, Chat, Training y Emoji quedan fuera
  de plaza por eso, aunque salgan en el cuerpo) ni universales.
- Recirculacion interna A1: toda portable entra como muy tarde en la historia 15
  y reaparece en el TEXTO de 2 o 3 historias posteriores (media A1 >= 1,6, cola
  <= 70%).

### Campo anclado por tema

Comprobado contra las 2.100 superficies de vocab de los seis journeys alemanes
live+draft y contra la lista A1/A2 el 2026-09-14. `*` = fuera de la lista A1/A2
(cuenta para el tope de 2).

| # | Libres (candidatas a plaza) | Ya ensenadas en otro journey (van en el texto, nunca en plaza) |
|---|---|---|
| 1 | die Sprachnachricht, der Videoanruf, der Klingelton, zurückrufen, besetzt, laden, das Passwort, verpassen, kennenlernen, peinlich, stumm* | das Handy, der Anruf, der Akku, die Gruppe, die Nachricht, die Nummer, schreiben, einladen |
| 2 | die Strecke, die Turnschuhe, die Stoppuhr, die Wasserflasche, duschen, die Brücke, aufhören, anfangen, weiterlaufen, der Muskelkater*, der Kilometer* | der Verein, das Ufer, die Pause, das Ziel, überholen, schaffen, laufen, schnell |
| 3 | die Katze, der Tierarzt, das Hundebett, die Hundedecke, die Hundeschule, das Pferd, der Park, weglaufen, aufpassen, die Leine*, bellen* | der Hund, das Tier, die Wiese, die Angst, werfen, füttern |
| 4 | das Kleid, die Hose, der Rock, die Bluse, der Anzug, die Krawatte, die Handschuhe, der Kleiderschrank, der Flohmarkt, anziehen, ausziehen, waschen, die Hochzeit, der Stoff*, nähen* | die Jacke, der Pullover, der Mantel, das Hemd, der Schal, die Farbe, der Spiegel, die Nadel |
| 5 | feiern, der Gutschein, einpacken, das Geschenkpapier, der Sekt, der Apfelwein (ancla cultural de Frankfurt), verstecken, ausmachen, die Überraschung*, gratulieren* | das Geschenk, der Geburtstag, der Kuchen, die Kerze, die Einladung, die Kneipe, das Licht |
| 6 | wütend, stressig, das Gefühl, sich freuen, die Wahrheit, das Heimweh*, die Laune*, das Taschentuch*, der Patient* | glücklich, traurig, sauer, nervös, weinen, ehrlich, das Problem, der Termin |
| 7 | der Streit, sich vertragen, die Lüge, die Wahrheit (si no la gasta el 6), sich entschuldigen*, streiten*, zuhören*, die Ausrede*, absagen* | der Fehler, die Entschuldigung, ehrlich, versprechen, verzeihen, enttäuscht, die Schwester |

**Los dos temas justos.** Pets & Animal Care y Quarrels & Making Up son los que
menos plazas libres y dentro de lista tienen. En el 3 el hueco se cubre con
compuestos de cabeza A1 (`Hundebett`, `Hundedecke`) y con portables; en el 7 el
campo es sobre todo de verbos que la lista no trae (`streiten`, `zuhören`,
`absagen`, `sich entschuldigen`), aunque son Goethe A1/A2. Si al escribir el tema
7 no cabe en 2 fuera de lista por historia, se reporta como hueco de la lista y
se decide ahi; la lista no se toca sin el visto bueno del usuario.

### Escalera desde el A0 (recirculacion en el TEXTO, cero plazas)

El alumno que termina el A0 ya conoce estas palabras. En el A1 vuelven en la
prosa, sin glosa de plaza, para que el primer tema no le suene a idioma nuevo.
Todas son plazas del Friends A0 medidas hoy; se reparten por tema segun encajan.

| Tema A1 | Palabras del A0 que reaparecen en el cuerpo |
|---|---|
| 1 Chats & Phone Calls | antworten, telefonieren, klingeln, das Telefon, die Nummer, laut, leise, fragen, warten, kennen, wohnen, die Tür, die Treppe |
| 2 Running & Fitness | laufen, rennen, schnell, langsam, atmen, das Knie, müde, trinken, das Wasser, gewinnen, verlieren, die Uhr, fast |
| 3 Pets & Animal Care | suchen, finden, rufen, holen, springen, vorsichtig, ruhig, nass, der Boden, der Hof, niemand, endlich, der Schrank |
| 4 Clothes & Style | die Jacke, der Pullover, der Ärmel, der Schuh, rot, gelb, blau, grün, grau, eng, kaputt, der Fleck, kaufen, billig, passen |
| 5 Birthdays & Surprises | der Geburtstag, das Lied, singen, klatschen, der Wein, prost, die Liste, der Kuli, der Freitag, spät, still, plötzlich, flüstern |
| 6 Moods & Feelings | traurig, weinen, lachen, nervös, froh, stolz, schämen, allein, fehlen, das Herz, der Magen, die Sorge, seufzen |
| 7 Quarrels & Making Up | leid ("es tut mir leid"), böse, vergessen, der Grund, sicher, zusammen, umarmen, nicken, schütteln, beste, zufrieden, der Satz |

Condicion: un sustantivo de la escalera nunca ocupa plaza en el A1; las portables de la escalera pueden reabrirse como plaza.

## 7. Proceso por tema (fase 2, tras aprobacion)

Paso previo, una vez: crear la fila del journey (draft) y los 7 temas con un
`scripts/_scaffoldFriendsDEa1.ts` calcado del A0, que llama a
`assertLadderContiguous`, `assertTopicsGrounded` (modo journey-level) y
`assertJourneyType`, con `--dry` primero. Si el porton de escalera se queja, se
para y se reporta.

Por tema, seguidos del 1 al 7:

1. `rulesFor.ts story vocab journey` y `journeysTable.ts --journey <id>`.
2. Plan del tema en JSON (registro, espina, recursos y
   quiere/impide/cuesta/cambia/emocion por historia), con parrafos 4-6 variados.
3. Esqueleto con el golpe emocional, luego prosa; las tres en un unico JSON.
4. `saveStory.ts <data.json> --journey <id> --lang DE --level a1 --variant germany --narrator --dry`; un fallo se arregla en la historia, nunca en el gate.
5. Guardado sin `--dry`, en draft.
6. `cierraTema.ts <id> <tema> --plan <plan.json>`.
7. Fila de `journeysTable.ts`, avisos del cierre, y reporte a Journey-planning con `verified:` / `not verified:`.

Al final: lectura seguida de las 21 buscando plantillas en 3 o mas historias,
`_acotacion.ts` (liston 97-100%) e informe de conjunto.

Fuera de este encargo: audio, portadas, glosas, practica, push y correos.

## 8. Decisiones para el usuario

1. Los siete temas y su orden.
2. Frankfurt y los tres lugares (rellano de Bornheim, orilla del Main, mercadillo del Museumsufer).
3. Julia y Moritz como fijos, y la espina "hacer amigos desde cero y lo que cuesta a Rostock".
