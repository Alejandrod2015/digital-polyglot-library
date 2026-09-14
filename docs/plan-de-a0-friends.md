# Plan: Friends DE A0 (Bremen)

Estado: APROBADO por el usuario el 2026-09-13 (via Journey-planning), con Books & Newspapers y Pots & Spoons en lugar de Bikes & Repairs y Buttons & Sewing (vocab anclado de alta frecuencia). Nada escrito en la base.
Fecha: 2026-09-13. Chat ejecutor: DE_Germany_A0_Friends_1-Texto.

## 0. Estado comprobado antes de planear

| Comprobacion | Resultado |
|---|---|
| `journeysTable.ts`: Friends german A0 | no existe (cuadra con el encargo) |
| Journeys alemanes live+draft | Expat C1 (live), Friends C1 (live), Expat C1 Hamburgo (draft), Traveler A1 (draft), Traveler A0 (draft) |
| Corpus de motivaciones `German` | 4 solicitudes, 2 frases escritas, 2 clics descartados |
| `assertTopicsGrounded` (modo journey-level) | pasa, 2 personas detras |

## 1. Forma

| Campo | Valor |
|---|---|
| Tipo | Friends (`typeSlug` relationships), german / germany, a0, 1x7x3 |
| Estilo | narrador, una voz, citas cortas dentro de la prosa (~28% citado, como el Traveler DE A0) |
| Largo | 140-160 palabras por cuerpo (~1 minuto de audio) |
| Punto de vista | entre iguales: el grupo no se explica lo que comparte |
| Lugar unico | una casa vieja (Altbau) del Viertel, Bremen: la cocina de Jan, el patio y la escalera |
| Personajes fijos | 2 (Anna y Jan) |
| Nuevos | 1 por tema desde el tema 2, presentado en la primera historia del tema; el tema 1 solo lleva fijos |
| Hablan por historia | maximo 2 |

Por que Bremen: ninguna historia alemana live o draft la usa (Traveler A0 va por
Dresden, Heidelberg, Triberg, Meersburg, Rügen, Nürnberg y Grainau; Friends C1 y
Expat por Berlin, Hamburgo, Colonia, Munich y Stuttgart). El nombre lo lee un
anglosajon sin ayuda.

## 2. Suelo A0 (se aplica frase a frase, ademas del gate `journey-a0-floor`)

- Sujeto primero, cero inversion V2 fuera de preguntas.
- Sin `es gibt`, sin separables partidos, solo presente, sin Konjunktiv.
- Una idea por oracion; objetivo mediana ~6 palabras, techo 9 (referencia aprobada: la demo del jambu, 6).
- Nada de dialecto ni argot (Friends en A0 no lleva jerga; `Moin` tampoco, es regional).
- El pasado que la espina necesita se dice en presente: "Anna wohnt acht Jahre in München. Jetzt ist sie wieder da."
- Emocion en tres piezas (sensacion, motivo, gesto) con gesto visible; ultima linea en imagen concreta.
- Recursos solo de A0: repeticion ritmica, contraste con `aber`, imagen concreta.

## 3. Reparto (propio; ningun nombre sale en otro journey aleman live o draft)

Nombres comprobados contra el texto de los cinco journeys alemanes y contra los
nombres de los solicitantes (`Marie` descartada: coincide con una persona real).
Los 10 nombres jovenes del banco aleman ya estan usados en los Traveler, asi que
todos estos van a dar el aviso `character-names-unverified`; son nombres
frecuentes entre nacidos en Alemania entre 1988 y 1996.

