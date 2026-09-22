# Cinco animaciones para Meta

Se generan con `npx tsx scripts/_ads/renderAds.ts` (Playwright + ffmpeg, sin
servidor de dev). La escena vive en `scripts/_ads/adScenes.html` y enlaza el CSS
de la landing, asi que el telefono, el lector y Word Quest son los mismos
componentes que la home.

| # | Pieza | Titular | Pantalla |
|---|-------|---------|----------|
| 1 | `1-word-synced` | Every word lights up as you hear it. | Lector con karaoke y player |
| 2 | `2-tap-a-word` | Stuck on a word? Tap it. | Toque en `fonda` y tarjeta de glosa |
| 3 | `3-practice` | Then you use it. No flashcards. | Word Quest, ejercicio de significado |
| 4 | `4-variants` | Mexico. Madrid. Bogota. Not just "Spanish". | Explore, 12 historias publicadas |
| 5 | `5-textbook-vs-real` | A textbook says restaurante. A cook says fonda. | Tres glosas seguidas |

Cada una sale en dos formatos: `-9x16` (1080x1920, Reels y Stories) y `-4x5`
(1080x1350, feed de Facebook e Instagram). H.264, yuv420p, 30 fps, 8 segundos,
**sin audio**: Meta autorreproduce en silencio y el titular carga el mensaje.

En el 9:16 todo el contenido vive dentro de la franja de seguridad: **250 px
libres arriba** (la cabecera de Stories) y **340 px abajo** (el pie de Reels:
autor, texto, botones). El fondo si llega a los bordes. No lleva ni pildora de
beta ni boton propio; el CTA lo pone Meta.

El `.jpg` que acompaña a cada `.mp4` es su primer fotograma, para elegir sin
abrir el video.

## Lo que se enseña es real

Las 12 portadas de la escena 4 son de journeys **publicados** (Mexico, Espana,
Colombia, Brasil, Italia, Alemania); ningun borrador entra en un anuncio. El
texto, la glosa y el ejercicio salen de "Mole en San Angel", la misma historia
que la home usa de demo.

## Cambiar copy o duracion

Los titulares y los tiempos estan en `SCENES`, dentro de `adScenes.js`. Una
tirada de las diez piezas tarda unos siete minutos.

## Tipo Practice

| # | Pieza | Titular | Pantalla |
|---|-------|---------|----------|
| 50 | `50-practice-four` | You heard the story. Now make it stick. | Meaning, Context, Listening y Match seguidos, 16,8 s |

Los datos son los del set de práctica publicado de "A las dos no cabe nadie", la
historia del Lector de "ni el gato": Meaning (`ni el gato` = not a soul) y
Context (`cabe`) salen tal cual del set; Listening y Match usan su vocabulario,
que es como la app los arma. Sin audio. Vista previa de fotogramas sueltos:
`npx tsx scripts/_ads/_stills.ts 50 2.5,5.9 <dir>`.

## Tipo Lector + Practice

| # | Pieza | Titular | Pantalla |
|---|-------|---------|----------|
| 51 | `51-lector-practice-gato` | Hear it in a story. Then practice it. | Lector con la tarjeta de `ni el gato` (con narración), y el mismo teléfono pasa a Meaning con esa expresión, 12,6 s |

| 52 | `52-lector-practice-quepedo-mx` | Hear it in Mexico. Then practice it. | `qué pedo` → what's up, 10,6 s |
| 53 | `53-lector-practice-comedera-co` | Hear it in Colombia. Then practice it. | `la comedera` → a strong craving to eat, 12,4 s |
| 54 | `54-lector-practice-roche-pe` | Hear it in Lima. Then practice it. | `roche` → embarrassment, 10,4 s |
| 55 | `55-lector-practice-escoba-cl` | Hear it in Chile. Then practice it. | `quedar la escoba` → it turned out wild, 11,6 s |
| 56 | `56-lector-practice-embalada-ar` | Hear it in Buenos Aires. Then practice it. | `embalado` → carried away with excitement, 16,2 s |

La tarjeta usa la definición del vocabulario de la historia, y el ejercicio es su
Meaning publicado con las cuatro opciones tal cual. 52, 53, 54 y 56 usan
ventanas propias de `buildStories.ts` (`pedo`, `comedera`, `roche`, `embalada`), que
arrancan en la frase de la expresión. 52-54 se rehicieron el 2026-09-14 con jerga
más coloquial (antes: ahorita, no sea delicada, habla causa); la 54 pasó después de lorna a roche. Cada voz se apaga
en el silencio medido tras la frase (`audioUntil`, `audioFade`).
Titulares por paso (2026-09-14, `hook` y `hook2`: cambia al pasar a Practice):

