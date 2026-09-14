# Spec: piloto del ejercicio de speaking (quinto tipo de práctica)

Decidido por el usuario el 2026-09-14. Versión 2, misma fecha: **sin ningún
proveedor externo**. La versión 1 heredó del prototipo de junio (commit
`b767528c`) la transcripción con Whisper y las preguntas con GPT-4o; el usuario
la rechazó: "no usamos API de OpenAI" y "esto no tiene que depender de nada de
eso". Todo lo que necesita el ejercicio ya está en el teléfono o en el proyecto.

Evidencia de usuario (BetaSignup, 2026-09-14): 12 de 76 solicitudes piden
hablar. Literal: "Holiday home in Spain and I wish to talk to neighbours",
"I want to have my own conversations with her [the grandmother]", "never feel
comfortable speaking", "challenged by verb conjugation and spoken language".

## 1. Qué es, en dos líneas

Es `fill_blank` dicho en voz alta: la frase de la historia con el hueco, leída
con su audio, y el usuario dice la palabra que falta (o la frase entera) por el
micrófono. Cuenta como acierto si el reconocimiento de voz del sistema oyó la
palabra.

Quinto tipo de ejercicio, al lado de `meaning`, `context`, `listening` y
`match`: **un turno por palabra, dentro de la sesión mixta**. No es un chat.

## 2. Flujo del ejercicio (móvil)

| Paso | Pantalla | Detalle |
|---|---|---|
| 1 | Pista | Etiqueta `SAY IT WITH:` seguida de la **traducción en inglés** de la palabra. La palabra en el idioma meta NO se muestra: se prueba recuperarla. |
| 2 | Frase | La frase de la historia con `_____` en el hueco, la misma que arma `createFillBlankExercise`. Su audio suena en autoplay: el clip pre-horneado (`clipUrl`) si existe, y si no `POST /api/practice/sentence-tts` con la voz de la historia, que ya cachea en R2. Botón para repetir. |
| 3 | Hablar | `TAP TO SPEAK`: arranca el reconocimiento de voz del sistema en el idioma de la palabra. Tope de 12 s con parada automática; `TAP TO SEND` para parar antes. Sin cuenta atrás de sesión: el temporizador de 15 s NO aplica a este tipo. |
| 4 | Resultado | Lo reconocido (`YOU HEARD` no: `YOU SAID`), la palabra revelada, acierto o fallo con el sonido del contrato de práctica, y en el fallo la frase completa en texto con su audio. Auto-avance como en los demás tipos. |

Silencio o nada reconocido: "I couldn't hear you", UN reintento sin
penalizar; el segundo vacío cuenta como fallo.

Permiso de micrófono o de reconocimiento de voz denegado: el ejercicio se
salta sin nota, la sesión sigue, y se registra `speaking_skipped_no_mic`.

Sin reconocimiento disponible para ese idioma en el dispositivo: el slot cae a
`context` para esa palabra (el builder ya sabe armarlo) y se registra
`speaking_skipped_no_recognizer`.

## 3. Reconocimiento de voz: del sistema, sin red propia

- Módulo: `expo-speech-recognition` (SFSpeechRecognizer en iOS,
  SpeechRecognizer en Android). Es un módulo nativo: exige `prebuild` y otra
  build local.
- Idioma: el `language` del favorito, mapeado a locale BCP-47 con la variante
  de la historia cuando se conozca (`es-ES`, `es-MX`, `it-IT`, `de-DE`,
  `pt-BR`, `fr-FR`); sin variante, el locale genérico del idioma.
- En iOS se pide reconocimiento **en el dispositivo** cuando el sistema lo
  ofrece para ese idioma (`requiresOnDeviceRecognition`), y si no, el del
  propio sistema; en ningún caso un servicio nuestro ni una clave nuestra.
- Se usa `interimResults: false` y el resultado final; se guarda solo en
  memoria para calificar. La transcripción NO se persiste.
- Permisos en `Info.plist`: `NSMicrophoneUsageDescription` (ya existe) y
  `NSSpeechRecognitionUsageDescription` (nuevo). Android:
  `RECORD_AUDIO` (ya existe).

