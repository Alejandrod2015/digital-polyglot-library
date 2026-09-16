# Plan: Friends ES spain A2 (Salamanca)

Estado: PROPUESTA, pendiente de revision de Journey-planning-2.
Fecha: 2026-09-15. Chat ejecutor: ES_Spain_A2_Friends_1-Texto.
Fuera de este plan: fila `Journey`, temas en la base, historias, audio, portadas, glosas, practica, push y correos.

## 0. Estado comprobado antes de planear

| Comprobacion | Resultado |
|---|---|
| `journeysTable.ts --idioma spanish` | Friends spain a1 LIVE (`cmrr5hnbl000032k1esry5n8g`); ningun Friends spain a2 en live ni draft (cuadra) |
| Hermanos del pool spain | Friends A1 (Lucia por 7 ciudades) y Traveler A1, A2, B1, B2, los cuatro LIVE (cuadra) |
| `assertLadderContiguous` Friends spanish/spain a2 (en seco) | pasa |
| Porton de temas, modo journey-level, con los 7 temas de este plan (en seco) | pasa, 2 personas; ver seccion 5 sobre la cita |
| Slugs y labels de los 7 temas en `Topic` | los 7 libres, cero choques |
| Salamanca en el texto de los 40 journeys live+draft | 0 apariciones (tampoco Tormes, Ferias ni hornazo) |
| Molde | `docs/plan-it-a1-friends.md` de la rama `claude/it-a1-friends-plan` |

Scripts de solo lectura: `scripts/_esA2Friends/dump.ts`, `techo.ts`, `cand.ts`, `probe.ts`.

## 1. Forma

| Campo | Valor |
|---|---|
| Tipo | Friends (`typeSlug` relationships), spanish / spain, a2, 1x7x3 |
| Estilo | narrador, una voz, habla citada dentro de la prosa, banda 25-35% de palabras entre comillas curvas |
| Tiempo de la narracion | **pasado**: indefinido para los hechos, imperfecto para el fondo y lo habitual. Es la marca del A2 (seccion 2); el Friends A1 narra en presente |
| Largo | 128-155 palabras por cuerpo (`bodyWordBand` A2) |
| Parrafos | 4, 5 o 6, distinto entre las tres historias de cada tema |
| Seguidilla | oraciones narradas de 4 palabras o menos **por debajo del 35%** por tema (el cierre avisa al 50%; el 35% es la leccion del IT A1) |
| Lugar | Salamanca: el garaje de Ruben en el Barrio del Oeste (el de los murales), la autoescuela de Lorena en la calle Zamora, la orilla del Tormes junto al Puente Romano y, en el tema 7, las Ferias de septiembre |
| Fijos | 2: Lorena (en las 21) y Ruben (en mas de la mitad) |
| Nuevos | 1 por tema desde el tema 2, en la primera historia de su tema, confinado a su tema (ni nombrado fuera) |
| Hablan por historia | 2, como mucho 3; el narrador nombra a quien habla antes de su primera cita |
| Cierre de tema | la historia 3 cierra su arco; ningun mini-cliffhanger en el ultimo slot |
| Calendario interno | de junio a septiembre de 2026; los recuerdos son de septiembre de 2012 |

**Por que Salamanca.** Ningun journey vigente la usa, y los hermanos del pool ya ocupan Madrid, Barcelona, Sevilla, Valencia, Bilbao, Granada, San Sebastian (Friends A1), Malaga (Traveler A1/A2), Vitoria y Cadiz (Traveler B2). Un anglosajon que estudia espanol la situa sin ayuda (es la ciudad de los cursos de verano) y trae anclas que no toca nadie: la rana de la fachada de la Universidad, el Tormes, las Ferias y Fiestas de septiembre, el hornazo.

## 2. Banda gramatical A2 (vara externa)

Vara: **Plan Curricular del Instituto Cervantes, inventario de gramatica A1-A2, seccion 9** (consultado el 2026-09-15 en cvc.cervantes.es, leido por extraccion automatica: la lectura es floja y conviene que la revise una persona). La sonda es `scripts/_gramProbe.ts`, que en espanol si existe.

