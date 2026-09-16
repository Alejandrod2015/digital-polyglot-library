# Plan: Cultural ES/Mexico B1 (Navidad en Oaxaca)

Estado: PROPUESTA del 2026-09-16, pendiente de aprobacion de Journey-planning-2.
Chat ejecutor: el que reciba el encargo de la fase 2.
Fuera de este plan: fila `Journey`, temas en la base, historias, audio, portadas,
glosas, practica, push y correos. Aqui no se escribe ni se crea nada.

Encargo: "un journey con historias de navidad en espanol de latam" (usuario, via
Journey-planning-2).

## 0. Estado comprobado antes de planear

Todo medido el 2026-09-16 desde un worktree de `origin/main` (8c1c2daf).

| Comprobacion | Resultado |
|---|---|
| `journeysTable.ts --idioma spanish` | 13 live + 4 draft. Ningun journey de Navidad, ningun tema navideno |
| `JourneyType` en la base | 8 tipos; `cultural` existe y **ningun journey del catalogo lo usa**, en ningun idioma |
| `assertLadderContiguous` Cultural spanish/mexico b1 (en seco) | **pasa** (primer peldano del tipo) |
| `assertLadderContiguous` Friends spanish/latam b1 (en seco) | **tira**: dejaria hueco en B2 |
| `assertLadderContiguous` Friends spanish/mexico a2 (en seco) | **tira**: dejaria hueco en B1, B2 |
| `assertTopicsGrounded` modo journey-level, los 7 temas de este plan (en seco) | **pasa**; 4 personas detras, sobre 60 frases escritas de spanish |
| Slugs y labels de los 7 temas en `Topic` (342 filas) | los 7 libres |
| Banco de nombres `spanish/mexico` en `characterNames.ts` | **no existe** (solo `spanish/spain` y `spanish/latam`). Aviso esperado `character-names-unverified` |
| Nombres ocupados en el texto de los 17 journeys ES | 117 extraidos; los 8 de este plan no estan entre ellos |
| Plazas de vocab ya ensenadas en espanol live+draft | **4642 palabras distintas** |
| Listas CEFR de espanol (`spanishA1A2/B1/B2/C1`) | existen; la cache del juez sigue vacia |
| `BetaSignup` de espanol | 52 de 81 solicitudes |

Scripts de solo lectura usados, en `scripts/_esNavidad/`: `dump.ts`, `beta2.ts`,
`ladder.ts`, `ground.ts`, `slugs.ts`, `nombres2.ts`, `lvl2.ts`, `vocab.ts`.

Aviso ajeno a este plan: el hook de glosas avisa de 4 bundles desfasados
(`french-friends-france-b1`, `german-friends-a1`, `italian-friends-italy-a1`,
`spanish-friends-spain-a2`). No se toca: es trabajo de otros chats.

## 1. Las cuatro decisiones

### 1.1 TIPO: **Cultural**

Un journey de Navidad es, por definicion del plan de tipos, el caso de Cultural:
sus siete temas son "obras o tradiciones", lugares varios, 2 personajes fijos.
Friends (Relationships) tambien podria montarse, pero hay tres razones que lo
descartan y una cuarta que lo hace inviable:

1. **La escalera lo prohibe.** Medido en seco: el unico Friends latino que
   admite un peldano nuevo es un B2 (latam, mexico o colombia, todos pegados a
   su C1); el a2 y el b1 tiran. Un journey de Navidad en B2 es un producto raro.
   **Cultural no tiene ni un peldano en todo el catalogo**, asi que el nivel se
   elige libre, y crear el B1 primero no cierra nada: crear por debajo del
   minimo pasa, o sea que el A0, A1 y A2 Culturales siguen pudiendose abrir
   despues.
2. **Cultural es el tipo de mayor demanda medida y el unico sin una sola fila.**
   61,8% de los aprendices de espanol declaran interes personal como motivo
   principal; el catalogo entero responde con Traveler y Friends.