| Nombre | Rol | Edad | Ficha (fija, repetida en cada escena) | Presentacion (que ES) |
|---|---|---|---|---|
| **Anna** | protagonista, en las 21 | 33 | pelo rubio oscuro por los hombros, sin flequillo; chaqueta verde oliva; disenadora grafica | "eine Grafikerin aus Bremen" |
| **Jan** | fijo, en la mitad o mas | 34 | pelo castano corto, barba corta; jersey azul marino; cocinero, vive en el bajo de la casa | "ein Koch aus Bremen" |
| Nele | nueva, tema 2 | 32 | pelo negro corto; gafas redondas; camisa amarilla; fotografa | "eine Fotografin" |
| Felix | nuevo, tema 3 | 35 | pelo rubio rizado; camiseta gris; profesor de matematicas | "ein Lehrer" |
| Johanna | nueva, tema 4 | 30 | trenza pelirroja; peto azul de trabajo; librera, vive en el segundo piso | "eine Buchhändlerin" |
| Tim | nuevo, tema 5 | 34 | cabeza rapada; camisa de cuadros roja; bateria, trabaja en un banco | "ein Bankkaufmann" o "ein Musiker" |
| Luisa | nueva, tema 6 | 31 | pelo castano largo recogido; delantal negro; cocinera, companera de Jan | "eine Köchin" |
| Niklas | nuevo, tema 7 | 36 | pelo gris oscuro corto (canas tempranas), jersey marron; dueno de la casa | "der Hausbesitzer" |

Presentacion: tres frases de narracion antes de la primera cita, alternando las
tres formas aprobadas (aposicion, descriptor tras el lugar, `ist` en frase
propia); ninguna forma en mas de la mitad del reparto.

## 4. Espina

Anna vuelve a Bremen despues de ocho anos en Munich y alquila el piso vacio de
arriba, en la casa donde Jan cocina para los amigos cada jueves. Trae una caja
con postales que escribio a Jan y nunca mando. La pregunta del journey: **queda
un sitio para Anna en un grupo que siguio sin ella?** Cada tema le cuesta algo
de la vida de antes o de la de Munich, y en el tema 7 elige quedarse: su nombre
vuelve a la lista de los jueves de la nevera y la ultima postal va con un iman.

Sale de las dos frases del corpus: "Now I would like to reconnect with my friends"
(volver a un grupo de amigos alemanes) y "to be able to read and possibly
correspond in German" (postales, notas, mensajes escritos).

## 5. Los siete temas

Nombres al nivel de dominio APROBADOS por el usuario el 2026-09-13 y renombrados en la base (scripts/_renameFriendsDEa0Topics.ts). Sustituyen a los de objeto (Postcards & Stamps, Photos & Faces, Board Games & Dice, Books & Newspapers, Songs & Instruments, Pots & Spoons, Notes & Magnets), rechazados por demasiado especificos. Historias, personajes y vocabulario no cambian.

Nombres: dominio lexico, ingles, ampersand, 2-4 palabras, sin pais. Ninguno
coincide con las 21 etiquetas alemanas existentes ni con el molde de curso
(comida, familia, compras, saludos, tiempo). Slugs nuevos, `isUniversal: false`.

| # | Tema (slug) | Nuevo | Arco del tema en una linea | Coste no devuelto |
|---|---|---|---|---|
| 1 | Letters & Invitations (`letters-and-invitations`) | - | Anna llega con las postales sin sello; da la primera a Jan, que lee una promesa de hace ocho anos; al final escriben juntos una postal al grupo | la promesa rota queda dicha en voz alta; la postal para Munich va a la basura |
| 2 | Looks & Memories (`looks-and-memories`) | Nele | En la nevera de Jan hay fotos de ocho anos y Anna no sale en ninguna; Nele, la amiga nueva, no sabe quien es; acaban en un marco las dos fotos, la vieja y la nueva | Anna asume que su sitio de "mejor amiga" es de Nele |
| 3 | Games & Rules (`games-and-rules`) | Felix | Noche de juegos: Anna ya no sabe las reglas del juego de siempre; practica con Jan; gana a Felix | pierde su dado de la suerte del colegio por la rejilla del patio |
| 4 | Books & Reading (`books-and-reading`) | Johanna | En la escalera hay un armario de libros para intercambiar que lleva Johanna; Anna busca el libro que dejo hace ocho anos con una nota para Jan dentro; lo encuentra y lo lee con Jan en voz alta | el libro ya se lo llevo alguien; la nota vuelve, el libro no |
| 5 | Music & Singing (`music-and-singing`) | Tim | Tim quiere tocar en el cumpleanos de Jan como el grupo del colegio; Anna cantaba y ya no se atreve | no canta la cancion vieja; canta una nueva, y la vieja se queda sin cantar |
| 6 | Cooking & Hosting (`cooking-and-hosting`) | Luisa | Anna quiere cocinar una vez para el grupo del jueves, como de estudiante; Luisa, companera de Jan, le ensena con cucharas y ollas de verdad | se quema la olla grande de Jan y no tiene arreglo |
| 7 | Plans & Decisions (`plans-and-decisions`) | Niklas | Niklas deja una nota: el piso de arriba es de Anna solo si firma este mes; Munich le ofrece volver; en la nevera, la lista de los jueves | renuncia al trabajo de Munich; cierre sin gancho: su nombre en la lista y la ultima postal con un iman |

