# Plan: Cultural ES/LATAM B1 (siete tradiciones, siete paises)

Estado: PROPUESTA v2 del 2026-09-16, pendiente de aprobacion de Journey-planning-2.
Sustituye a la v1 (Navidad en Oaxaca, variante mexico), reencuadrada por el
usuario: **el journey no es de Navidad, es de TRADICIONES, y la Navidad es una
de las siete.** Asi no muere en enero y la campana de diciembre conserva su tema.
Fuera de este plan: fila `Journey`, temas en la base, historias, audio, portadas,
glosas, practica, push y correos.

Se mantiene de la v1: tipo **Cultural** y nivel **B1**. Cambia la variante a
**latam** y con ella la ciudad, el reparto, la espina, los siete temas y todo el
vocabulario.

## 0. Estado comprobado antes de planear

Medido el 2026-09-16 desde un worktree de `origin/main` (8c1c2daf).

| Comprobacion | Resultado |
|---|---|
| `journeysTable.ts --idioma spanish` | 13 live + 4 draft. Ninguno Cultural |
| `JourneyType` en la base | 8 tipos; `cultural` existe y **ningun journey lo usa**, en ningun idioma |
| `assertLadderContiguous` Cultural spanish/latam b1 (en seco) | **pasa** (primer peldano del tipo) |
| `assertTopicsGrounded` journey-level, los 7 temas nuevos (en seco) | **pasa**; 4 personas detras, sobre 60 frases escritas |
| Slugs y labels de los 7 temas en `Topic` (342 filas) | los 7 libres |
| Nombres ocupados en el texto de los 17 journeys ES | 117 extraidos; los 8 de este plan no estan |
| Plazas de vocab ya ensenadas en espanol live+draft | **4642 palabras distintas** |
| Headroom real de las listas | A1/A2: 1122 de 2731 lemas libres (41%). **B1: 1718 de 2664 libres (64%)** |
| Sonda del validador canonico con anclas `register: "cultural"` | **`vocab-level-frequency` PASA**; `body-level-frequency` 15,5%, pasa |
| Banda de palabras B1 | **140-166** (`bodyWordBand.ts`), no 210-260: corregido respecto a la v1 |
| Banco de nombres `spanish/latam` | existe (10 jovenes, 4 mayores); ninguno de los 8 de este plan esta dentro |

Scripts de solo lectura en `scripts/_esNavidad/`: `dump.ts`, `beta2.ts`,
`ladder.ts`, `ground2.ts`, `slugs2.ts`, `nombres2.ts`, `vocab2.ts`,
`headroom.ts`, `rivales.ts`, `chk.ts`, `sonda.ts`.

## 1. Forma

| Campo | Valor |
|---|---|
| Tipo | Cultural (`typeSlug` cultural), `Journey.name` = "Cultural", spanish / latam, b1, 1x7x3 |
| Estilo | narrador, una voz, habla citada dentro de la prosa, banda 25-30% de citado |
| Largo | **140-166 palabras** por cuerpo (banda del spec para B1; fuera de ella el check FALLA, sin tramo de aviso) |
| Sinopsis | 45-90 palabras |
| Parrafos | 4, 5 o 6, distinto entre las tres historias de cada tema |
| `arcType` | solo de la lista valida: reframe-turn, juxtaposition-discovery, harmonic-close, mini-cliffhanger, recurring-character-callback, late-reveal, daily-encounter |
| Lugares | siete paises, uno por tema. Es Cultural de manual: lugares varios, cada tradicion donde ocurre |
| Fijos | 2: Alondra (en las 21) y Ulises (viaja en 3 temas, mencionado o al telefono en el resto) |
| Nuevos | 1 por tema, del **tema 2 al 7**, local de ese pais, presentado en la primera historia del tema. El tema 1 solo lleva fijos (`journey-cast-first-story-only-fixed`) |
| Hablan por historia | 2, como mucho 3 |
| Definiciones de vocab | 8 a 14 palabras, 120 caracteres como mucho |
| Ancla sensorial | obligatoria en cada cuerpo (`narrator-sensory-anchor`): una categoria, no cinco |
| Orden | libre segun el plan de tipos, pero se propone **fijarlo por calendario** (enero a diciembre) para que el ultimo tema sea la quema de fin de ano |

## 2. Los siete temas