| # | Lector | Practice |
|---|---|---|
| 51 | Your textbook forgot the cat. | Get it wrong and you eat alone at 1:30. |
| 52 | In Mexico, "what fart" means hello. | Rude or friendly? Pick fast. |
| 53 | Colombia has a word for the munchies. | Hungry yet? Prove you got it. |
| 54 | Peruvians have a word for pure cringe. | Skip the roche. Get this one right. |
| 55 | In Chile, a wild party leaves a broom. | Party's over. Now clean this up. |
| 56 | Argentines don't fall in love. They get packed. | Calm down, Romeo. Pick the meaning. |

Practice entra como el ejercicio 4 de 8 (`practiceStep: 4`): tres aciertos previos,
+18 XP, y al acertar suena `practice-combo.mp3`, que es lo que la app pone desde el
segundo acierto seguido.

La narración se apaga en 6,6 s (`audioUntil` en la escena), antes de que la
pantalla cambie a Practice en 7,4 s.

### Versión feed 4:5 (2026-09-15)

Las seis tienen también `-4x5` (1080x1350). En 4:5 las escenas `combo` no usan el
72% genérico del teléfono: con él el lector era ilegible y sobraban 110 px abajo.
Llevan su propia geometría en `adScenes.js` (solo `RATIO === "45"` y
`screen: "combo"`): teléfono a 0.80, titular a 34 px y 18 px de aire entre los dos.
El audio sale idéntico bit a bit al del 9:16 (misma voz, mismo corte, misma racha).

Si Meta recorta el creativo a 1:1, el titular queda dentro, pero el pie del
teléfono (botón CORRECT) se pierde.

Fotogramas para revisar: `npx tsx scripts/_ads/_stills.ts 52 4.5,6.4,9.8 <dir> 45`
(el quinto argumento `45` pide el 4:5; sin él, 9:16).

## 67 - Tour de variantes (Lector, sin ejercicio, 2026-09-21)

`67-variantes-es-4x5.mp4`, 14,83 s, 1080x1350. Cuatro países en el mismo lector,
una oración entera cada uno, y el catálogo al final. Sin Practice: aquí lo que se
vende es que el español no es uno.

| Orden | País | Frase | Palabra | Dura |
|---|---|---|---|---|
| 1 | México | “¿Qué pedo, ya te acordaste de nosotros?” | `qué pedo` | 1,98 s |
| 2 | Argentina | “Estamos en el horno”, soltó Fabián. | `horno` | 2,53 s |
| 3 | Colombia | “¡Láncese, juemadre, que no se va a morir!” | `juemadre` | 2,76 s |
| 4 | España | “¡Que invito yo, que el cumpleañero paga aquí!” | `cumpleañero` | 2,92 s |
| 5 | - | Catálogo filtrado a español | - | 2,2 s |

Las cuatro frases son de DIÁLOGO y llevan jerga o costumbre propia: quien las oye
seguidas no oye cuatro acentos, oye cuatro sitios. El titular no dice cuántos son
(`"Spanish" is not one language.`) porque las variantes son más de cuatro; poner
el número las cerraba. El país va en la línea del subtítulo, con su bandera
(`.adFlagRow`), y entre corte y corte lo único que se mueve es la historia, la
bandera y el acento.

**Esto NO son fragmentos enteros.** Un fragmento (`JourneyStory.audioFragments`)
dura entre 6 y 20 s: cuatro no caben en quince segundos. Lo que suena aquí es una
ORACIÓN entera recortada del mp3 completo por silencios medidos, que es el mismo
permiso que se dio para la 66. Si la pieza tuviera que ir con fragmentos enteros,
serían dos países como mucho.

Cuatro defectos que costó encontrar, todos del 2026-09-21:

1. **La caché del audio iba por clave de ventana** (`vco.mp3`), así que al cambiar
   la historia de una ventana se reusaba el mp3 ANTERIOR: tres de las cuatro piezas
   salieron con el texto de una historia y la voz de otra. Ahora el archivo se llama
   como su URL (`cacheName` en `buildStories.ts`) y dos historias no comparten
   archivo nunca.
2. **El desvanecido empezaba 40 ms antes de que acabara la voz** y se comía el final
   de la última palabra (hasta -3,2 dB en Argentina). `audioUntil` = `clipEnd` + el
   propio desvanecido, así que ahora empieza justo donde la voz termina.

