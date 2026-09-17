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