Nombres de DOMINIO: ingles, ampersand, 2-4 palabras, sin pais, Title Case, slug
derivado, `isUniversal: false`. Ninguno nombra el objeto de la fiesta (ni
"Radishes & Knives" ni "Grapes & Fireworks"): nombra el acto social que la
fiesta obliga a hacer, que es lo que el alumno va a necesitar decir.

Salida en seco de `assertTopicsGrounded` (pasa, modo journey-level, 4 personas):
las citas sostienen el suelo del journey (espanol de LATAM, hablar con la familia
de alguien); los siete dominios salen de las tradiciones, no de las citas. Lo que
escribieron los beta es pista, no filtro.

| # | Tema (slug) | Pais y sitio | Tradicion y epoca | Nuevo |
|---|---|---|---|---|
| 1 | Wishes & Bargaining (`wishes-and-bargaining`) | La Paz, Bolivia | la Alasita, 24 de enero: todo se compra en miniatura y para otro | (solo fijos) |
| 2 | Turns & Belonging (`turns-and-belonging`) | Montevideo, Uruguay | las Llamadas de candombe, febrero: la cuerda de tambores del barrio | Mayra |
| 3 | Vigils & Waiting (`vigils-and-waiting`) | Antigua, Guatemala | las alfombras de aserrin de Semana Santa, marzo o abril | Saul |
| 4 | Weight & Endurance (`weight-and-endurance`) | Santa Elena, Colombia | los silleteros de la Feria de las Flores, agosto | Brenda |
| 5 | Stalls & Crowds (`stalls-and-crowds`) | Chile central | las Fiestas Patrias, 18 de septiembre: la ramada y el volantin | Gerardo |
| 6 | Hosting & Processions (`hosting-and-processions`) | Ciudad de Mexico | las posadas, del 16 al 24 de diciembre. **La navidena** | Perla |
| 7 | Endings & Forgiveness (`endings-and-forgiveness`) | Guayaquil, Ecuador | el Ano Viejo, 31 de diciembre: el monigote y su testamento | Aldo |

**El calendario latinoamericano se agolpa en verano austral y en Semana Santa, y
no lo disimulo:** de las siete, cuatro caen entre enero y abril. El orden por
calendario se elige igual porque coloca la navidena en el sexto peldano (que es
donde la campana de diciembre la quiere) y deja el cierre en una hoguera.

## Decision del 2026-09-17: los siete temas se rehacen, una tradicion por pais

El usuario cambia el criterio de los siete temas. Ya no son siete capas
portables envueltas en siete tradiciones: son **las tradiciones mas conocidas
fuera de LATAM, una o dos por pais, y solo de paises donde ya hay voz**. Navidad
y Ano Nuevo entran por nombre propio, que fue la peticion literal.

| # | Pais | Tradicion | Voz de pais aprobada | Tema escrito que sirve |
|---|---|---|---|---|
| 1 | Mexico | **Navidad**: las posadas, 16 al 24 de diciembre | si, Cesar Barona (MX) | si, `hosting-and-processions` |
| 2 | Mexico | Dia de Muertos, 1 y 2 de noviembre | si | no |
| 3 | Colombia | **Ano Nuevo**: el muneco de Ano Viejo, 31 de diciembre | si, Hernando (CO) | no |
| 4 | Colombia | Feria de las Flores, los silleteros, agosto | si | si, `weight-and-endurance` |
| 5 | Peru | Inti Raymi, Cusco, 24 de junio | si, Terry (PE) | no |
| 6 | Peru | el Senor de los Milagros, Lima, octubre | si | no |
| 7 | Chile | Fiestas Patrias, el 18 de septiembre | **no**, solo voces LATAM genericas | si, `stalls-and-crowds` |

Lo que se cae y por que:

- **Bolivia (Alasita), Uruguay (las Llamadas), Guatemala (Semana Santa) y
  Ecuador (el Ano Viejo)**: fuera del criterio de "pais principal con voz". El
  Ano Viejo no se pierde como material, se muda a Colombia, que quema el mismo
  muneco el 31.
- **Argentina**: no tiene ninguna fiesta con fecha que se conozca fuera. Lo
  reconocible de Argentina (tango, mate, asado, futbol) no es una celebracion, y
  el asado en particular es comida diaria. Se probo la Vendimia de Mendoza y el
  usuario la descarto por desconocida. Argentina queda fuera y Peru y Mexico
  repiten.