**Dentro (PCIC A1-A2):**
- Presente, preterito perfecto, preterito indefinido (regulares e irregulares frecuentes) y **preterito imperfecto con sus dos valores A1-A2: descriptivo (personas, lugares, tiempo) y habitual** ("En 2012 tocaban todos los jueves"). El contraste nace de ahi: el imperfecto pinta y repite, el indefinido cuenta.
- Imperativo afirmativo de `tu` y `vosotros`, nunca cerrando una replica (`dialogue-bare-imperative`).
- Perifrasis: `estar` + gerundio, `ir a`, `acabar de`, `empezar a`, `volver a`, `tener que`, `hay que`, `poder` + infinitivo.
- Pronombres de objeto directo e indirecto; el doble `se lo` como mucho 1 por historia.
- Relativas especificativas con `que`; causales con `porque`, temporales con `cuando` y `mientras`.

**Fuera (B1 o mas, ausentes del inventario A1-A2):** futuro simple (se usa `ir a`), condicional, subjuntivo en cualquier forma, pluscuamperfecto, imperativo negativo, estilo indirecto ("dijo que", "le conto que"), `se` impersonal. Tolerancia unica declarada: `me gustaria` como formula, 1 por tema como mucho.

**Banda medida con la sonda, por 100 oraciones:** preterito e imperfecto sin banda (miden el modo de narrar); condicional 0-2 (solo la formula); subjuntivo presente 0; subjuntivo imperfecto 0; estilo indirecto 0. Ojo con la sonda: los nombres en -ria cuentan como condicional, y por eso nadie del reparto se llama asi.

- Densidad: techo 13 palabras por oracion en A2 (`cierraTema`). Si se pasa, se quita un hecho.
- Recursos A2 (spec 3ter): simil simple, espejo concreto, flashback marcado ("En septiembre de 2012..."). Nada figurado mas alla.
- Lexico del cuerpo dentro de i+2 (hasta B1); nada de argot en nivel A.
- Emocion en tres piezas (sensacion, motivo, gesto); ultima linea en imagen concreta, nunca maxima.

## 3. Reparto (propio)

**Comprobacion.** Ningun nombre aparece en el texto, titulo ni sinopsis de los 40 journeys live+draft, ni en los planes de `docs/` (incluido el IT A1), ni en la memoria del proyecto. Descartados por eso: Noelia (nombre de una solicitante real de la beta), Susana, Gonzalo, Victor y Begona (nombres de voces del banco de Espana). Ningun oficio sale en el corpus en espanol, ingles, aleman, italiano, frances ni portugues: descartados por choque `fisioterapeuta` (Julia y Miriam, DE A1), `electricista` (Romain, FR A2; Florian, DE A1), `veterinaria` y `cartero` (IT A1), y `panadero`, `peluquera`, `camarero` y `librero` (varios journeys). Todos adultos en activo, nacidos en Espana, de 31 a 45 anos. **Del Friends A1 no se hereda ningun personaje**, solo la capa portable de vocabulario (seccion 6).

Aviso esperado: `character-names-unverified`, porque el banco `spanish/spain` solo tiene nombres ya usados por otros journeys.

| Nombre | Rol | Edad | Ficha fija (repetida en cada escena) | Presentacion (que ES) | Forma | Tema |
|---|---|---|---|---|---|---|
| **Lorena** | protagonista, en las 21; guitarra y voz de La Rana | 36 | pelo castano oscuro largo en coleta, sin flequillo; cazadora vaquera clara | "Lorena, una profesora de autoescuela de Salamanca," | aposicion | todos |
| **Ruben** | fijo; bateria de La Rana; guardias de 24 horas | 37 | pelo negro muy corto, barba corta; sudadera azul marino | "Ruben es un bombero del parque de Salamanca" | con ser | todos |
| Jaime | nuevo | 34 | pelo rubio rizado, gafas de pasta negras; camiseta gris | "Jaime, un programador del Barrio del Oeste," | aposicion | 2 |
| Olga | nueva | 42 | pelo rojo corto, sin flequillo; chaleco reflectante amarillo | "En la grua esta Olga, una gruista del ayuntamiento" | tras el lugar | 3 |
| Raquel | nueva | 45 | melena castana con canas en las sienes; bata blanca de la optica | "Raquel es una optica de la calle Toro" | con ser | 4 |
| Sergio | nuevo | 31 | cabeza rapada, brazos tatuados; camisa negra | "En el estudio esta Sergio, un tatuador del barrio" | tras el lugar | 5 |
| Raul | nuevo | 39 | pelo castano con entradas, barba cuidada; jersey verde | "Raul, un bibliotecario de la universidad," | aposicion | 6 |
| Silvia | nueva | 33 | pelo negro liso por los hombros, flequillo recto; camiseta negra del ayuntamiento | "Silvia es una tecnica de sonido del ayuntamiento" | con ser | 7 |