## 4. Reglas de calidad (gates dentro del código)

- **G1. La frase no regala la palabra.** El hueco cubre `surface` (la forma
  de la historia) y `createFillBlankExercise` ya rechaza frases donde la
  palabra aparece dos veces o sin forma limpia. Si el builder de `fill_blank`
  devuelve `null` para el ítem, tampoco hay speaking para él.
- **G2. Solo palabras con frase de historia, y corta.** Sin `storySlug` o sin
  UNA oración limpia no hay ejercicio (`createSpeakingExercise` devuelve
  `null`); no hay frase de reserva, porque caer a `getContextSentence` devolvía
  el fragmento entero. Y aunque la oración sea limpia, más de
  **`SPEAKING_MAX_WORDS` = 12 palabras** también es `null`: el tope de 100
  caracteres mide la pantalla y este mide el aliento, que es lo que pide decir
  la frase de un tirón. Empezó en 15 y no descartaba nada: lo que el usuario
  tuvo delante en el teléfono fueron oraciones de 15 palabras y 99 caracteres,
  justo por debajo de los dos topes, y le siguieron pareciendo largas. Base
  medida el 2026-09-14 sobre 681 favoritos de journey: mediana 13 palabras,
  p75 21, así que 15 dejaba pasar la mediana entera. La palabra que no llega no
  se pierde: la recoge otro modo.
- **G3. Voz aprobada y nunca nueva.** El audio es el clip existente o
  `sentence-tts` con la voz de la historia; esa ruta ya cae a la voz aprobada
  del idioma. Cero código nuevo de TTS.
- **G4. Calificación determinista.** `gradeDeterministic` de
  `speakingGrading.ts`: `word` o `surface` como palabra completa en el texto
  reconocido, sin acentos ni puntuación, con soporte multi-palabra. No hay
  segunda pasada: sin LLM, lo que no casa es fallo.
- **G5. Sin guiones largos** en el copy nuevo.

## 5. Datos y API

- **Ningún endpoint nuevo.** Se borra `src/app/api/mobile/speaking/route.ts`
  (la v1 lo había reescrito; el prototipo ya no existe).
- **Ninguna tabla nueva.** Se retira el modelo `SpeakingPrompt` y su
  migración `20260914120000_add_speaking_prompt` de la rama. La tabla
  `dp_speaking_prompts_v1` ya fue creada vacía en Neon el 2026-09-14 con esa
  migración; borrarla es un `DROP TABLE` que decide y ejecuta el usuario, no
  este encargo.
- Resultados como los demás tipos: SRS por `PATCH /api/mobile/favorites`,
  métrica por `POST /api/mobile/metrics` con `metadata.mode = "speaking"`, y
  los dos eventos de salto de la sección 2.

Tipo compartido en `src/lib/practiceExercises.ts` (sustituye al de la v1):

```ts
type SpeakingExercise = {
  type: "speaking";
  id: string;
  word: string;
  surface?: string | null;
  translation: string;   // pista en pantalla
  sentence: string;      // frase completa, para el fallo
  blanked: string;       // frase con _____, la misma de fill_blank
  storySlug: string;
  language: string;
  voiceId?: string | null;
  audioClip?: PracticeAudioClip; // el mismo que lleva fill_blank
};
```

`PracticeMode` conserva `"speaking"`; `MIXED_PRACTICE_PLAN` conserva su slot
(el 8 de 10). El checkpoint de tema NO cambia.

## 6. Plan

Piloto **solo `polyglot`**: el móvil pasa `speakingEnabled: effectivePlan ===
"polyglot"` al builder, así el slot y la tarjeta de la órbita no existen para
nadie más. Al publicar pasa a `premium` según
`project_subscription_model_2026_09`; ese cambio es una línea y no forma parte
del piloto. Como ya no hay ruta, no hay gate de servidor que mantener.

## 7. Integración (lo que el ejecutor toca, en orden, sobre la rama v1)