- **Cinco de Mayo**: se celebra sobre todo en Estados Unidos, en Mexico casi
  solo en Puebla, y ademas Mexico ya lleva Navidad y Dia de Muertos.

Coste medido sobre lo que hay: de los siete temas escritos **sobreviven tres**
(Navidad, silleteros y Fiestas Patrias) y hay que rehacer **cuatro temas, doce
historias**. Las tres que sobreviven conservan su slug, su texto y su cierre.

Pendiente antes de tocar la base:

1. Nombres de tema nuevos para los cuatro que entran, con la regla de siempre
   (etiqueta en ingles, 2 a 4 palabras, sin pais, un slug igual a un label
   global) y libres en las 342 filas de `Topic`.
2. `assertTopicsGrounded` sobre los siete, que exige una motivacion literal de
   un usuario por tema.
3. Voz de Chile, o narrar el 18 con una voz LATAM generica. El audio va al final
   del journey, asi que no bloquea el texto.
4. Las glosas que se esten construyendo en `claude/es-b1-cultural-glosas` se
   quedan viejas para las doce historias que se rehagan.


### En que se diferencia cada tema de lo que ya se ensena

Los dos rivales reales, medidos leyendo su vocab:

- **"Community & Celebrations"** (Traveler latam A0, 74 plazas) es un carnaval
  visto desde la acera por alguien que mira: barrio, disfraz, plumas, tambores,
  desfile, bailar, vecinos, abuelo. Es el lexico del ESPECTADOR.
- **"Faith & Devotion"** (Traveler latam B1, 60 plazas) resulto estar mas cerca
  de lo que parecia: es un taller preparando UNA procesion (lijar, bastidor,
  cofradia, terciopelo, coser, hilo, cera, cargador, retablo, bordar, mayordomo,
  velon). Es el lexico del ARTESANO devoto.

Este journey no es ninguno de los dos: es el de **quien negocia con la fiesta
desde fuera y siempre pierde la pieza**. Por tema:

| # | En que se diferencia |
|---|---|
| 1 | Ni espectaculo ni taller: es un regateo. El campo es precio, trato, deseo y la regla de que el deseo lo paga otro |
| 2 | Frente al desfile del A0, aqui el campo es quien ENTRA en la cuerda: turno, orden de la fila, pertenecer, que te acepten o no |
| 3 | Frente al taller devoto del B1, aqui lo hecho se destruye al amanecer por diseno: velar, turnarse, aguantar, que lo tuyo se pise |
| 4 | El campo es el cuerpo que carga y la tierra que lo produce: peso, ladera, abono, entrenar. Nada de esto es fiesta vista desde la acera |
| 5 | Lo unico que roza el A0 es que hay gente. El campo es el permiso, la carpa, la multitud y la venta: la fiesta como negocio temporal |
| 6 | La posada es pedir alojamiento y que te lo nieguen, puerta por puerta. Campo de hospedaje y de negativa, no de celebracion |
| 7 | El campo es cerrar cuentas: testamento, perdonar, deuda, despedir, quemar. Ninguno de los dos rivales lo toca |

## 3. Reparto: dos fijos que pueden estar en los siete sitios

El problema del tipo Cultural es este y hay que resolverlo, no esquivarlo: siete
lugares con dos personajes que tienen que salir en las 21 y en mas de la mitad.
La solucion aqui es **un oficio que obliga a viajar y una razon para hacerlo este
ano**:

- **Alondra** vende artesania de fiesta en el mercado de La Paz, y compra donde
  se hace la pieza. Viajar es su trabajo, no un capricho. Sale en las 21.
- **Ulises** arregla lo que llega roto y tiene el taller al lado del puesto.
  **Viaja con ella en los temas 2, 4 y 7** (las tres piezas que no se transportan
  solas: el tambor, la silleta y el monigote) y en los otros cuatro esta al
  telefono, en lo que ella sabe que el diria, y en las cajas que le manda. El
  plan de tipos dice literal que las menciones valen, asi que el minimo de la
  mitad se cumple con margen y sin convertir el journey en una caravana de dos.