Formas: aposicion 3, con ser 3, tras el lugar 2 (ninguna pasa de la mitad). Sin gentilicios en la presentacion. Nadie del reparto tiene pareja nombrada fuera de su tema.

## 4. Espina

En 2012 Lorena y Ruben estudiaban en la Universidad de Salamanca y tenian un grupo, **La Rana**, por la rana de la fachada. Tocaban todos los jueves en bares del centro. En septiembre de 2012 les dieron su primer escenario de verdad en las Ferias. Lorena no aparecio. Ruben toco solo, salio mal, y no se hablaron en catorce anos. En junio de 2026 el ayuntamiento abre la inscripcion de grupos locales para las Ferias, y Ruben entra en la autoescuela de Lorena con un papel en la mano.

La pregunta del journey: **se puede terminar la cancion que se quedo a medias sin decir por que se quedo a medias?** Cada tema le cuesta algo a uno de los dos. La verdad (Lorena llego a la Plaza, vio a la gente y se fue a casa de miedo) sale en el tema 6 delante de un desconocido, y en el tema 7 se la dice a Ruben antes de subir. Tocan bajo la tormenta para cuarenta personas, y la guitarra de la universidad no vuelve a sonar.

Por que funciona en A2: la espina vive entre dos tiempos. 2012 se cuenta en imperfecto (lo que eran, lo que hacian cada jueves) y 2026 en indefinido (lo que pasa ahora), que es exactamente la gramatica nueva del nivel. Diferencia con las espinas vigentes: nadie se muda de ciudad (FR A0, FR A2, DE A0, DE A1), no hay mascota compartida (IT A1), ni negocio (FR B1), ni confesion amorosa (IT A0).

## 5. Los siete temas

Nombres de DOMINIO (`project_topic_naming_rule`): ingles, ampersand, 2-4 palabras, sin pais ni articulo, slug derivado, `isUniversal: false`. Ninguno nombra objetos sueltos ni repite los temas del pool spain.

**Pista de usuarios.** Las 49 solicitudes de espanol se leyeron como pista, no como filtro (`feedback_beta_motivation_hint_not_filter`). Donde inspiran, se dice. **Aviso:** el porton de temas todavia exige cita al guardar temas en la base; en seco pasa en modo journey-level con dos frases ("Holiday home in Spain and I wish to talk to neighbours" y "My boyfriend and I have been dating for a year and a half now"). Si el gate no es aviso cuando toque guardar, se para y se avisa.