1. `src/lib/practiceExercises.ts`: `SpeakingExercise` con `blanked` y
   `audioClip`; `createSpeakingExercise` se apoya en `createFillBlankExercise`
   (mismo hueco, mismo clip) y devuelve `null` cuando aquel devuelve `null`.
2. Borrar `src/app/api/mobile/speaking/route.ts`, el modelo `SpeakingPrompt`
   del `schema.prisma` y su migración; dejar `speakingGrading.ts` solo con lo
   determinista (`normalizeForSpeaking`, `containsWholeWord`,
   `gradeDeterministic`) y quitar `questionLeaksWord`, `verifyLlmForm`,
   `clampFeedback`, `journeyStoryWhereFromSlug` con sus tests.
3. `apps/mobile`: añadir `expo-speech-recognition` al `package.json` y a los
   plugins de `app.config.js`, con `NSSpeechRecognitionUsageDescription`;
   `useSpeakingRecorder` pasa a envolver el reconocimiento (start, stop,
   cancel, resultado final, tope de 12 s) y deja de leer archivos ni base64.
4. `MobileLibraryShell.tsx`: quitar la carga de pregunta y las llamadas a la
   ruta; el slot pinta `blanked` y reproduce el clip como hace `fill_blank`
   (misma preferencia: `clipUrl`, luego `sentence-tts`); `submitSpeakingAnswer`
   califica en el cliente con `gradeDeterministic`; los dos eventos de salto.
5. `src/app/practice/page.tsx` sigue con `speakingEnabled: false` y el filtro.
6. `src/lib/storyPracticeSets.ts` `buildPayload`: el caso `speaking` guarda
   `{ translation, sentence, blanked, storySlug, language }`.
7. `docs/rules-inventory.json`: la fila de G4 (determinista) con su test;
   retirar la fila de la pregunta del LLM.
8. `apps/mobile/ios`: `prebuild`, restaurar `Info.plist` versionado, añadir la
   clave de permiso, `pod install` con el Podfile del repo principal.

Tests mínimos: `gradeDeterministic` (acento, puntuación, multi-palabra,
vacío), `createSpeakingExercise` (null sin `storySlug`, null cuando
`fill_blank` es null, `blanked` idéntico al de `fill_blank`).

## 8. Fuera del piloto

- Web con micrófono del navegador.
- Sets curados con speaking y edición en Studio.
- Cambio del gate a `premium`.
- Más de un slot por sesión mixta y el checkpoint de tema.
- Decir la frase entera y medir pronunciación: hoy solo se comprueba la palabra.

## 9. Coste

Cero por turno: el reconocimiento es del sistema, la frase ya tiene audio, y
la calificación es local. El único gasto posible es `sentence-tts` la primera
vez que una frase sin clip se narra, con la caché de R2 y las reglas de audio
del proyecto.

## 10. Criterio de aceptación

- El usuario abre "Speaking" en su iPhone (build Release, servidor local o
  producción, da igual: ya no hay ruta) con palabras guardadas de journey y
  aparecen los turnos hablados.
- La frase suena con la voz de la historia; decir la palabra da acierto y
  suena el acierto; decir otra cosa da fallo y muestra la frase completa.
- La web no muestra ningún ejercicio de speaking.
- Lint de tipos, tests, `lint:no-emdash`, `lint:rules-inventory` en verde.

El veredicto lo da el usuario probando, no el chat.

## 11. Ejecución

Un encargo, un chat ejecutor (Opus), commits por punto de la sección 7 en la
rama `worktree-agent-a62eb4cdc309882a5`, sin push. Estado que asume el
encargo: la rama con los 14 commits de la v1 hasta `06f6b308`, el archivo
`apps/mobile/src/mobile/LanguageSwitchSheet.tsx` modificado y SIN commitear en
el worktree (es de otro chat: no tocarlo ni commitearlo), y el `Info.plist`
del worktree con `NSLocalNetworkUsageDescription` sin commitear. Si el
ejecutor encuentra otra cosa, reporta al chat de planificación antes de
tocar nada.
