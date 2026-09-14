# Spec: piloto del ejercicio de speaking (quinto tipo de práctica)

Decidido por el usuario el 2026-09-14. Sustituye al prototipo "Speak with AI"
(commit `b767528c`, 2026-06-07): una pantalla suelta, de un solo turno, sin
nota ni progreso, con preguntas genéricas sin relación con lo leído.

Evidencia de usuario (BetaSignup, 2026-09-14): 12 de 76 solicitudes piden
hablar. Literal: "Holiday home in Spain and I wish to talk to neighbours",
"I want to have my own conversations with her [the grandmother]", "never feel
comfortable speaking", "challenged by verb conjugation and spoken language".

## 1. Qué es, en dos líneas

Un personaje de la historia donde el usuario guardó la palabra le hace, con
su voz, una pregunta que pide esa palabra. El usuario responde por el
micrófono; cuenta como acierto si usó la palabra.

Es el quinto tipo de ejercicio de práctica, al lado de `meaning`, `context`,
`listening` y `match`: **un turno por palabra, dentro de la sesión mixta**.
No es un chat ni un role-play largo.

## 2. Flujo del ejercicio (móvil)

| Paso | Pantalla | Detalle |
|---|---|---|
| 1 | Pista | Arriba, el nombre del personaje y la etiqueta `SAY IT WITH:` seguida de la **traducción en inglés** de la palabra (la palabra en el idioma NO se muestra; se prueba recuperarla, no leerla). |
| 2 | Pregunta | El personaje pregunta en el idioma meta: texto en pantalla y audio en autoplay, con su voz. Botón para repetir. |
| 3 | Grabar | Botón de micrófono. Tocar para empezar; tope de 12 s con auto-stop; tocar de nuevo para enviar. Sin cuenta atrás de 15 s: el temporizador de la sesión NO aplica a este tipo. |
| 4 | Pensando | Indicador "Listening…" mientras el servidor transcribe y califica. |
| 5 | Resultado | Transcripción ("YOU SAID"), la palabra revelada, acierto o fallo con el sonido del contrato de práctica, y UNA línea de feedback en inglés. Botón "Continue" o auto-avance como en los demás tipos. |

Silencio o transcripción vacía: mensaje "I couldn't hear you", UN reintento
sin penalizar; el segundo vacío cuenta como fallo.

Permiso de micrófono denegado: el ejercicio se salta sin nota y la sesión
sigue; se registra `speaking_skipped_no_mic` en métricas.

## 3. Reglas de calidad (gates dentro del código, no del prompt)

- **G1. La pregunta no contiene la palabra.** Ni `word` ni `surface`, con
  comparación sin acentos y por palabra completa. Si la contiene, se regenera
  UNA vez; si vuelve a contenerla, el ejercicio se convierte en `context` para
  esa palabra (el builder ya sabe hacerlo).
- **G2. Nivel de la historia, no de las preferencias.** El prompt recibe
  `JourneyStory.level` y la banda gramatical de ese nivel
  (`project_grammar_band_*`). Una palabra sin `storySlug` de journey (favoritos
  de libros) NO genera speaking en el piloto: el builder devuelve `null`.
- **G3. El personaje existe.** El nombre sale de `JourneyStory.cast` (el
  hablante de la frase de ejemplo si se puede resolver; si no, el primer
  personaje del reparto). Sin reparto, pregunta el narrador sin nombre.
- **G4. Voz aprobada, y nunca nueva.** El audio de la pregunta se pide a
  `POST /api/practice/sentence-tts` con `voiceId = practiceVoiceId || voiceId`
  de la historia; esa ruta ya cae a la voz aprobada del idioma y cachea en R2
  por hash de frase. Cero código nuevo de TTS.
- **G5. Calificación verificable.** Primero determinista: `word` o `surface`
  como palabra completa en la transcripción normalizada (minúsculas, sin
  acentos). Solo si falla, UNA llamada al LLM que debe devolver la forma
  exacta encontrada (`formFound`); el servidor comprueba que esa forma está en
  la transcripción. Si no está, es fallo. El LLM nunca puede aprobar solo.
- **G6. Feedback de una línea.** Inglés, menos de 20 palabras. Con acierto:
  una versión más natural de lo dicho si hubo un desliz, o "Nice" si no lo
  hubo. Con fallo: la frase modelo con la palabra. Sin explicar que se
  transcribió.