| # | Tema (slug) | Pista de usuarios | Nuevo | Arco del tema | Coste no devuelto |
|---|---|---|---|---|---|
| 1 | Music & Bands (`music-and-bands`) | - | - | Ruben aparece en la autoescuela con la inscripcion; Lorena dice que no; en casa saca la guitarra con una cuerda rota y no recuerda los acordes; primer ensayo en el garaje, las manos van despacio y los dos callan lo de 2012 | Lorena deja sus clases de los sabados por la tarde, las que mejor le pagan |
| 2 | Phones & Social Media (`phones-and-social-media`) | "read the news & social media"; interes Technology | Jaime | Ruben abre un perfil de La Rana; Jaime, que grabo el concierto de 2012, sube el video: Ruben solo en el escenario; lo comparte medio barrio; Lorena lo ve en el movil de una alumna | en el parque de bomberos a Ruben ya solo le llaman "la Rana" |
| 3 | Driving & Cars (`driving-and-cars`) | interes city-getting-around (5 solicitudes) | Olga | La bateria no cabe en ningun coche; Lorena presta el coche de la autoescuela fuera de horario; Ruben aparca mal delante del garaje y se lo lleva la grua; Olga les hace esperar en el deposito | la multa la paga Lorena, y su jefa no le vuelve a dejar el coche |
| 4 | Money & Loans (`money-and-loans`) | - | Raquel | El amplificador viejo se quema en un ensayo; la inscripcion pide equipo propio; Raquel vende el de su hermano a plazos; Ruben no llega y Lorena le presta la mitad | Ruben vende su moto para devolverla |
| 5 | Clothes & Looks (`clothes-and-looks`) | - | Sergio | Foto para el programa de las Ferias; la cazadora roja de 2012 ya no le cierra a Lorena; Sergio dibuja la rana nueva del grupo; Ruben se afeita la barba para parecerse a la foto vieja y no se reconoce | Lorena regala la cazadora roja, lo ultimo que guardaba de 2012 |
| 6 | Couples & Dating (`couples-and-dating`) | "My boyfriend and I have been dating..."; "I started to learn Spanish for my new girlfriend"; "My partner is Chilean" | Raul | Primera cita de Lorena con Raul junto al Tormes; el la reconoce del video; ella le cuenta por primera vez lo del miedo en la Plaza; Ruben llama porque el garaje se inunda y Lorena se va a mitad de la cena | Raul no vuelve a llamar |
| 7 | Fairs & Street Parties (`fairs-and-street-parties`) | intereses traditions-daily-culture (8 solicitudes) | Silvia | Las Ferias: escenario pequeno junto al rio; Silvia retrasa la prueba de sonido por la tormenta; antes de subir Lorena le cuenta a Ruben la verdad de 2012; tocan tres canciones bajo la lluvia y la ultima es la de entonces | la guitarra de la universidad se moja y no vuelve a sonar; cierre sin gancho: Ruben guarda las baquetas y la acompana a casa |

## 6. Vocabulario

### Forma

- **20 plazas por historia: 14 portables y 6 ancladas** (`feedback_vocab_ladder_belongs_in_the_brief`; ancladas al 30%, el tope del gate). De las 14 portables, al menos 2 expresiones; de las 6 ancladas, 1 es el ancla cultural de la historia (`register: cultural`).
- **En espanol el techo de lista es de tolerancia cero**: `vocab-level-frequency` falla con UNA sola plaza fuera de `spanishA1A2.ts` (el juez es de lista y su cache esta vacia). Solo se eximen las plazas `type: expression` y las de `register` cultural. No hay margen de 2 como en italiano.
- **Solape** (`saveStory`, pool spain): portables reabiertas contra todo; ancladas del Friends A1 reabiertas (mismo tipo, otro nivel); ancladas de los Traveler spain como mucho 2 por historia, con **objetivo cero**; dentro del propio journey, cero repeticiones de plaza, portables incluidas.
- Nunca cognados transparentes (`guitarra`, `musica`, `foto`, `telefono`) ni universales A0.
- Suelo del gate A2: media 1,3, cola 80%. **Objetivo del plan: media 2,0 o mas, cola 55% o menos.**

### Techo medido

Medido el 2026-09-15 con `scripts/_esA2Friends/techo.ts` y `cand.ts` sobre la lista y el vocab de los 40 journeys vigentes (solo palabras sueltas; los bloques de relleno regional latinoamericano, fuera).

| | Hace falta (21 historias) | Hay en la lista |
|---|---|---|
| Portables sujetas a lista (verbo, adjetivo, adverbio) | 12 x 21 = **252** | 248 nunca ensenadas en spain + 356 reabribles = **604** en bruto |
| Ancladas sujetas a lista (sin el ancla cultural) | 5 x 21 = **105** | 100 libres y 67 reabribles en los 7 campos (nombres y portables juntos) + 334 nombres libres del nucleo de la lista |
| Expresiones y anclas culturales | 42 + 21 | sin limite de lista |

**Alcanza, con un precio que conviene decir con numeros.** De las 278 candidatas de escena probadas en los 7 campos (`final7.json`), **71 caen fuera de la lista** y 40 estan bloqueadas por los Traveler spain; esas 71 y no pueden ser plaza aunque sean de A1-A2 de verdad: `concierto, ensayar, publico, bombero, incendio, multa, gasolina, video, comentario, discutir, perdonar, casarse, celos, prestamo, caseta`. Van en el TEXTO y en la glosa. El bruto de 604 portables trae ruido (`estar`, `haber`, verbos regionales), asi que el margen real es menor que el doble. Los 7 campos dan 167 plazas posibles (100 libres y 67 reabribles) para 420 plazas, asi que **unas seis de cada diez plazas (253) saldran de fuera del campo del tema**, sobre todo portables corrientes, y la palabra de escena se aprende leyendo, como en el IT A1. Riesgo a vigilar desde el tema 1: `journey-vocab-worth-teaching`.