3. **El tema es el dominio, no la relacion.** En Friends el eje son momentos de
   una relacion en un lugar privado, y el comprador escucha desde fuera. Aqui lo
   que se vende es entender que pasa el 16 de diciembre en la puerta de un
   vecino, que es exactamente el eje de Cultural.
4. El punto flojo conocido de Cultural (lugares multiples, mala retencion, solo
   narrativa) lo arregla el calendario: ver la seccion 1.4.

### 1.2 VARIANTE: **mexico**, no "latam" generico

El encargo decia "espanol de latam", y la variante `latam` existe y tiene 11
solicitudes. Aun asi propongo **mexico**, con este argumento:

- **Una Navidad "latam" hay que vaciarla para que sea cierta.** Las posadas y la
  pastorela son mexicanas; la novena de aguinaldos es colombiana y ecuatoriana;
  el ano viejo que se quema es ecuatoriano y colombiano; el pan dulce y el vitel
  tone son argentinos. Lo pan-latino es poco y ya esta ensenado: el Traveler
  latam A0 tiene "Community & Celebrations" y el B1 "Faith & Devotion". Un
  Cultural latam de Navidad seria el tercer journey latam hablando de lo mismo,
  y sin ninguna de las palabras que hacen falta.
- **Mexico tiene siete tradiciones distintas en un solo calendario**, del 16 de
  diciembre al 2 de febrero, con orden propio. Eso resuelve solo el problema de
  Cultural: los siete temas ya vienen ordenados y con gancho hacia el siguiente.
- **La voz.** La regla es que la voz sigue al pais. Con `mexico` la pregunta
  tiene respuesta (hay familia de voces mexicanas en la cuenta, la del Traveler
  mexico A1 vivo); con `latam` generico, el narrador acaba siendo colombiano
  contando posadas, que es el error de Andreti al reves.
- **Los personajes tienen que ser nativos de la variante.** En `latam` eso no
  significa nada operativo; en `mexico` fija reparto, voz y acento de una vez.
- Demanda: `mexico` son 7 solicitudes propias, y de las 11 de `latam` la mayoria
  son de Estados Unidos, donde el referente es Mexico. No es el argumento
  principal, es el que no contradice a los otros.

**Ciudad: Oaxaca de Juarez.** Ningun journey del catalogo la usa (mexico va por
Guanajuato, Puebla, Tulum, Monterrey, Veracruz y Tijuana). Trae una tradicion
que no existe en ningun otro sitio del mundo (la Noche de Rabanos, 23 de
diciembre) y un mercado, un zocalo y un barrio de puertas a la calle (Jalatlaco)
que dan los siete escenarios sin salir de la ciudad.

**Lectura declarada del tipo:** Cultural pide "lugares varios". Aqui son siete
escenarios distintos dentro de una ciudad (callejon, zocalo, casa, calle,
azotea, panaderia, atrio), no siete ciudades. Se hace asi a proposito: con dos
fijos que tienen que salir en las 21 y en mas de la mitad, siete ciudades
obligan a mover el reparto a la fuerza. **Esto necesita tu aprobacion explicita:
es la unica desviacion del plan de tipos.**

### 1.3 NIVEL: **B1**

| Argumento | Numero |
|---|---|
| Escalera | Cultural no tiene peldanos: B1 pasa el porton, y no bloquea abrir A0-A2 despues |
| Demanda propia | 20 de 52 solicitantes de espanol se declaran Intermediate (B1), 30 Beginner y 2 Advanced |
| Cobertura actual del Beginner | 9 journeys ES entre a0, a1 y a2 |
| Cobertura actual del Intermediate | 4 journeys ES (b1 y b2), **los cuatro Traveler**, ninguno mexicano, ninguno Cultural |
| DELE | A2 56.317 candidatos, B2 25.771, B1 19.283 (el B1 no es el mayor, se dice entero) |

El argumento que decide no es la demanda, es **el lexico medido**. El campo
emocional de este journey (deber un favor, prometer, perdonar, discutir,
presumir, avergonzarse) cae fuera de la lista A1/A2 casi entero y dentro de la
de B1:

| Palabra | En lista A2 | En lista B1 |
|---|---|---|
| prometer, discutir, perdonar | no | si |
| orgulloso, emocionado | no | si |
| confesar, encargar | no | si |
| pavo, propina, quincena, santo | no | si |

Escrito en A2, este journey se queda en sustantivos de mesa. En B1 el campo
entra en la lista y el presupuesto de palabras fuera de lista queda libre para
las anclas navidenas, que es donde tiene que gastarse.

Caveat honesto: el juez CEFR de espanol es solo listas, no lematiza y su cache
esta vacia, asi que `body-level-frequency` sobreestima entre 5 y 10 puntos. La
medida de la tabla de arriba es del lema, que es donde el juez si acierta.

### 1.4 ESTACIONALIDAD: journey normal, vivo todo el ano, campana en noviembre

- **No se esconde.** La app no tiene ninguna maquinaria para ocultar y reabrir un
  journey por fecha, y construirla seria una feature que nadie ha pedido. Peor:
  la colocacion manda al alumno al track mas cercano y el porton de escalera
  cuenta niveles live+draft. Un peldano que desaparece diez meses es un hueco
  intermitente en las dos cosas.
- **Lo estacional es la campana, no el contenido.** El journey se publica en la
  primera quincena de **noviembre**, antes de que empiece el ciclo real, y se
  anuncia entonces. En marzo sigue vivo y se lee igual: es un ciclo narrado, no
  un calendario de adviento.
- **Consecuencia de produccion, que es lo que aprieta.** 21 historias, 21
  portadas y 21 narraciones. Empezando la semana del 16 de septiembre hay
  margen; empezando en noviembre, no lo hay. El calendario es el motivo de
  decidir ahora, y el motivo de no encadenarlo a nada.
- No lleva `nextJourneyId` ni entra en ninguna cadena existente: es la primera
  fila de su tipo.

## 2. Forma

| Campo | Valor |
|---|---|
| Tipo | Cultural (`typeSlug` cultural), `Journey.name` = "Cultural", spanish / mexico, b1, 1x7x3 |
| Estilo | narrador, una voz, habla citada dentro de la prosa, banda 25-30% de citado |
| Largo | 210-260 palabras por cuerpo (banda B1) |
| Parrafos | 4, 5 o 6, distinto entre las tres historias de cada tema |
| Lugar | Oaxaca de Juarez: el callejon de Jalatlaco, el zocalo, la casa de Alondra, la calle del barrio, la azotea, la panaderia del mercado 20 de Noviembre, el atrio |
| Fijos | 2: Alondra (en las 21) y Ulises (en mas de la mitad) |
| Nuevos | 1 por tema desde el tema 2, en la primera historia del tema, confinado a su tema |
| Hablan por historia | 2, como mucho 3; el narrador ancla cada cambio de voz |
| Registro | mexicano neutro de ciudad, sin albur ni jerga cerrada; usted a quien se le debe respeto |
| Cierre de tema | la historia 3 cierra su arco; ningun mini-cliffhanger en el ultimo slot |
| Nadie menor ni mayor | regla dura: reparto de 29 a 40 anos, todos en activo. Ver seccion 3 |

## 3. Reparto (propio)

Ningun nombre sale en el texto de los 17 journeys espanoles live+draft (117
nombres extraidos y contrastados). Ningun oficio repite: descartados por choque
`veterinaria` (IT A1), `parrucchiera/peluquera` (ES Friends A1), `traductora`
(ES Traveler B1), `carpintero` (IT A1). Todos mexicanos.

