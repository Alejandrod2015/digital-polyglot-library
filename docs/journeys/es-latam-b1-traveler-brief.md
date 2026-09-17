# Traveler ES/latam B1: brief

`Journey` **cmtmylg7k0007321h6t7njesx** · draft · 7 temas x 3 historias = 21
Peldano de abajo: Traveler ES/latam A2 (`cmtgelq560007j84n3ujx9bpd`, vivo), que
ya apunta aqui con `nextJourneyId`.

## Forma

Antologia, igual que el A0, el A1 y el A2: **un protagonista y un secundario por
tema**, cada tema en otra ciudad y otro pais, sin reparto fijo que cruce el
journey. Catorce personas nuevas: **ninguna del A0, del A1 ni del A2**.

- Todos los personajes son nativos del pais de su tema.
- **Reparto adulto: ni un nino ni un anciano**, ni hablando ni de fondo. No hay
  voces aprobadas para eso.
- Maximo 2 personajes hablando por historia.
- Narrador con acotacion, ~30% de habla citada, comillas curvas `“”`, cero
  guiones largos, definiciones de vocab en ingles.
- Cuerpo **115-170 palabras** (duro 100-190). Desde el 2026-09-04 la banda es
  UNA para todos los niveles, la del A0, por decision del usuario: lo que sube
  de nivel es la densidad, no el volumen, y el coste de TTS escala con las
  palabras.
- Se guarda con `--narrator`: prosa narrada en tercera con habla citada, que
  exime SOLO los tres checks de formato de dialogo por turnos.
- Los anclajes culturales llevan `register: "cultural"`, que los exime del eje
  de frecuencia; sin eso el juez los lee como C2 por definicion.

## Los siete temas

| # | tema | pais | sitio | protagonista | secundario |
|---|---|---|---|---|---|
| 1 | Promises & Excuses | argentina | Mendoza, finca de poda | Valentina, 28, podadora | Damian, 32, capataz |
| 2 | Advice & Opinions | colombia | Manizales, cafe de barrio | Rocio, 30, duena del cafe | Esteban, 35, taxista |
| 3 | Faith & Devotion | peru | Ayacucho, taller de andas | Nicanor, 40, carpintero | Delia, 38, borda mantos |
| 4 | Animals & Farms | chile | Chiloe, campo con ovejas | Ximena, 33, veterinaria rural | Oscar, 45, dueno del perro |
| 5 | Games & Bets | mexico | Aguascalientes, la feria | Hugo, 29, puesto en la feria | Brenda, 31, cobra apuestas |
| 6 | Pride & Envy | argentina | Tucuman, dos panaderias | Adrian, 36, panadero | Silvana, 34, su cunada |
| 7 | Distance & Homecoming | colombia | Popayan, casa familiar | Teresa, 39, vuelve tras ocho anos | Wilson, 41, se quedo a cargo |

El pais lo pinta el eyebrow desde `LATAM_TOPIC_COUNTRY`
(`packages/domain/src/languageVariant.ts`), no la etiqueta del tema.

## Arco de cada tema (continuidad entre las tres)

1. **Promises & Excuses**: Valentina promete acabar la poda antes de la helada ·
   pone una excusa que se le nota · cumple tarde y Damian ya lo habia resuelto
   sin decirselo.
2. **Advice & Opinions**: Rocio pide opinion sobre cambiar el cafe · Esteban le
   da un consejo que nadie pidio y ella lo sigue a medias · el consejo era bueno
   y le cuesta reconocerlo.
3. **Faith & Devotion**: Nicanor promete cargar el anda si su hermana mejora ·
   la promesa choca con un trabajo pagado · Delia lo sustituye y el lo vive como
   una deuda.
4. **Animals & Farms**: el perro de Oscar mata dos ovejas ajenas · Ximena tiene
   que decir de quien es el perro · Oscar paga menos de lo que debe y el vecino
   lo acepta.
5. **Games & Bets**: Hugo apuesta en la feria delante de Brenda · gana y no
   cobra · pierde y descubre quien le habia fiado.
6. **Pride & Envy**: a Silvana le va mejor · Adrian le copia algo y lo niega ·
   se lo dice a la cara y ninguno se disculpa.
7. **Distance & Homecoming**: Teresa vuelve tras ocho anos · la casa tiene otro
   orden y ella sobra · se va otra vez y deja la llave.

## Escalera de vocabulario (se decide AQUI, no despues)

420 plazas: **20 por historia, 14 portables y 6 ancladas**.

| tramo | portables | ancladas | que hace |
|---|---|---|---|
| historias 1-3 | 14 | 6 | presentan; no alojan nada |
| 4-15 | 14 | 6 | presentan Y alojan los encuentros 3 y 4 de las anteriores |
| 16-21 | 0 | 20 | solo ancladas; el cuerpo recicla portables ya ensenadas |

- **Toda portable entra como muy tarde en la historia 15**, para que le quepan
  los encuentros 3 y 4.
- Ancladas: 126 de 420 (30%), que es el techo de `journey-vocab-recirculation`.
- Objetivo medido con la formula del gate: **media >= 1,4** y **cola <= 85%**
  (liston de B1 anadido el 2026-09-04, calibrado sobre el ES/spain B1 en draft,
  que da 1,43 y 82%).

### Solape cero

- Lista de exclusion: **2.324 lemas** ya ensenados por todos los Traveler de
  espanol (`/tmp/traveler-es-lemas-ensenados.tsv`, incluye ya el A2) y las
  **444 plazas** del A2 (`/tmp/a2-latam-vocab-444.tsv`).
- Lo anclado va a cero absoluto contra esa lista.
- La capa portable esta EXENTA en el codigo entre niveles del mismo tipo
  (`saveStory.ts` prefiltra), pero el usuario pidio el 2026-09-04 que tampoco se
  repita: "el usuario tiene que aprender cosas nuevas". Se escribe buscando
  portables nuevas, y la exencion se usa solo donde la escalera sea
  aritmeticamente imposible sin ella, dejando constancia de cuantas.

### Campo lexico por tema (para que el vocabulario no choque)

| tema | de donde salen sus palabras |
|---|---|
| Promises & Excuses | comprometerse, plazos, helada, poda, escurrir el bulto |
| Advice & Opinions | opinar, aconsejar, llevar la contraria, tostion, clientela |
| Faith & Devotion | promesa, anda, bordado, procesion, deuda moral |
| Animals & Farms | oveja, perro, cerco, dano, veterinaria, indemnizar |
| Games & Bets | apuesta, feria, fiar, rachas, cobrar |
| Pride & Envy | orgullo, envidia, copiar, presumir, quedar por encima |
| Distance & Homecoming | volver, sobrar, llave, reparto, ausencia |

## Lo que falta despues del brief

1. Las 21 historias, por `scripts/saveStory.ts` (validador canonico), nunca por
   el Studio.
2. Lectura gestalt de las 21 seguidas antes de decir que esta hecho.
3. Portadas, narracion y clips de practica: fuera de esta tarea.