Recomendacion: **no ampliar la lista** antes del tema 1. Si el cierre del tema 1 marca plazas flojas por `worth-teaching`, se propone al chat de planificacion un bloque curado por palabra con cita del PCIC, como el de KELLY en italiano.

### Campo por tema

**Libre** = dentro de lista y nunca ensenada en spain. **Reabrible** = dentro de lista y ya ensenada como portable o por el Friends A1. **Bloqueada** = anclada de un Traveler spain (solo texto).

| # | Libres (plaza) | Reabribles (plaza) | Bloqueadas (texto) | Fuera de lista (texto) |
|---|---|---|---|---|
| 1 | ensayo, grupo, escenario, bateria, altavoz, cable, cuerda, disco, ritmo, melodia, tono, garaje, microfono, olvidar | cancion, voz, tocar, aplaudir, repetir, recordar, fuerte, bajito, cansado, recuerdo | letra, cinta, bajo, dedo | ensayar, concierto, publico, grabar, afinar, baquetas, cantante, nervios, practicar, juventud |
| 2 | pantalla, cargador, contrasena, perfil, red, aplicacion, mentira, compartir | subir, borrar, mandar, contestar, famoso, desconocido, llamar, reirse | movil, mensaje, cuenta, verguenza, verdad, nombre, cara | video, comentario, seguidor, publicar, internet, bloquear, burlarse, cruel |
| 3 | carnet, examen, frenar, aparcar, rotonda, conducir, alumno, semaforo, accidente, trafico, cinturon, aprobar | carretera, girar, despacio | coche, marcha, curva, llave, calle, prisa, espejo, rueda | furgoneta, volante, freno, multa, gasolina, maletero, arrancar, velocidad, grua |
| 4 | ahorrar, gastar, gasto, tarjeta, precio, cambio, oferta, factura, mitad, regalar | prestar, deber, pagar, cobrar, caro, barato, vender, comprar, devolver, pedir | dinero, deuda, sueldo, banco, billete, moneda, recibo, cajero | prestamo, ahorros, efectivo, amplificador, rebaja, plazo |
| 5 | ropa, camiseta, chaqueta, cremallera, sudadera, gorra, cinturon*, gafas, barba, bigote, peinarse, moda, planchar, mancha, dibujo, feo | guapo, probar, estrecho, ancho, corto, largo, cortar, secar, arreglar | espejo, color | talla, probador, elegante, tatuaje |
| 6 | novio, novia, cita, secreto, mentir, besar, enfadado, anillo | abrazar, enfadarse, quedar, llorar, cenar, dejar, romper, querer | pareja, boda, perdon, confianza, viaje, carino, miedo | celos, discutir, perdonar, confiar, echar de menos, prometer, orgulloso |
| 7 | feria, fiesta, tormenta, programa, cerveza, baile, septiembre, farola, rio | plaza, gente, lluvia, paraguas, esperar, empezar, terminar, gritar, oscuro | cartel, cola, tapa, luz, tarde | caseta, fuegos artificiales, noria, multitud, trueno, ayuntamiento, orquesta |

(*) `cinturon` sale en dos campos: va al tema 3 o al 5, nunca a los dos.

Anclas culturales candidatas (una por historia, `register: cultural`): la rana de la fachada, el Tormes, el Puente Romano, la Plaza Mayor, el Barrio del Oeste, las Ferias, el hornazo, el carnet por puntos, la grua municipal.

### Capa portable desde el Friends A1 (recirculacion en el TEXTO)

El alumno que sale del A1 ya tiene estas portables. Vuelven en la prosa desde el tema 1 para que el A2 no le suene a idioma nuevo; se prefiere gastar la plaza en palabra nueva.

| Tema | Portables del A1 que reaparecen en el cuerpo |
|---|---|
| 1 | sonreir, esperar, respirar, tocar, nervioso, cansado, despacio, otra vez, de repente |
| 2 | mirar, llamar, reir, charlar, sorprendido, famoso, triste |
| 3 | llegar, esperar, guardar, sacar, tranquilo, rapido, temprano |
| 4 | pagar, vender, comprar, pedir, contar, caro, mejor |
| 5 | probar, llevar, parecer, alto, corto, bonito, nuevo |
| 6 | abrazar, pasear, oler, dudar, contento, emocionado, por fin |
| 7 | subir, bailar, aplaudir, brillar, saludar, feliz, juntos, de acuerdo |