| Nombre | Rol | Edad | Ficha fija (repetida en cada escena) | Presentacion | Forma | Tema |
|---|---|---|---|---|---|---|
| **Alondra** | protagonista, en las 21; puesto de flores en el mercado, vende flor de nochebuena | 33 | pelo negro recogido en trenza, sin fleco; mandil azul marino | "Alondra, una florista del mercado," | aposicion | todos |
| **Ulises** | fijo; electricista del barrio, cuelga las luces de las nueve posadas | 36 | pelo corto con canas en las sienes, barba rasurada; camisa de mezclilla | "Ulises es el electricista de Jalatlaco" | con ser | todos |
| Perla | nueva; hortelana de San Antonino, trae los rabanos | 31 | pelo castano ondulado a la altura del hombro; blusa bordada verde | "En la fila esta Perla, una hortelana de San Antonino" | tras el lugar | 2 |
| Gerardo | nuevo; cocinero de una fonda del mercado | 40 | cabeza rapada, bigote espeso; delantal blanco manchado | "Gerardo es el cocinero de la fonda de junto" | con ser | 3 |
| Mayra | nueva; rotulista, pinta los letreros de los puestos | 34 | pelo negro corto sobre las orejas; overol gris con manchas de pintura | "Mayra, una rotulista del mercado," | aposicion | 4 |
| Saul | nuevo; mezcalero de un palenque de Santiago Matatlan | 29 | pelo lacio hasta la nuca, sin barba; chamarra cafe de lona | "En la azotea esta Saul, un mezcalero de Matatlan" | tras el lugar | 5 |
| Brenda | nueva; panadera, hornea las roscas del barrio | 37 | pelo castano claro recogido con paliacate rojo; bata blanca | "Brenda es la panadera del mercado" | con ser | 6 |
| Aldo | nuevo; tamalero, tiene un puesto en la esquina del atrio | 35 | pelo negro con raya a un lado, barba corta; sudadera guinda | "Aldo, un tamalero de la esquina," | aposicion | 7 |

Formas: aposicion 3, con ser 3, tras el lugar 2 (ninguna pasa de la mitad).
4 mujeres y 4 hombres.

**Como se sostiene la regla de nada de ninos ni ancianos en una fiesta que va de
ninos y abuelos.** No se resuelve evitando la escena, se resuelve cambiando de
quien es la historia: **el journey mira a quien MONTA la fiesta, no a quien la
recibe**. La posada la organizan adultos; los rabanos los talla un gremio de
adultos que compite por un premio; la rosca la hornea y la reparte una panadera;
los tamales los debe quien saco el muneco. El Nino Dios es una figura de yeso
que se arrulla y se viste, no un personaje. Las familias existen fuera de cuadro
y se mencionan; no hablan.

Aviso esperado al guardar: `character-names-unverified` en los 8, porque no hay
banco `spanish/mexico`. Crearlo es trabajo de otra tanda; aqui se declara.

## 4. Espina

Alondra vende flor de nochebuena en el mercado: diciembre le paga el ano entero.
Este ano el barrio se queda sin quien organice las nueve posadas, porque quien
las hacia se fue a Tijuana. Alondra se ofrece, y no por devocion: la ruta de las
posadas pasa por su puesto y eso son nueve noches de venta. Ulises, que cuelga
las luces desde hace anos y si cree en la fiesta, lo sabe desde la primera noche
y no dice nada.

La pregunta del journey: **una tradicion aguanta que la uses?** Cada tema le
cobra algo a Alondra, y siempre algo que ella habia contado como ganancia. En el
tema 6 le toca el muneco de la rosca y finge que no; en el 2 de febrero paga los
tamales de todo el barrio con lo que gano en la temporada. Se queda sin el
margen del ano y se queda con lo que estaba usando.

Diferencia con las espinas vigentes: nadie se muda de ciudad, no hay pacto
amoroso, no hay negocio que montar. Lo que esta en juego es un margen pequeno y
una costumbre prestada.

## 5. Los siete temas

Nombres de DOMINIO: ingles, ampersand, 2-4 palabras, sin pais, Title Case, slug
derivado del nombre, `isUniversal: false`. Ninguno nombra objetos sueltos (ni
"Radishes & Knives" ni "Grapes & Fireworks") ni coincide con los 342 temas de la
base. Orden **obligado**: es un calendario, y leerlo salteado rompe la deuda que
lo cruza.