Los ocho son latinoamericanos, que es lo que pide la regla de nativos de la
variante (variante = latam). Ninguno de los 8 nombres sale en el texto de los 17
journeys espanoles live+draft (117 nombres extraidos y contrastados), ni esta en
el banco `spanish/latam`. Todos adultos en activo, 31 a 40 anos.

| Nombre | Rol | Edad | Pais | Ficha fija | Presentacion | Forma | Tema |
|---|---|---|---|---|---|---|---|
| **Alondra** | protagonista, en las 21 | 34 | Bolivia | pelo negro en trenza, sin fleco; chaleco de lana gris | "Alondra, una vendedora de artesania de fiesta," | aposicion | todos |
| **Ulises** | fijo; arregla lo que llega roto | 36 | Bolivia | pelo corto con canas en las sienes, sin barba; camisa de mezclilla | "Ulises es el hombre que arregla lo que llega roto al mercado" | con ser | todos |
| Mayra | nueva; hace y afina lonjas de tambor | 33 | Uruguay | pelo rizado recogido con panuelo naranja; camiseta blanca sin mangas | "En el galpon esta Mayra, una lonjera del barrio" | tras el lugar | 2 |
| Saul | nuevo; tine el aserrin de las alfombras | 31 | Guatemala | pelo lacio hasta la nuca, bigote fino; delantal de hule verde | "Saul, un tenidor de aserrin," | aposicion | 3 |
| Brenda | nueva; siembra las flores y carga la silleta | 38 | Colombia | pelo castano corto; sombrero de paja y camisa a cuadros | "Brenda es silletera de Santa Elena" | con ser | 4 |
| Gerardo | nuevo; hace volantines y atiende la ramada | 40 | Chile | cabeza rapada, barba corta; chaleco azul de tela | "En la ramada esta Gerardo, un volantinero" | tras el lugar | 5 |
| Perla | nueva; pinatera de un taller de barrio | 36 | Mexico | pelo negro largo suelto; blusa amarilla con manchas de engrudo | "Perla, una pinatera del barrio," | aposicion | 6 |
| Aldo | nuevo; arma monigotes de Ano Viejo | 35 | Ecuador | pelo corto ondulado, barba de tres dias; camiseta gris de tirantes | "Aldo es el que arma los monigotes de la cuadra" | con ser | 7 |

Formas: aposicion 3, con ser 3, tras el lugar 2. Cuatro mujeres y cuatro hombres.

**Ni ninos ni ancianos.** Se sostiene por el mismo giro que la v1: el journey mira
a **quien HACE la fiesta**, no a quien la recibe. Los ocho son oficios. Las
familias existen fuera de cuadro y se mencionan; no hablan.

**Trampa del voseo, declarada.** `RIOPLATENSE_SETTING` se activa con las palabras
Argentina, Uruguay, Montevideo, Buenos Aires, Rosario, La Plata o Cordoba en el
cuerpo. En el tema 2 eso es correcto y deseado: **Mayra vosea y Alondra sigue en
tu**, y con una sola forma de voseo presente el candado inverso
(`body-missing-voseo`) no salta. El riesgo es el contrario: **una historia de
otro tema que mencione Uruguay o Argentina de pasada activa el setting y pasa a
exigir voseo**. Regla para el ejecutor: fuera del tema 2, esos siete nombres
propios no se escriben.

## 4. Espina (no depende del calendario)

El mercado de La Paz donde Alondra tiene su puesto se remodela y los puestos de
artesania se quedan en la mitad. Le ofrecen uno de los grandes con una condicion:
que demuestre que trae lo que nadie mas trae. **Siete piezas de siete fiestas,
cada una hecha por quien la hace.** Alondra acepta y sale a buscarlas.

Fiesta por fiesta descubre lo mismo por siete caminos distintos: **la pieza que
busca esta hecha para no durar.** La miniatura de la Alasita solo sirve si te la
regalan; el tambor pertenece a la cuerda y no se vende; la alfombra de aserrin se
hace de noche para que la pisen al amanecer; la silleta se carga una vez; el
volantin se corta en el aire; la pinata se rompe; el monigote se quema.

La pregunta del journey: **lo que se hace para una fiesta sigue siendo lo mismo
cuando se saca de ella?**