Ningun tema termina en mini-cliffhanger en la historia 3: las tres historias
cierran su arco dentro del tema y la espina avanza por el coste, no por un
suspense.

Evidencia (modo journey-level, salida de `assertTopicsGrounded`):

```
MODO JOURNEY-LEVEL · 2 persona(s) detras de todo el journey
  <- Now I would like to reconnect with my friends
  <- I made a lot of German friends
  <- to be able to read and possibly correspond in German
```

## 6. Vocabulario

- 20 plazas por historia (como el Traveler DE A0), ninguna palabra en mas de 2 historias.
- Capa anclada: cero solape con los cinco journeys alemanes. Capa portable (verbo, adjetivo, adverbio, expresion): se reabre, segun `project_vocab_portable_layer_between_levels`.
- Nunca cognados transparentes ni universales (Hallo, ja, danke).
- `vocab-taught-same-type` es cero contra el Friends C1; se mide justo antes de cada guardado porque el Traveler A1 se reescribe en paralelo.

Campo anclado por tema, comprobado contra las 1.848 superficies de vocab de
los journeys alemanes live+draft (el 2026-09-13):

| # | Libres (candidatas a plaza) | Ya ensenadas en otro journey (van en el texto, nunca en plaza) |
|---|---|---|
| 1 | die Postkarte, die Briefmarke, die Adresse | der Brief, der Umschlag, der Stempel, der Absender |
| 2 | das Foto, das Gesicht, die Brille, der Bart, der Rahmen, der Kühlschrank, der Magnet | das Bild |
| 3 | der Würfel, die Figur, gewinnen (portable), der Sieger | die Karte, das Feld, die Runde |
| 4 | das Buch, die Zeitung, die Bibliothek, die Buchhandlung, der Roman (todas en la lista A1/A2) | die Seite, das Wort, die Geschichte, das Regal |
| 5 | das Lied, das Klavier, die Trommel, die Geige, die Note, das Mikrofon | die Gitarre, singen |
| 6 | der Topf, der Löffel, die Gabel, kochen (todas en la lista A1/A2) | die Pfanne, die Schüssel, der Herd, das Salz, der Zucker, das Messer, der Teller |
| 7 | die Notiz, die Liste, der Kuli, der Bleistift | der Zettel, die Nachricht, der Schlüssel |

(Kühlschrank y Magnet se reparten entre los temas 2 y 7, maximo 2 historias cada una.)

## 7. Proceso por tema (fase 2, tras aprobacion)

1. `rulesFor.ts story vocab journey` y `journeysTable.ts --journey <id>`.
2. Plan del tema en JSON (registro, espina, recursos y quiere/impide/cuesta/cambia/emocion por historia), 4-6 parrafos variados entre las tres.
3. Esqueleto con el golpe emocional, luego prosa; las tres en un unico JSON.
4. `saveStory.ts <data.json> --journey <id> --lang DE --level a0 --variant germany --narrator --dry`; un fallo se arregla en la historia.
5. Guardado sin `--dry`, en draft.
6. `cierraTema.ts <id> <tema> --plan <plan.json>`.
7. Fila de `journeysTable.ts` y reporte a Journey-planning con `verified:` / `not verified:`.

Paso previo al tema 1, que tambien espera al aprobado: crear la fila del journey
(draft) y los 7 temas por la puerta que exige `pre-topic-guard.sh`
(llamando a `assertTopicsGrounded`).

Fuera de este encargo: audio, portadas, glosas, practica, push y correos.

## 8. Decisiones abiertas para el usuario

1. Los siete temas y su orden.
2. Bremen y el lugar unico (la casa de Jan).
3. Anna y Jan como fijos, y la espina "volver al grupo".