**Evidencia.** El corpus espanol son 60 frases escritas de 52 solicitantes, pero
ninguna habla de Navidad: citar por tema repartiria cuatro frases entre siete
temas, que es el anti-patron que el porton prohibe. Van en **modo journey-level**,
declarado. Salida en seco de `assertTopicsGrounded` (pasa):

```
MODO JOURNEY-LEVEL · 4 persona(s) detras de todo el journey
  <- He lives with his grandmother who only speaks Spanish, I want to have my own conversations with her
  <- To help learn Spanish to be able to talk to my family
  <- to learn mexican spanish
  <- I really enjoy story-based learning to maintain and practice my level of Spanish
```

Lectura honesta: las citas sostienen el SUELO (espanol mexicano, hablar con la
familia de alguien). Los siete dominios salen del calendario, no de las citas;
lo que escribieron los beta es pista, no filtro.

| # | Tema (slug) | Fecha | Nuevo | Arco del tema | Coste que no se devuelve |
|---|---|---|---|---|---|
| 1 | Hosting & Processions (`hosting-and-processions`) | 16-23 dic | - | Alondra se queda con las nueve posadas y descubre que el cargo es una lista de favores que no puede pagar; la primera noche nadie abre la puerta que tenia apalabrada y Ulises resuelve sin cobrarselo | las nueve noches de venta libre: su puesto cierra tarde y ella esta en la calle |
| 2 | Crafts & Contests (`crafts-and-contests`) | 23 dic | Perla | La Noche de Rabanos: Alondra entra al concurso para que le den un lugar en el zocalo, no por la figura; Perla le trae los rabanos y descubre para que los queria | el lugar del zocalo se lo dan a Perla, y Alondra se queda con la figura |
| 3 | Feasts & Toasts (`feasts-and-toasts`) | 24 dic | Gerardo | Nochebuena en casa de Alondra, con Gerardo cocinando fiado; el brindis se le atora porque el barrio le agradece algo que ella no hizo por ellos | le paga a Gerardo con flor, no con dinero: la flor que tenia apartada para el 25 |
| 4 | Visits & Leftovers (`visits-and-leftovers`) | 25-30 dic | Mayra | El recalentado, casa por casa; Mayra le pinta un letrero nuevo al puesto sin que se lo pida y Alondra entiende que el barrio la esta tratando como suya | dos dias de venta perdidos yendo de casa en casa, y no puede negarse |
| 5 | Luck & Superstitions (`luck-and-superstitions`) | 31 dic | Saul | Azotea, medianoche, las uvas y los propositos; Saul sube mezcal y hace la pregunta directa; Alondra dice su proposito en voz alta y miente | Ulises la oye mentir y deja de cubrirla |
| 6 | Bakeries & Sharing (`bakeries-and-sharing`) | 6 ene | Brenda | La rosca de Brenda: a Alondra le toca el muneco y lo esconde en la servilleta; la panaderia lleva cuenta de quien saco cuantos, y Brenda lo sabe | la palabra: por primera vez el barrio duda de ella |
| 7 | Debts & Payback (`debts-and-payback`) | 2 feb | Aldo | Candelaria: Alondra encarga a Aldo los tamales de todo el barrio y los paga con la ganancia entera de la temporada; no lo anuncia y Ulises no se entera hasta el final | el margen del ano. Cierre sin gancho: reparte los tamales y abre el puesto el lunes con lo justo |

## 6. Vocabulario

### Forma

- **20 a 22 plazas por historia**: 12 a 14 portables y **hasta 8 ancladas**. La
  banda de ancladas puede estirarse a 30% cuando la palabra es ancla cultural;
  este journey la usa entera y se declara.
- **El ancla de cada historia va SIEMPRE en el vocab.** En un journey de Navidad
  esa regla es el journey: si posada, villancico, ponche, rabano, recalentado,
  muneco o atole no ocupan plaza, no queda nada que ensenar que no ensene ya
  otro journey.