### Recirculacion interna, planificada desde el tema 1

1. **Toda portable nueva entra como muy tarde en la historia 15** (tema 5). Los temas 6 y 7 gastan sus plazas en ancladas de su campo, expresiones y reabribles.
2. **Objetos de la espina que viajan por las 21 en el texto:** la guitarra, la bateria, el garaje, la inscripcion, la rana, el video de 2012, "los jueves".
3. **Palabras gramaticales nunca como plaza.**
4. **Lista obligatoria de reencuentro** (portable de los temas 1 a 4, temas donde tiene que volver en el cuerpo):

| Palabra (tema de entrada) | Vuelve en |
|---|---|
| olvidar (1) | 4, 6 |
| recordar (1) | 5, 7 |
| repetir (1) | 3, 7 |
| cansado (1) | 2, 5 |
| fuerte (1) | 4, 7 |
| bajito (1) | 6 |
| compartir (2) | 4, 7 |
| borrar (2) | 5, 6 |
| contestar (2) | 6 |
| famoso (2) | 5, 7 |
| aparcar (3) | 4, 7 |
| frenar (3) | 6 |
| aprobar (3) | 5 |
| girar (3) | 7 |
| ahorrar (4) | 6 |
| devolver (4) | 5, 7 |

Las palabras de escena fuera de lista (concierto, multa, video) tambien vuelven en el texto; no suman en la media del gate, que solo mide plazas, pero sostienen la lectura. La lista se copia al JSON de plan de cada tema y el cierre mide la escalera acumulada antes de seguir.

## 7. Plantillas prohibidas entre historias (leccion del IT A1)

La lectura seguida de las 21 del IT A1 encontro plantillas en 3 o mas historias. Aqui se reparten desde el plan, **como mucho 2 historias por plantilla en todo el journey**:

- emocion fisica explicada con "porque" ("le tiemblan las manos porque...");
- el mismo cierre: reaccion muda, sonrisa final, alguien que se duerme, "y se ríen";
- la misma hora o franja ("a las ocho", "por la noche"): cada tema declara la suya y no se repite en temas seguidos;
- apertura con el mismo verbo o la misma formula de dos palabras (el gate de journey bloquea a partir de 4);
- el flashback de 2012 abierto siempre con "En 2012": se alterna con "Hace catorce anos", "Aquel septiembre", "Cuando estudiaban".

## 8. Proceso por tema (fase 2, tras aprobacion)

Paso previo, una vez: scaffold calcado del IT A1 (`assertLadderContiguous`, porton de temas, `assertJourneyType`), primero con `--dry`.

Por tema, del 1 al 7: `rulesFor.ts story vocab journey` y `journeysTable.ts --journey <id>`; plan JSON (registro, espina, recursos, quiere/impide/cuesta/cambia/emocion, parrafos, franja horaria) con la lista de reencuentro; esqueleto con el golpe emocional y despues prosa, las tres en un JSON; `_gramProbe` sobre las tres; `saveStory.ts <data.json> --journey <id> --lang ES --level a2 --variant spain --narrator --dry`; guardado; `cierraTema.ts`; escalera acumulada; reporte a Journey-planning con `verified:` / `not verified:`.

Al final: lectura seguida de las 21 buscando plantillas en 3 o mas historias.

## 9. Bloqueos y avisos

1. **Porton de temas.** Hoy exige cita al guardar; en seco pasa en modo journey-level. Si al guardar sigue siendo bloqueo, se avisa antes de forzar citas.
2. **Techo de lista de tolerancia cero** (seccion 6). No bloquea, pero deja fuera 71 de las 278 palabras de escena probadas. Recomendacion: no ampliar antes del tema 1.
3. **Vara gramatical.** El PCIC se leyo por extraccion automatica; la banda de la seccion 2 conviene confirmarla contra el inventario original antes del tema 1.
4. **Narrar en pasado** es decision de estilo nueva en el pool spain (los hermanos narran en presente). Sin gate que la mida salvo la sonda.