En el tema 7 le ofrecen el monigote y ella lo compra, y lo quema con los demas.
Vuelve a La Paz sin la septima pieza y con seis telefonos. Lo que le salva el
puesto no es una coleccion: es poder traer lo que se hace ESTE ano, hecho por
gente con nombre. La pieza no se queda; la relacion si.

Cada tema le cobra algo, y siempre algo que ella habia contado como ganancia:

| # | Lo que quiere | Lo que se lo impide | Lo que le cuesta y no vuelve |
|---|---|---|---|
| 1 | un ekeko cargado para el puesto | en la Alasita nadie compra para si mismo | la pieza que encuentra acaba en el bolsillo de Ulises |
| 2 | un tambor de lonja vieja | el tambor es de la cuerda, no de quien lo toca | paga la lonja nueva de Mayra y se vuelve con un tambor sin voz |
| 3 | una alfombra entera, fotografiada antes del amanecer | la alfombra se hace para que la pisen | dos noches sin dormir y el molde que Saul le regala, que no es la alfombra |
| 4 | una silleta armada | la silleta se arma el dia y se deshace el mismo dia | carga una y se lesiona la espalda; no puede cargar cajas en dos meses |
| 5 | volantines para vender en Bolivia | el permiso de la ramada no es suyo y el viento se lleva el genero | el dinero del permiso, que pago a medias con Gerardo |
| 6 | una pinata de siete picos sin romper | la pinata sin romper no es una pinata, es un adorno | rompe la suya en la posada, delante de Perla, y se queda sin la pieza del tema navideno |
| 7 | el monigote, la septima pieza | el monigote existe para arder a medianoche | lo quema. Cierre sin gancho: vuelve con seis telefonos y el puesto grande |

Diferencia con las espinas vigentes: nadie se muda de ciudad, no hay pacto
amoroso, no hay familia que reunir. Lo que esta en juego es un puesto de mercado
y una idea equivocada de lo que se puede comprar.

## 5. Vocabulario

### Forma

- **20 plazas por historia**: 13 portables y **hasta 7 ancladas**. Minimo 2 de
  tipo `expression`.
- **Cada ancla lleva `register: "cultural"`**, nunca `type`. Es lo que la exime
  de `vocab-level-frequency`, y esta comprobado (seccion 5.3).
- El ancla cultural de la historia va SIEMPRE en el vocab.
- 3 a 5 plazas por parrafo y ningun parrafo con mas del 30% de las plazas.
- Nunca cognados transparentes (candombe, pinata, cueca ya son palabras inglesas
  o casi: van en el texto, no en plaza) ni universales.
- **No hay capa portable heredada**: es el primer peldano de su tipo.

### 5.2 El techo de lista y el solape, medidos con la mezcla de siete paises

210 candidatas de escena, 30 por tema, medidas contra la lista B1 y contra las
4642 plazas ya ensenadas en espanol:

| Bloque | Numero |
|---|---|
| Ancla libre, fuera de lista (entra por `register: "cultural"`) | **59** |
| Portable libre y dentro de la lista B1 | **30** |
| **Ya es plaza de otro journey espanol** | **121 (58%)** |

Por tema, lo libre:

| # | Ancla libre (plaza, fuera de lista) | Portable libre en lista B1 |
|---|---|---|
| 1 | alasita, ekeko, challar, serpentina, miniatura, bendecir | yeso, alcohol, abogado |
| 2 | candombe, comparsa, lonja, afinar, sudar, marchar, hacer lugar | tambor, cuerda, pertenecer, apuntarse, cuero, ritmo, golpe |
| 3 | aserrin, tenir, incienso, turnarse, vecindario, petalo, toda la noche | molde, plantilla, procesion, pisar, cafe, diseno |
| 4 | silleta, silletero, sembrar, abono, tallo, sin quejarse | finca, ladera, jurado, entrenar, sudor, terreno |
| 5 | volantin, encumbrar, cueca, ramada, municipalidad, multitud, enredar, zapatear, se lleno | curado, carpa, bandera |
| 6 | posada, peregrino, letania, villancico, ponche, colacion, pinata, anfitrion, hospedar, alojar, vecindad, rezo, cortejo, de casa en casa, no hay lugar | invitacion, apuntarse |
| 7 | monigote, testamento, quemar, aserrin, mascara, ano viejo, viuda, despedir, medianoche | muneco, relleno, perdonar |