- **Solape:** el cero se aplica a lo ANCLADO. Aqui es facil y es la buena
  noticia del plan: de las anclas navidenas medidas, **ninguna esta entre las
  4642 plazas ya ensenadas en espanol**. Cultural ademas no tiene journey
  hermano, asi que `vocab-taught-same-type` arranca vacio; solo aplica el tope
  cruzado de 2 por historia de `vocab-taught-elsewhere`.
- **No hay capa portable heredada.** Es el primer peldano de su tipo: no hay
  nivel anterior del que recircular. La escalera de este journey es solo interna.
- Nunca cognados transparentes (pinata y tamal ya son palabras inglesas: van en
  el texto, nunca en plaza) ni universales.

### El techo de lista, medido antes de escribir

Medido con `isSpanishUpToLevel(w, 'b1')` sobre 55 anclas candidatas y sobre el
campo de los siete temas:

| Bloque | En lista B1 | Fuera de lista |
|---|---|---|
| Anclas navidenas mexicanas | 17 de 55 (cana, pavo, bacalao, proposito, muneco, vela, farol, rosca, tamal, corona, mole, uva, santo, fonda, puesto, propina, quincena) | 38 (posada, pinata, colacion, ponche, tejocote, aguinaldo, villancico, peregrino, letania, nacimiento, pesebre, Nochebuena, romeritos, recalentado, brindis, cohete, esfera, adorno, heno, musgo, atole, Candelaria, compadre, padrino, arrullar, peregrinacion, alcancia, ofrenda, pozole, bunuelo, sidra, guirnalda, misa, rezo, vecindad, azotea, tianguis, marchante) |

**Consecuencia, dicha sin adornos:** el lexico que da identidad a este journey
esta fuera de la lista de nivel casi entero, y no va a entrar nunca, porque la
lista es de frecuencia general. Esas plazas pasan por la exencion de ancla
cultural via `register`, que es para lo que existe. **El presupuesto es: como
mucho 8 plazas fuera de lista por historia, todas ancla, y las 12 a 14 restantes
dentro de la lista B1.** Si una historia pide una novena, sobra un hecho de la
escena, no se estira el presupuesto.

### Campo por tema

Medido el 2026-09-16 con `scripts/_esNavidad/vocab.ts`. **Ocupada** = ya es plaza
en otro journey espanol (cuenta contra el tope de 2 por historia).

| # | Ancla libre (plaza, fuera de lista) | Portable libre en lista B1 (plaza) | Ocupada por otro journey ES (solo texto, o 2 como mucho) |
|---|---|---|---|
| 1 | posada, peregrino, letania, villancico, ponche, colacion, anfitrion, hospedar, cortejo, rezo, alojar, vecindad | invitacion, apuntarse | vela, farol, negar, recibir, fila, techo, turno, callejon, patio |
| 2 | rabano, tallar, marchitarse, pulso, tallado, artesania, descalificar, zocalo | navaja, concurso, jurado, exhibir, inscribirse, carpa | figura, premio, puesto, fila, madrugar, montar, delicado, competir, plazo, mano |
| 3 | romeritos, recalentar, cabecera, porcion | pavo, bacalao, platillo, copa, salud, discurso, sentar | brindis, cena, sobremesa, guiso, servir, agradecer, mantel, sobrar, repartir, horno, sazon, probar, apurarse |
| 4 | recalentado, sobras, cunado, anfitriona, quedar mal, generoso | visita, tacaño, banqueta | llevar, compromiso, despedirse, cargar, porton, saludo, pretexto, excusa |
| 5 | cohete, ano viejo, quemar, burlarse, supersticion, medianoche, vuelta a la manzana | proposito, maleta, suerte, ritual, fallar | uva, deseo, cabala, abrazo, apagar, encender, creer, cumplir, prometer |
| 6 | charola, sorteo, tramposo, fingir | rosca, muneco, rebanada, cuchillo, suerte | panaderia, horno, partir, tocar, esconder, trampa, turno, fila, encargo, masa, azucar |
| 7 | atole, quedar bien, de buena fe, hacerse cargo, temporada, a medias | tamal, organizar, perdonar, ganancia | deuda, cumplir, pagar, palabra, compromiso, cobrar, saldar, excusa, plazo, confianza |