3. **`silencedetect` cortaba dentro de la última palabra.** La oclusión de "aquí"
   (0,19 s por debajo de -40 dB, entre 55,01 y 55,20) se leía como final de frase y
   el anuncio decía "paga aqu". La voz se cierra ahora con histeresis
   (`scripts/_ads/_speechRuns.ts`: entra a -38 dB, sale tras 0,18 s por debajo de
   -52 dB), y `silencedetect` ya no decide dónde acaba una frase.
4. **Las narraciones MONO sonaban 3 dB más flojas.** El upmix de ffmpeg reparte la
   potencia entre los dos canales, así que el argentino y el colombiano (mono) caían
   por debajo del mexicano y el español (estéreo) en el mismo vídeo. `renderAds.ts`
   mira los canales y usa `pan=stereo|c0=c0|c1=c0` cuando la fuente es mono.

Comprobación, y no es opcional: `scripts/_ads/_matchAudio.ts` correla la envolvente
del tramo del anuncio con la de la historia y da correlación y desfase. Las cuatro
piezas dan 0,96-0,999 con -0,02/-0,04 s (el pre-arranque del corte). Contra los mp3
equivocados daba 0,32 y 0,46: es lo que distingue "suena algo" de "suena LO que digo
que suena".

Montaje: `npx tsx scripts/_ads/_tourVar.ts --ratio 45`. Renderiza las piezas
671-675, las pega con corte seco y borra los trozos sueltos; en el mural la pieza
cae en la columna **Lector**.

**Los cortes van medidos, no deducidos del alineado.** En estas cuatro historias
el alineado no sirve como límite: cierra alguna oración décimas antes de que la voz
la acabe, y en tres de las cuatro adelanta la PRIMERA palabra hasta un segundo
(en "Invita el que cumple años", 0,7 s; en "La Mesa no perdona", 0,9 s). El corte sale del perfil de energía del mp3
(`scripts/_ads/_speechRuns.ts`) y entra en `buildStories.ts` como `clip: [inicio, fin]`
con su rango de palabras a mano. Esa primera palabra desalineada se queda pegada al
inicio del clip y el resto del karaoke cae donde suena.

