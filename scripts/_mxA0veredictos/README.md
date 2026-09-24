# Veredictos del Friends ES Mexico A0 (Guadalajara)

Las 31 marcas que dejaron los gates al narrar las 21 historias, para juzgarlas
de oido. Artifact: https://claude.ai/artifact/8XmHvibP5k61Sga3LLbTt2

Un artifact pertenece a la cuenta que lo publico, asi que **la fuente vive
aqui**, no solo alla (ver `index_artifacts_de_trabajo`): con estos tres
ficheros se vuelve a montar la pagina entera sin recalcular nada.

- `fichas.json`: las 31 fichas. Salen de `audioFragments[n].gateFlags` y de
  `rapidasDe` sobre `audioSegments`, con el tramo del master que hay que
  recortar. Lo genero un script de sesion; el dato de origen sigue en la base.
- `blobs.json`: `id de ficha -> id del asset` subido al artifact.
- `build.js`: `node build.js fichas.json blobs.json > index.html`.

## Como se cortaron los clips

Del master YA narrado, con ffmpeg: cero creditos de ElevenLabs. Los tiempos NO
salen de `audioFragments.startSec`, que va hasta 1 s adelantado en historias con
hueco de titulo y trunca la ultima palabra, que es justo donde vive el uptalk
(`project_audio_fragments_offset_vs_master`). Salen de `audioSegments`, que los
reescribe la alineacion en Modal contra el master real. Comprobado
transcribiendo cuatro clips de vuelta con whisper.

El mp3 se envuelve en un mp4 mudo porque el store de assets no acepta
`audio/*`, y se referencia como `<video src="/_blob/<id>">` a 54px de alto.

## Reparto de las 31

- 23 de entonacion (uptalk), de +4,1 a +22,7 semitonos.
- 3 de contenido.
- 5 de ritmo, de 3,72 a 4,39 palabras/s.

Tres notas de triaje van escritas en `build.js` (constante `NOTAS`), con la
segunda opinion de whisper sobre las tres de contenido. La mas sospechosa es
`mx-pintan-el-14-f04-content`: dos reconocedores distintos oyen "Libro" donde el
texto dice "lee Bruno". La de `poquito-son-dos-dedos` es casi seguro ruido del
gate, que compara contra un texto donde el signo "=" desaparece al normalizar
mientras el narrador lo lee bien, "poquito igual a dos dedos".

## Al terminar

Los veredictos se guardan en la base del artifact, coleccion `verdicts/<id>`,
esquema `fp` / `real`, campo `journey` = `friends-es-mexico-a0`. Se leen desde
el chat y se rescatan a `docs/veredictos-audio-gates.json`, que es la unica
calibracion de oido humano que tienen estos gates.