**El cuello de botella, dicho sin adornos.** Las anclas sobran: 59 libres para 7
temas es mas de lo que caben. **Las portables de escena no llegan ni de lejos**:
30 libres frente a las 273 plazas portables que pide el journey (21 x 13). El
vocabulario obvio de cada escena ya lo gastaron el Traveler y el Friends.

**Y aun asi cabe, si se busca donde toca.** Medido: de los 2664 lemas de la lista
B1, **1718 siguen libres (64%)**, y 1122 mas en la A1/A2. Headroom total 2840
frente a 273. Lo que dice el numero es que **la capa portable de este journey no
puede salir del campo de la escena, tiene que salir del registro**: el B1 libre
esta lleno de la banda emocional y de trato que ningun journey espanol ha tocado
(frustracion, decepcion, nostalgia, compasion, celos, indignacion, melancolia,
desilusion), que es exactamente la banda de un journey sobre soltar lo que
compraste. **Riesgo a vigilar desde el tema 1:** `vocab-taught-elsewhere` (tope
de 2 por historia) y `journey-vocab-worth-teaching`. Cada plaza se comprueba
contra las 4642 ANTES de escribir, con `scripts/_esNavidad/vocab2.ts`.

### 5.3 La exencion de ancla cultural, comprobada (no supuesta)

Se paso una historia sonda por **el validador canonico en proceso**
(`validateGeneratedStory`, el mismo que corre `saveStory`; no se pudo usar
`saveStory --dry` porque exige una fila `Journey` que todavia no existe). La
sonda es del tema 1, con 6 anclas marcadas `register: "cultural"` (alasita,
ekeko, challar, casera, serpentina, cuadra) y 14 portables de lista:

```
[PASS] vocab-level-frequency: (sin marcas)
[PASS] body-level-frequency: 11/71 (15,5%) del body fuera de B1
```

Dos cosas quedan probadas y una tercera medida:

1. **La exencion funciona.** Sin `register`, una version anterior de la misma
   sonda saco `[FAIL] vocab-level-frequency: 6 fuera de B1: miniatura (C2),
   regatear (C2), liga (C2), fajo (C2), comerciante (C2), diminuto (C2)`. Esas
   seis no son anclas: son palabras corrientes que NO estan en la lista, y el
   juez las manda a C2 por defecto. **El gate no perdona lo que no es ancla**,
   que es justo lo que tenia que comprobarse.
2. **Las anclas en el CUERPO no tienen exencion** y cuentan en
   `body-level-frequency` (umbral: pasa por debajo de 25%, avisa hasta 40%,
   falla a partir de ahi). Con 6 anclas en 71 palabras de contenido dio 15,5%:
   hay margen, pero no para meter una novena ancla por historia.
3. **De las 11 marcas del cuerpo, 4 son falsos positivos** del juez sin
   lematizar (regateo, envolvio, advirtio, faltaba: los cuatro lemas SI estan en
   la lista). La carga real fuera de lista era ~7%.

La sonda vive en el scratchpad de la sesion, no en el repo: es un banco de
pruebas del gate, **no contenido del journey**.

### 5.4 Recirculacion interna

Suelo B1 del gate: media 1,2 y cola 80%, marcado PROVISIONAL en el propio codigo.
**Objetivo del plan: media 2,0 o mas, cola 60% o menos.**

1. Toda portable nueva entra como muy tarde en la historia 15 (tema 5).
2. Objetos de la espina que viajan por las 21 en el texto: el puesto del mercado,
   las siete piezas encargadas, la caja de madera en la que Ulises manda lo
   arreglado, el cuaderno donde Alondra apunta nombres, y la frase "esto no se
   vende".
3. Reensenanza acotada en los temas 6 y 7: solo portables de los temas 1 a 3, a 6
   historias o mas de distancia, 4 por historia como mucho.
4. Palabras gramaticales nunca como plaza.
5. La banda emocional (frustracion, decepcion, nostalgia, compasion) entra
   repartida entre los temas 1 y 4 y vuelve entera en el 7, que es el tema que la
   paga.

## 6. Banda gramatical B1 (vara externa)

