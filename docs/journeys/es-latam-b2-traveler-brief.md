# Traveler ES/latam B2: brief

`Journey` **cmtpls1l20007j8epwgcs6e1h** · draft · 7 temas x 3 historias = 21
Peldano de abajo: Traveler ES/latam B1 (`cmtmylg7k0007321h6t7njesx`, draft),
que ya apunta aqui con `nextJourneyId`. B2 es el nivel siguiente para quienes
cursan el B1.

## Forma

Antologia, igual que el B1: **un protagonista y un secundario por tema**, cada
tema en otra ciudad y otro pais, sin reparto fijo que cruce el journey. Catorce
personas nuevas: **ninguna del A0, A1, A2 ni B1**.

- Todos los personajes son nativos del pais de su tema. El "Traveler" vive en
  la voz del narrador, que mira desde fuera: presenta a la gente y los sitios
  ("Ciudad, pais" con coma), explica lo que un local daria por sabido.
- **Reparto adulto: ni un nino ni un anciano**, ni hablando ni de fondo.
- Maximo 2 personajes hablando por historia.
- Narrador con acotacion, ~30% de habla citada, comillas curvas `“”`, cero
  guiones largos, definiciones de vocab en ingles.
- Cuerpo **115-170 palabras** (duro 100-190): la banda es UNA para todos los
  niveles; lo que sube con el nivel es la densidad, no el volumen.
- Se guarda con `--narrator` (exime solo los tres checks de formato de dialogo
  por turnos).
- Anclajes culturales con `register: "cultural"`, que los exime del eje de
  frecuencia del juez CEFR.
- **Voseo por pais del tema**: Buenos Aires y La Plata vosean; Guadalajara,
  Lima, Valparaiso, Cali y Aracataca no (tu/usted segun registro local).

## Recursos estilisticos (escalera 3ter del quality spec)

En B2 se abren: **ironia de personaje, subtexto de dialogo, aforismo de
personaje (cuentagotas), elipsis temporal y narrador con opinion**, mas todo lo
heredado de abajo. Sigue prohibido lo de C1: simbolo sin explicar, elipsis
sintactica, final abierto, ironia estructural. El remate de cada historia se
entiende a la primera.

## Los siete temas

| # | tema | pais | sitio | protagonista | secundario |
|---|---|---|---|---|---|
| 1 | Jokes & Double Meanings | mexico | Guadalajara, cantina de barrio | Renata, 31, atiende la barra | Joaquin, 34, cliente que albura |
| 2 | Negotiations & Courtesies | peru | Lima, taller de confeccion | Maricarmen, 38, duena del taller | Aurelio, 45, comprador de una tienda grande |
| 3 | Secrets & Silences | chile | Valparaiso, un cerro con ascensor | Marcela, 36, restaura fachadas | Ignacio, 40, maquinista del ascensor |
| 4 | Classes & Teachers | argentina | Buenos Aires, instituto de San Telmo | Griselda, 42, profesora de espanol | Ariel, 38, dueno del instituto |
| 5 | Fluency & Forgetting | colombia | Cali, barrio Obrero | Fabian, 37, vuelve tras 15 anos fuera | Yamileth, 35, su socia en el local |
| 6 | Partners & In-Laws | argentina | La Plata, rotiseria familiar | Emiliano, 33, mendocino, novio de la hija | Norma, 54, duena de la rotiseria |
| 7 | Tales & Tall Stories | colombia | Aracataca, el anden y el hospedaje | Baldomero, 48, cuenta historias del pueblo | Ofelia, 39, duena del hospedaje |

El pais lo pinta el eyebrow desde `LATAM_TOPIC_COUNTRY`
(`packages/domain/src/languageVariant.ts`).

## Arco de cada tema (continuidad entre las tres)

1. **Jokes & Double Meanings**: Joaquin le gana a Renata un duelo de albures
   delante de la cantina · ella prepara la revancha y pierde la propina del dia
   en la apuesta (coste) · gana con un doble sentido propio y descubre que
   Joaquin la dejo ganar, y los dos fingen que no.
2. **Negotiations & Courtesies**: Maricarmen aprende que "lo conversamos" era
   un no · en la segunda reunion cede el plazo y pierde a un cliente antiguo
   por priorizar el pedido grande (coste) · cierra el trato en un chifa y los
   dos saben quien cedio, y ninguno lo dice.