- **G7. Sin guiones largos** en nada de lo generado (pasa por el mismo lint
  que el resto del texto de producto).

## 4. Datos

Tabla nueva `SpeakingPrompt`, para no pagar dos veces la misma pregunta y
para poder editarla en Studio más adelante:

| Campo | Tipo | Nota |
|---|---|---|
| `id` | cuid | |
| `language` | String | igual que `Favorite.language` |
| `word` | String | lema guardado |
| `storySlug` | String | historia de origen |
| `question` | String | texto de la pregunta |
| `characterName` | String? | del reparto |
| `voiceId` | String | voz usada para el audio |
| `level` | String | `JourneyStory.level` en el momento de generar |
| `createdAt` | DateTime | |

Único en `[language, word, storySlug]`. La primera vez que un usuario llega a
esa palabra se genera y se guarda; las siguientes se leen. No se guarda nada
del usuario aquí: la transcripción y el resultado NO se persisten en el
piloto (solo el score de SRS y la métrica de sesión, como los otros tipos).

Tipo compartido en `src/lib/practiceExercises.ts`:

```ts
type SpeakingExercise = {
  type: "speaking";
  id: string;
  word: string;
  surface?: string | null;
  translation: string;
  storySlug: string;
  language: string;
  voiceId?: string | null;
  sentence: string; // frase de la historia, para el prompt y la frase modelo
};
```

`PracticeMode` gana `"speaking"`. `MIXED_PRACTICE_PLAN` pasa a tener UN slot
de speaking (sustituye al tercer `context`, posición 8 de 10). El checkpoint
de tema (`buildTopicCheckpointPracticeSession`) NO cambia en el piloto.

## 5. API

Se amplía `src/app/api/mobile/speaking/route.ts` con dos acciones y se
retiran las dos del prototipo (`prompt`, `reply`):

**`action: "question"`** → entrada `{ word, surface, translation, sentence,
storySlug, language }`. Salida `{ question, characterName, voiceId, cached }`.
Lee o crea `SpeakingPrompt`. Aplica G1, G2, G3.

**`action: "grade"`** → entrada `{ word, surface, question, sentence,
language, audioBase64, mimeType }`. Salida `{ transcript, correct, formFound,
feedback }`. Whisper con pista de idioma; luego G5 y G6 en UNA llamada al
LLM. Tope de audio 6 MB (ya existe).

El audio de la pregunta lo pide el cliente a `sentence-tts`, como hace con
los otros tipos; la ruta de speaking no toca ElevenLabs.

Proveedores: Whisper-1 (OpenAI, ya en uso) para STT; `chatCompletion` de
`llmProvider` para las dos llamadas de texto, con el proveedor que esté
configurado. Sin piezas nuevas.

Gate de plan en el piloto (confirmado por el usuario el 2026-09-14): **solo
`polyglot`**, que hoy tiene una sola persona, el usuario. Dos capas:

- Servidor: la ruta devuelve 403 a cualquier plan que no sea `polyglot` u
  `owner` (ya está así).
- Cliente: el móvil pasa `speakingEnabled: effectivePlan === "polyglot"` al
  builder, así el slot de speaking ni siquiera entra en la sesión mixta de
  los demás y ningún usuario real ve un ejercicio que no puede resolver.

Al publicar pasa a `premium` (y al trial de 7 días) según
`project_subscription_model_2026_09`; ese cambio es una línea y NO forma parte
del piloto.

## 6. Integración (lo que el ejecutor toca, en orden)

1. `src/lib/practiceExercises.ts`: `PracticeMode`, `SpeakingExercise`,
   `createSpeakingExercise`, rama en `buildPracticeSession`, caso en
   `getExerciseAnchor`, slot en `MIXED_PRACTICE_PLAN`. Nueva preferencia
   `speakingEnabled` en las prefs del builder; la web pasa `false`.
2. `prisma/schema.prisma`: modelo `SpeakingPrompt` + migración.
3. `src/app/api/mobile/speaking/route.ts`: acciones `question` y `grade`.
4. `apps/mobile/src/mobile/PracticeOrbit.tsx`: `"speaking"` en
   `PracticeModeKey`, `MODE_COLORS`, `MODE_ICONS` (`mic`), `MODE_LABELS`,
   `MODE_ORDER`.