**Lo que cuesta este reparto, medido.** De las 156 candidatas de escena, 46 son
ancla libre y 33 portable libre en lista; **77 ya son plaza de otro journey
espanol**. Cada historia necesita de 12 a 14 portables y el tema no deja repetir
plaza entre sus tres historias: **el cuello de botella de este journey no son las
anclas, son las portables**, porque 4642 plazas de espanol ya estan gastadas. La
capa portable habra que buscarla fuera del campo obvio de cada tema, en el
registro emocional y de trato (la banda que entra justo en B1). Riesgo a vigilar
desde el tema 1: `vocab-taught-elsewhere` y `journey-vocab-worth-teaching`.

### Recirculacion interna, planificada desde el tema 1

Suelo B1 del gate: media 1,2 y cola 80%, y el propio codigo lo marca como
PROVISIONAL. **Objetivo del plan: media 2,0 o mas, cola 60% o menos**, que es la
banda de los C1 publicados, no el suelo.

1. **Toda portable nueva entra como muy tarde en la historia 15** (tema 5). Los
   temas 6 y 7 gastan sus plazas en ancladas de su campo y portables reabiertas.
2. **Objetos de la espina que viajan por las 21 en el texto:** la flor de
   nochebuena, el mandil azul, la lista de las nueve casas, el foco fundido del
   callejon, el letrero del puesto (desde el 4), el muneco (desde el 6) y la
   frase "es que asi se hace aqui".
3. **Reensenanza acotada** en los temas 6 y 7: solo portables de los temas 1 a 3,
   a 6 historias o mas de distancia, como mucho 4 por historia.
4. **Palabras gramaticales nunca como plaza.**
5. Lista de reencuentro obligatoria (portable de entrada -> temas donde vuelve en
   el cuerpo), que se copia al JSON de plan de cada tema:

| Palabra (tema de entrada) | Vuelve en |
|---|---|
| apuntarse (1) | 4, 7 |
| invitacion (1) | 3, 6 |
| hospedar (1) | 4 |
| inscribirse (2) | 6 |
| concurso (2) | 6, 7 |
| discurso (3) | 5, 7 |
| platillo (3) | 4, 7 |
| tacano (4) | 6 |
| banqueta (4) | 5, 7 |
| proposito (5) | 6, 7 |
| fallar (5) | 6, 7 |
| rebanada (6) | 7 |
| ganancia (7) | cierre |

Un aviso sobre un gate que va a pasar por el motivo equivocado:
`journey-vocab-level-floor` pide que el 30% de las plazas este por encima de
A1/A2, y cuenta como "de nivel" toda plaza que no este en la lista A1/A2. Las
anclas navidenas no estan en ninguna lista, asi que el suelo se cumple solo. **No
cuenta como prueba de que el journey sea B1**; lo que lo prueba es la banda de la
seccion 7 y la lectura.

## 7. Banda gramatical B1 (vara externa)

Vara externa: el inventario B1 del Plan Curricular del Instituto Cervantes. La
sonda del proyecto (`scripts/_gramProbe.ts`) mide tres marcadores por 100
oraciones, y la banda B1 aceptada es **subjuntivo imperfecto 1-4, condicional
1-5, estilo indirecto 1-3**. Con 35-47 oraciones por tema eso es 1 subjuntivo
imperfecto, 1 o 2 condicionales y 1 estilo indirecto por tema.

**Lo que hace B1 a este journey:**
- Contraste indefinido / imperfecto sostenido: el calendario obliga a contar lo
  que pasaba todos los anos frente a lo que paso esta vez.
- Presente de subjuntivo en subordinadas frecuentes (quiero que, espero que,
  cuando + subjuntivo, para que), sin banda propia.