Vara externa: el inventario B1 del Plan Curricular del Instituto Cervantes. La
sonda del proyecto (`scripts/_gramProbe.ts`) mide tres marcadores por 100
oraciones y la banda B1 aceptada es **subjuntivo imperfecto 1-4, condicional 1-5,
estilo indirecto 1-3**. Con 35-47 oraciones por tema: 1 subjuntivo imperfecto, 1
o 2 condicionales y 1 estilo indirecto por tema.

Lo que hace B1 a este journey: contraste indefinido / imperfecto sostenido (cada
tradicion es "lo que se hace siempre" contra "lo que paso esta vez"); presente de
subjuntivo en subordinadas frecuentes; condicional de cortesia y de consejo;
estilo indirecto en pasado; perifrasis (ir a, estar + gerundio, tener que, hay
que, acabar de, volver a, ponerse a).

Fuera de banda: pluscuamperfecto de subjuntivo, condicional compuesto, futuro
perfecto, pasiva con ser, estilo indirecto encadenado.

- Mediana de 11 a 14 palabras por oracion.
- Comillas curvas. Sin guion largo en ningun archivo.
- Voseo: solo en el tema 2 (ver seccion 3).

Caveat: el gate de banda no esta en `main`, asi que el paso es correr la sonda por
tema a mano antes de `cierraTema`.

## 7. Bloqueos y avisos conocidos (estado 2026-09-16)

1. **El juez CEFR espanol no lematiza y su cache esta vacia.** Medido en la
   sonda: 4 de 11 marcas del cuerpo eran formas de lemas que SI estan en la
   lista. Al medir, leer las marcas una por una antes de tocar el texto.
2. **El banco de nombres `spanish/latam` existe** pero ninguno de los 8 esta en
   el: aviso `character-names-unverified` en los 8. No bloquea.
3. **El gate de banda gramatical no esta en main.** Sonda a mano por tema.
4. **La columna Escalera de `journeysTable.ts` infravalora.** La cifra que manda
   es la de `journey-vocab-recirculation`.
5. **El suelo de recirculacion B1 es provisional** (1,2 / 80%); los numeros de
   este journey sirven para recalibrarlo.
6. **`journey-vocab-level-floor` pasara por el motivo equivocado**: cuenta como
   "de nivel" toda plaza fuera de la lista A1/A2, y las 7 anclas por historia lo
   cumplen solas. No prueba que el journey sea B1.
7. **La regla "nativos de la variante" sigue sin gate.** Aqui se cumple por
   diseno: los ocho son latinoamericanos.

## 8. Proceso por tema (fase 2, solo tras aprobacion)

Paso previo, una vez: script de scaffolding con `assertLadderContiguous`,
`assertTopicsGrounded` journey-level y `assertJourneyType`, primero con `--dry`.
Crea la fila `Journey`, los 7 temas y los 21 huecos. Nada mas.

Por tema, del 1 al 7:
1. `npx tsx scripts/rulesFor.ts story vocab journey` y
   `npx tsx scripts/journeysTable.ts --journey <id>`.
2. Plan JSON del tema: registro, espina, recursos, y por historia que quiere, que
   se lo impide, que le cuesta y que cambia, mas la lista de reencuentro.
3. Comprobar cada plaza candidata contra las 4642 con
   `scripts/_esNavidad/vocab2.ts` ANTES de escribir prosa.
4. Esqueleto con el golpe emocional, despues prosa; las tres historias en un JSON.
5. `npx tsx scripts/saveStory.ts <data.json> --journey <id> --lang ES --level b1
   --variant LATAM --narrador --dry`, y solo despues sin `--dry`.
6. Sonda de banda gramatical del tema.
7. `npx tsx scripts/cierraTema.ts`, escalera acumulada y reporte a
   Journey-planning-2 con `verified:` y `not verified:`.

Al final de los siete: lectura seguida de las 21 buscando plantillas repetidas en
3 o mas historias. Audio, portadas, glosas y practica van despues.

## 9. Decisiones que necesito de ti

1. Los siete paises y sus siete tradiciones, y el orden por calendario que deja la
   navidena en el peldano 6 y la quema en el 7.
2. Los siete nombres de tema.
3. Alondra y Ulises como fijos, con el oficio itinerante como respuesta al
   problema de los siete lugares, y los seis nuevos de la seccion 3.
4. La espina de las siete piezas encargadas y su final (entrega seis y quema la
   septima).
5. Que el tema 2 se escriba con voseo para Mayra, como asset y no como excepcion.