5. `apps/mobile/src/mobile/MobileLibraryShell.tsx`: unión duplicada de modos y
   `PRACTICE_MODE_CARDS`; `mapSharedExerciseToMobile` con `kind: "speaking"`;
   rama de render junto a la de `multiple-choice`; `resolveSpeakingAnswer`
   (mismo contrato que `resolvePracticeMultipleChoiceAnswer`: `practiceReviewScores`,
   `practiceScore`, `practiceSessionStreak`, sonido); exención del temporizador
   y del auto-avance por `kind`; auditoría de cada guard `kind !== "multiple-choice"`
   para que el nuevo tipo no se salte en silencio; `orbitModeBreakdown`.
6. Grabación: mover el micro de `PracticeSpeaking.tsx` a un hook
   `useSpeakingRecorder` (preset `HIGH_QUALITY`, `allowsRecordingIOS` de ida y
   vuelta, base64) y borrar `PracticeSpeaking.tsx` y su tarjeta de entrada.
7. Métricas: `metadata.mode = "speaking"` en `POST /api/mobile/metrics`;
   `speaking_skipped_no_mic` como evento propio. SRS por `PATCH /api/mobile/favorites`
   como los demás. Sin XP nuevo.
8. `src/app/practice/page.tsx`: pasar `speakingEnabled: false` al builder y
   filtrar `type === "speaking"` de cualquier set curado por si llega.
9. `src/lib/storyPracticeSets.ts`: `buildPayload` tiene switch exhaustivo;
   añadir el caso con `payload = { translation, sentence, storySlug, language }`
   aunque los sets curados no generen speaking en el piloto.
10. `docs/rules-inventory.json`: filas para G1 y G5 con su gate (el test de
    la ruta), por la regla de "pedir una vez".

Tests mínimos: unitario de G1 (pregunta con la palabra, con y sin acento),
unitario de G5 (transcripción con forma verbal, sin la palabra, vacía), y
`createSpeakingExercise` devolviendo `null` sin `storySlug`.

## 7. Fuera del piloto (explícitamente)

- Web con micrófono del navegador.
- Sets curados con speaking y edición en Studio.
- Cambio del gate de plan a `premium`.
- Más de un slot de speaking por sesión mixta y el checkpoint de tema.
- Idiomas distintos del español: solo necesitan la pista de Whisper y la voz
  de frase del idioma, que ya existen; se abren después de aprobar el español.
- Guardar transcripciones para revisión.

## 8. Coste por ejercicio (orden de magnitud)

| Pieza | Cuándo | Coste aprox. |
|---|---|---|
| Pregunta (LLM) | una vez por `[language, word, storySlug]` | < 0,01 USD |
| Audio de la pregunta (ElevenLabs, ~60 caracteres) | una vez por pregunta y voz, cache R2 | ~60 créditos |
| Whisper (≤ 12 s) | cada respuesta | ~0,001 USD |
| Calificación + feedback (LLM) | cada respuesta | < 0,01 USD |

No hay gasto de créditos en el desarrollo: el ejecutor prueba con UNA
palabra y UNA voz aprobada, y el audio de la pregunta cae en la caché.

## 9. Criterio de aceptación

- El usuario abre una sesión mixta en su iPhone (build Release) con palabras
  guardadas de un journey en español y aparece UN ejercicio de speaking.
- El personaje tiene nombre y voz de la historia; la pregunta no contiene la
  palabra; una respuesta con la palabra da acierto y suena el acierto; una
  sin ella da fallo.
- La misma palabra en una segunda sesión reutiliza la pregunta (`cached: true`).
- La web no muestra ningún ejercicio de speaking.
- `npm run typecheck` del móvil y los tests de la ruta en verde;
  `npm run lint:rules-inventory` en verde.

El veredicto lo da el usuario probando, no el chat.

## 10. Ejecución

Un encargo, un chat ejecutor (Opus), un commit por punto de la sección 6
en la misma rama; nada se sube a `main` hasta que el usuario lo pruebe en su
móvil (`feedback_phone_before_testflight`). Estado que asume el encargo: el
prototipo del commit `b767528c` sin cambios, `OPENAI_API_KEY` presente, sin
modelo `SpeakingPrompt` en el esquema. Si el ejecutor encuentra otra cosa,
reporta al chat de planificación antes de tocar nada.