3. **Secrets & Silences**: Marcela ve la pieza gastada del ascensor e Ignacio
   minimiza · ella calla por el y pierde el encargo de pintar la estacion por
   avisar tarde (coste) · el ascensor para, el secreto sale, y lo que no se
   dicen se ve en el gesto.
4. **Classes & Teachers**: a Griselda le dicen que su metodo de cuentos no
   rinde · Ariel le quita el grupo de las mananas (coste) y ella no lo pelea ·
   una exalumna vuelve hablando como sus cuentos y Ariel le devuelve el grupo
   sin disculparse.
5. **Fluency & Forgetting**: a Fabian se le escapan las palabras y Yamileth lo
   corrige delante de gente · pierde el local que queria alquilar por no
   entender un giro (coste) · tres meses despues (elipsis temporal) suelta el
   refran justo en el momento justo.
6. **Partners & In-Laws**: Emiliano lleva el vino equivocado al primer almuerzo
   y Norma lo marca con ironia · arruina una tanda de milanesas ayudando un
   sabado y la paga (coste) · Norma le deja atender la caja, que es su manera
   de decirle que si.
7. **Tales & Tall Stories**: Ofelia contradice a Baldomero con hechos y los
   viajeros prefieren la mentira · la libreta de cuentos se moja en un
   aguacero y la pierde (coste) · una de sus historias resulta cierta y Ofelia
   le pide que cuente la del hospedaje.

## Registro por tema (variado, como los vecinos del B1)

1. picardia: el duelo que es cortejo y ninguno lo nombra
2. cortesia tensa: lo que se dice por no decir que no
3. lo callado pesa: dos que se protegen sin nombrarlo
4. orgullo corregido: la que tiene razon y no la pelea
5. verguenza y paciencia: las palabras que se fueron y vuelven
6. querer pertenecer: el examen que nadie admite estar tomando
7. fabulacion: la mentira que cuenta mas verdad que el dato

## Escalera de vocabulario (se decide AQUI, no despues)

420 plazas: **20 por historia, 14 portables y 6 ancladas** (ancladas 126/420 =
30%, el techo del gate).

| tramo | portables | ancladas | que hace |
|---|---|---|---|
| historias 1-3 | 14 | 6 | presentan; no alojan nada |
| 4-15 | 14 | 6 | presentan Y alojan los encuentros 3 y 4 de las anteriores |
| 16-21 | 0 | 20 | solo ancladas; el cuerpo recicla portables ya ensenadas |

- Toda portable entra como muy tarde en la historia 15.
- **AVISO CONOCIDO**: `journey-vocab-recirculation` NO tiene suelo B2 (el B1
  quedo provisional en 1,20 el 2026-09-05, y donde no hay listado el gate dice
  "no medible"). El numero medido se REPORTA al chat de planificacion; no se
  calibra un suelo B2 desde este chat. Objetivo de diseno mientras tanto: la
  serie sugiere ~1,1-1,2, y la escalera se escribe apuntando a 1,4 como el B1.
- Solape cero contra todo lo ensenado por los Traveler de espanol (incluido el
  B1 latam); lo comprueba `saveStory.ts` contra la base. La capa portable
  exenta entre niveles del mismo tipo se usa solo donde la escalera sea
  aritmeticamente imposible, dejando constancia.

### Campo lexico por tema (para que el vocabulario no choque)

| tema | de donde salen sus palabras |
|---|---|
| Jokes & Double Meanings | albur, doble sentido, apuesta, propina, revancha, cantina |
| Negotiations & Courtesies | plazo, pedido, ceder, regatear, cortesia, chifa |
| Secrets & Silences | pieza, engranaje, callar, disimular, averiar, cerro |
| Classes & Teachers | pizarron, corregir, metodo, nivel, lunfardo, mate |
| Fluency & Forgetting | trabarse, oxidarse, refran, giro, mecato, cachaco |
| Partners & In-Laws | rotiseria, milanesa, vianda, suegra, tanda, caja |
| Tales & Tall Stories | echar carreta, exagerar, anden, aguacero, hospedaje, libreta |

## Lo que falta despues del brief

1. Las 21 historias, tema a tema por `/tema` (plan → esqueleto → prosa →
   `saveStory --dry` → save → `cierraTema --plan`).
2. Lectura gestalt de las 21 seguidas antes de darlo por hecho.
3. Portadas, narracion, correos y push: fuera de este encargo; esos gates
   exigen el verbo del usuario.