- Condicional de cortesia y de consejo, 1 o 2 por tema.
- Estilo indirecto en pasado, 1 por tema ("le habia pedido que...").
- Periifrasis: ir a, estar + gerundio, tener que, hay que, acabar de, volver a,
  ponerse a.

**Fuera de banda (B2 o mas):** pluscuamperfecto de subjuntivo, condicional
compuesto, futuro perfecto, pasiva con ser, estilo indirecto encadenado. El
subjuntivo imperfecto solo en la dosis de la banda, nunca como recurso de estilo.

- Mediana de 11 a 14 palabras por oracion.
- Voseo prohibido (`body-voseo-forms`): Oaxaca es tuteo.
- Comillas curvas. Sin guion largo en ningun archivo del repositorio.

Caveat: el gate de banda no esta en `main` (vive en `da6876e8` y solo con fila
B2), asi que el paso es correr la sonda por tema a mano antes de `cierraTema`.

## 8. Bloqueos de codigo conocidos (estado 2026-09-16)

1. **Banco de nombres `spanish/mexico`: NO existe.** Los 8 del reparto van a
   salir con aviso `character-names-unverified`. No bloquea; se declara.
2. **El juez CEFR espanol no lematiza y su cache esta vacia.** `body-level-frequency`
   va a sobreestimar entre 5 y 10 puntos con preteritos, gerundios y cliticos
   pegados. Al medir, mirar la lista de marcas una por una antes de tocar el texto.
3. **El gate de banda gramatical no esta en main.** Sonda a mano por tema.
4. **La columna Escalera de `journeysTable.ts` infravalora** (mide tokens y mete
   las ancladas). La cifra que manda es la de `journey-vocab-recirculation`.
5. **El suelo de recirculacion B1 es provisional** (1,2 / 80%). Este journey
   apunta a 2,0 / 60% y sus numeros sirven para recalibrarlo.
6. **La regla "nativos de la variante" sigue sin gate.** Aqui se cumple por
   diseno: los ocho son mexicanos.

## 9. Proceso por tema (fase 2, solo tras aprobacion)

Paso previo, una vez: script de scaffolding calcado del que uso el IT A1
(`assertLadderContiguous`, `assertTopicsGrounded` journey-level,
`assertJourneyType`), primero con `--dry`. Crea la fila `Journey`, los 7 temas y
los 21 huecos. Nada mas.

Por tema, del 1 al 7:
1. `npx tsx scripts/rulesFor.ts story vocab journey` y
   `npx tsx scripts/journeysTable.ts --journey <id>`.
2. Plan JSON del tema: registro, espina, recursos, y por historia que quiere,
   que se lo impide, que le cuesta y que cambia, mas la lista de reencuentro.
3. Esqueleto con el golpe emocional, despues prosa; las tres historias en un JSON.
4. `npx tsx scripts/saveStory.ts <data.json> --journey <id> --lang ES --level b1
   --variant mexico --narrador --dry`, y solo despues sin `--dry`.
5. Sonda de banda gramatical del tema.
6. `npx tsx scripts/cierraTema.ts`, escalera acumulada, y reporte a
   Journey-planning-2 con `verified:` y `not verified:`.

Al final de los siete: lectura seguida de las 21 buscando plantillas repetidas en
3 o mas historias. Audio, portadas, glosas y practica van despues, y no entran en
este plan.

## 10. Decisiones que necesito de ti

1. Tipo **Cultural** (primer journey del tipo en todo el catalogo) en vez de
   Friends, y la lectura de "lugares varios" como siete escenarios de una ciudad.
2. Variante **mexico** en vez de **latam** generico, y **Oaxaca de Juarez** como
   ciudad.
3. Nivel **B1**.
4. Journey normal, vivo todo el ano, publicado en la primera quincena de
   noviembre, sin maquinaria estacional.
5. Los siete temas, su orden obligado y la espina de las posadas prestadas.
6. Alondra y Ulises como fijos, y el reparto de la seccion 3.