Chile y Perú se quedaron fuera por medida, no por gusto: sus frases de diálogo con
jerga propia o empiezan en 3,1 s ("engrupió jurando que el trago estaba asegurado")
o se parten a mitad de una frase que sigue en el siguiente fragmento ("¿Me lo tiene
al toque, señora? La campaña no espera"), y no hay silencio donde cortarlas.

## 68 - Tour de variantes, segunda tanda (Lector, sin ejercicio, 2026-09-21)

`68-variantes-es-2-4x5.mp4`, 14,97 s. Mismo molde que la 67 con otras cuatro
historias y otro titular: `You learned "Spanish". Now learn how they talk.`, y el
cierre pasa a `One app. Every accent.`

| Orden | País | Frase | Palabra | Dura |
|---|---|---|---|---|
| 1 | Colombia | “¡Esta rumba sí quedó buena, parceros!” | `rumba` | 2,68 s |
| 2 | México | Pura mamada, y nadie le creyó una palabra. | `mamada` | 2,62 s |
| 3 | Argentina | La previa alegre se pinchó de golpe con la calentura subiendo. | `previa` | 3,30 s |
| 4 | España | La sobremesa del sábado era de las segundas. | `sobremesa` | 2,40 s |
| 5 | - | Catálogo filtrado a español | - | 1,6 s |

Las cuatro tarjetas son UNA palabra del país (`rumba`, `mamada`, `previa`,
`sobremesa`): si una lleva una locución general ("algo de alguien"), el anuncio
deja de comparar cuatro españoles y pasa a comparar tres palabras y una frase.

Montaje: `npx tsx scripts/_ads/_tourVar.ts --ad 68`. El script ya sirve para las
dos piezas: `--ad 67` o `--ad 68`, y la tabla `TOURS` dice qué escenas lleva cada
una.

Por qué estas cuatro y no otras: en las narraciones multivoz de los Friends C1 las
frases van pegadas, sin silencio entre ellas, así que casi ninguna se puede cortar
limpia. `scripts/_ads/_cleanCuts.ts` recorre un journey entero y solo saca las que
empiezan y acaban donde la voz calla. Chile y Perú volvieron a quedarse fuera por
eso: sus mejores frases arrancan a mitad de un tramo de voz continuo.

**El lector no se queda medio vacío.** Con la tarjeta cerrada, el cuerpo del texto
llega hasta el REPRODUCTOR, no hasta donde luego aparecerá la tarjeta: pararlo ahí
dejaba un hueco en blanco cada vez que la tarjeta tardaba en abrir. Y la ventana se
elige en MITAD de la historia, nunca en su última frase, porque entonces no queda
texto debajo con el que llenar la pantalla (le pasó a la primera versión de la
pieza argentina).

Aviso: la tarjeta mexicana traduce `mamada` con la palabra "bullshit". Es la
definición que está en la base y la que ve el usuario en la app, pero si Meta lo
marca, el cambio es sustituir esa pieza, no reescribir la definición.

## 69 - Tour de variantes, tercera (Lector, sin ejercicio, 2026-09-21)

`69-variantes-es-3-4x5.mp4`, 14,93 s. Cuatro palabras que no salen ni en la 67 ni
en la 68, y otro orden de países. Mismo titular y mismo cierre que la 68.

| Orden | País | Frase | Palabra | Dura |
|---|---|---|---|---|
| 1 | España | “Apúntame el café y una caña de Marcos”. | `caña` | 2,66 s |
| 2 | Colombia | “¡Esto está berraco!” | `berraco` | 1,34 s |
| 3 | México | “Una ofrenda es para alguien. Un muerto con nombre.” | `ofrenda` | 3,48 s |
| 4 | Argentina | El chamuyero no tenía ni idea del quilombo que se le venía encima. | `chamuyero` | 3,22 s |
| 5 | - | Catálogo filtrado a español | - | 1,3 s |

**Dos reglas que valen para todo el formato.** Ninguna palabra se repite entre las
tres piezas: doce palabras, doce historias distintas. Y el orden de países cambia
en cada una, así que la 67 abre por México, la 68 por Colombia y la 69 por España.

`cuñada` estuvo aquí y se cayó: es una palabra normal, no coloquial, y al lado de
`chamuyero` o `berraco` no compara. La mexicana obliga a bajar al journey cultural
(`ofrenda`): en las narraciones multivoz de los Friends C1 mexicanos las frases van
pegadas y no hay dónde cortar limpio.

La pieza española ocupa dos líneas de texto, así que su tarjeta espera a que la
frase se lea entera; la argentina, que es la penúltima frase de su historia, abre
la tarjeta antes para que el hueco de abajo dure lo mínimo.

Montaje: `npx tsx scripts/_ads/_tourVar.ts --ad 69`.

## 70 y 71 - Tour de variantes, cuarta y quinta (2026-09-21)

`70-variantes-es-4-4x5.mp4`, 14,97 s, y `71-variantes-es-5-4x5.mp4`, 11,37 s.
Mismo titular y cierre que la 68 y la 69; entra **Perú** por primera vez.

| Pieza | Orden | Frase | Palabra | Dura |
|---|---|---|---|---|
| 70 | Perú | Pagó el chifa por la cortesía más cara del mes. | `chifa` | 3,08 s |
| 70 | Colombia | El man está en su salsa, mamando gallo con cada uno que llega. | `el man` | 3,22 s |
| 70 | Argentina | “¿Qué macana es esta?” | `macana` | 1,24 s |
| 70 | España | Pidió una ronda para los fijos y pagó el estreno. | `ronda` | 2,66 s |
| 71 | Colombia | Hay treinta marimondas. | `marimonda` | 1,70 s |
| 71 | Perú | El mozo se llevó la servilleta como si no valiera nada. | `mozo` | 3,10 s |
| 71 | Argentina | Dijo Ariel, que de autos no sabía un pomo. | `pomo` | 1,98 s |

La 71 lleva tres países, no cuatro, y dura 11,4 s: no hay una cuarta frase que
pase el corte sin repetir palabra.

**Por qué no salen México ni Chile.** Sus historias con jerga están narradas a
varias voces y las frases van pegadas, sin silencio entre una y otra:
`_cleanCuts.ts` sobre el Friends C1 latam, el Traveler B2, el Cultural A0 y el
Traveler A1 de México no devolvió ni una frase con palabra mexicana o chilena que
empiece y acabe donde la voz calla. Las candidatas (`chido`, `güey`, `cuate`,
`carrete`, `copete`, `al tiro`, `cachái`) están todas dentro de un tramo continuo.
Para meterlas hay que cortar dentro del habla, que es justo lo que rompió la pieza
española de la 68 ("paga aqu").
