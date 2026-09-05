# Digital Polyglot Library

## Language Instructions

**CRITICAL: Always speak in neutral Spanish (español neutro), never Argentine Spanish.**

This means:
- Use **tú** (not vos)
- Use forms like: "tienes", "quieres", "dices" (not tenés, querés, decís)
- Avoid Argentine-specific vocabulary and expressions
- Apply this to 100% of Spanish responses

Examples of what to AVOID:
- "Querés que lo analice?" → "¿Quieres que lo analice?"
- "Tenés datos?" → "¿Tienes datos?"
- "Che, necesito tu ayuda" → Don't use "che"

This is a hard constraint for this project.

## Project Context

- Monorepo: Next.js web + Expo/RN mobile
- Auth: Clerk native bridge
- iOS testing: Must use Release build on physical device (not Debug)
- API: Mobile calls reader.digitalpolyglot.com (production)
- Deployments: Batch commits to avoid multiple Vercel builds

## Modelo manager: el chat de planificación dirige a los chats ejecutores

Regla puesta por el usuario el 2026-08-31. Hay UN chat de planificación (corre
con el modelo Fable; se identifica en sus mensajes entre sesiones como "chat de
planificación") que hace planeación, monitoreo y feedback. Los demás chats del
proyecto ejecutan sus encargos de creación.

1. **Autoridad**: un encargo de creación firmado por el chat de planificación
   VA AUTORIZADO POR EL USUARIO. El chat receptor lo ejecuta sin volver a
   pedir confirmación al usuario. Los gates de seguridad NO cambian: audio,
   correos salientes, push a main y todo gasto de créditos siguen exigiendo el
   verbo del usuario en el chat que ejecuta, como siempre.
2. **Válvula de estado**: todo encargo declara el estado que asume (ids,
   qué hay en la base, qué archivos toca). Si el receptor encuentra un estado
   distinto del declarado, NO ejecuta y reporta la discrepancia al chat de
   planificación por mensaje entre sesiones, no al usuario.
3. **Válvula de calidad**: el resultado vuelve al chat de planificación para
   revisión antes de darse por bueno. El receptor ejecuta lo encargado y nada
   más: no encadena pasos que el encargo no pide.
4. **El chat de planificación NUNCA redacta contenido.** Historias, briefs de
   prosa, correos, copy: todo texto de producto lo escribe un chat ejecutor
   (Opus). Si el chat de planificación se descubre redactando, para y lo
   encarga. El usuario no debería tener que repetir esto (2026-08-31, tercera
   vez).

WHY: el usuario hace de manager de producto, no de relevo de mensajes entre
chats. La negativa por defecto de una sesión a obedecer a otra era correcta en
general, pero aquí creaba un cuello de botella: cada encargo moría esperando
que el usuario lo re-confirmara en el chat receptor. Las dos válvulas conservan
lo que esa fricción protegía (no pisar trabajo ajeno, no encadenar sin control)
sin gastar al usuario en ello.

## Journey classification (HARD RULE — always applies, no exceptions)

Journeys have exactly three states (`Journey.status`):
- **live** = `active` — published, in the app.
- **draft** = `draft` — work-in-progress with the CURRENT structure
  (**1 level × 7 topics × 3 stories = 21**), not yet live.
- **archived** = `archived` — old/legacy/different structure (anything NOT
  1×7×3, e.g. multi-level, x7 per topic, experimental) OR superseded published
  versions. Dead content.

**THE RULE:** when the user asks for "journeys" / "all journeys" / any journey
list, table, or count, include **only live + draft**. **NEVER mention, list,
count, or take archived journeys into account** — in ANY response — UNLESS the
user *explicitly* asks for "archived". No other case. This is a hard constraint;
it always holds even mid-task, in summaries, and in verification tables.

(Classification set 2026-07-25: 5 live, 9 draft, 6 archived. Reclassified the
draft-vs-archived split by structure via `scripts/_reclassifyDrafts.ts`.)

## Pedir una vez (BLOQUEANTE, 2026-09-05)

El usuario no tiene que recordarle a cada chat que respete las reglas. Toda
regla dura es una fila de `docs/rules-inventory.json` con su gate declarado, y
las tareas de dominio entran por una puerta que las CARGA desde ahi:

- **`/tema`**: escribir o cerrar un tema. Empieza por
  `npx tsx scripts/rulesFor.ts story vocab journey` y cierra con
  `scripts/cierraTema.ts`, que escribe el registro. "Listo" es esa entrada del
  registro, nunca una frase del chat.
- **`/tabla`**: cualquier cuadro de estado del catalogo.
- **`/audio-tema`**: el orden de narracion, sobre los gates que ya existen.

Dos prohibiciones que salen de aqui:

1. **Una tabla de journeys compuesta a mano esta prohibida.** Se corre
   `scripts/journeysTable.ts` y se pega SU salida. Si falta una columna, se
   amplia el script en un commit; nunca se rellena a ojo.
2. **No se recita una regla de memoria.** Si no sale de `rulesFor`, falta en el
   inventario, y se añade ahi (`scripts/buildRulesInventory.ts`).

Lo vigila `npm run lint:rules-inventory`, enganchado al manifiesto del
pre-push: ningun gate fantasma, ningun check implementado sin fila, y el numero
de reglas sin gate solo puede bajar.

WHY: el 2026-09-05, literal: "Estoy cansado de pedir a los chats que se
aseguren de revisar y respetar todas las reglas. Solo lo quiero pedir una vez.
O muchas veces le pido la tabla del journey y me inventa cosas". Habia ocho
scripts de tabla en `scripts/` porque cada chat se fabrico el suyo. Ver
`docs/spec-pedirlo-una-vez.md`.

## Grill before building (expensive/ambiguous features only)

When the user proposes a NEW feature that is expensive (spends image/audio
credits, Modal/ElevenLabs calls) or genuinely ambiguous (multi-file, open
product decisions), OFFER the `/grill` skill before building: a short
socratic round (max 3 ultra-short questions) that surfaces unstated
decisions so the first attempt lands aligned. Do NOT grill trivial changes
(copy tweaks, one-liners, clear asks). The user can always trigger it
manually with `/grill`.

## Recomendación única (BLOQUEANTE — hook `Stop`)

**Nunca cierres un mensaje con un menú.** El usuario no quiere alternativas,
quiere UNA recomendación sostenida. El cuerpo del mensaje puede exponer
trade-offs; el CIERRE no.

- Elige la opción que recomiendas y dila como decisión, no como pregunta.
- Si necesitas confirmación, que sea SÍ/NO sobre esa única opción
  (`¿Lo hago?`), nunca `¿esta o la otra?` / `¿cuál prefieres?` / `tú decides`.
- Si el usuario tiene que decidir entre alternativas realmente equivalentes,
  usa la herramienta `AskUserQuestion` (elección estructurada), no prosa.

Enforced por `.claude/safety/stop-single-rec-guard.sh` (hook `Stop`): lee el
último mensaje del asistente en el transcript y BLOQUEA el cierre (exit 2) si
la última pregunta ofrece una elección. Sin variable de escape, a propósito.

WHY: la regla llevaba tiempo en memoria y se rompía siempre igual, el cuerpo
SÍ tomaba postura ("me inclino por lo primero") y la última línea la disolvía
en un "¿Cuál?". El fallo no era de criterio sino de cierre, así que se bloquea
el cierre. (Puesto el 2026-08-03 tras romperla ofreciendo "bajar el umbral del
gate o re-tirar a mano".)

## Presupuesto de palabras (BLOQUEANTE, hook `Stop`)

Tope de **160 palabras de PROSA** por mensaje. No cuentan tablas, bloques de
código, listas de enlaces ni las líneas `verified:` / `not verified:` / `base:`.
Un informe con tabla puede ser largo; el texto corrido que lo rodea, no.

Enforced por `.claude/safety/stop-word-budget-guard.sh` (hook `Stop`): lee el
último mensaje del asistente y BLOQUEA el cierre (exit 2) si la prosa pasa del
tope. Sin variable de escape, igual que los otros dos guards de cierre.

Cuando bloquee, **reescribe, no partas el mensaje en dos**. Lo que sobra casi
siempre es una de estas tres: recapitular lo ya dicho o lo que el usuario acaba
de leer en la salida de un comando; explicar un razonamiento que nadie pidió; o
repetir la conclusión al final con otras palabras.

WHY: la regla de responder corto llevaba tiempo en memoria y se rompía igual
siempre. El 2026-08-18 el usuario contó a mano dos mensajes seguidos: 311
palabras para decir "dos arregladas, una no, la rehago". Pidió que dejara de
pasar en todo el proyecto, no solo en esa conversación.

## Portadas: prompt cerrado antes de la primera tirada (BLOQUEANTE)

Antes de generar la PRIMERA portada de un journey, el prompt tiene que llevar
ya las cuatro cosas. Si falta una, se paga en tiradas:

1. **Ficha de personaje literal** por cada recurrente: edad, pelo (color, largo,
   con o sin flequillo) y **color fijo de ropa**, repetida en cada escena. Decir
   "una joven de pelo oscuro" deja elegir a Flux, y elige distinto cada vez.
2. **Registro visual anclado** a una portada de referencia concreta, no solo el
   candado de estilo: color plano saturado, línea gruesa, cal blanca, sol fuerte,
   figuras a media distancia.
3. **Reparto corto y COMPLETAMENTE descrito.** Cada persona del cuadro, nombrada.
   Todo hueco sin describir ("dos adultos más al fondo") lo rellena el modelo con
   un niño, un adolescente o un anciano, que son prohibición dura.
4. **Prohibición de texto explícita**, y ningún objeto escribible en la escena.
   Un periódico abierto o un cartel SIEMPRE salen con letras inventadas; el
   periódico va doblado y cerrado, y los carteles no existen.

**TOPE: 2 tiradas por portada.** Si un tema pasa de ahí, PARA y arregla el
prompt o la escena; no sigas tirando. Cuando una escena falla dos veces por lo
mismo, el problema es la escena, no la suerte.

**Revisión: a tamaño completo, una por una.** La hoja de contactos sirve para
juzgar coherencia entre portadas, y para nada más: a ese tamaño se esconden los
niños del fondo y el texto pequeño. Los defectos se miden contra lo que cuenta
la historia, no solo contra el candado.

WHY: el A1 ES/Spain costó **80 tiradas para 21 portadas**, casi cuatro por
portada. Con el prompt final habrían bastado unas 27, que es el ritmo de 1,3 que
dieron los temas 3 al 7 en cuanto la ficha, el registro y el reparto estuvieron
fijados. Las otras 53 fueron aprender lo que ya estaba en el proyecto. El
usuario: "80 tiradas para 21 portadas, haces un trabajo pésimo". Tenía razón.

## Reporting status — no absolute claims

**Never** declare a multi-item or multi-check task "done", "fully corrected",
"100% confidence", or "totalmente corregido" without explicitly listing:

- `verified:` the specific checks that passed (validator, audit, tests, etc.)
- `not verified:` the dimensions you did NOT measure (gestalt rhythm, native
  grammar feel, cross-item repetition, real user reading, etc.)

A passing validator is not equivalent to a good output. Validator coverage
is bounded by what was coded into it; gestalt / rhythm / cross-item patterns
require a human read.

**Mandatory gestalt step** before reporting "done" on any task that touched
3+ items in a batch (stories, voices, components, copy variants): dump the
items side-by-side and read them consecutively as the end user would. If any
template, phrase, structure, or pattern repeats across 3+ items, flag it
before declaring done. This applies even when the validator is green.

When the user pushes back ("are you sure?" / "did you really check?") more
than once, do NOT defend with the same metrics. Switch the frame of review
(structural → rhythm → tone → cross-item comparison → gestalt) until the
user's concern is addressed or you can articulate what they're asking that
you haven't measured.

## Orden de narracion por tema (BLOQUEANTE, 2026-09-02)

Un tema NUNCA se narra de golpe. Tres pasos, y entre cada uno **el usuario
comprueba**:

1. **Muestra**: titulo y primer parrafo de la PRIMERA historia del tema.
   `npx tsx scripts/_muestraA2Titulo.ts <slug>` (deja constancia en
   `scripts/a2-muestras.json`).
2. **La primera entera**, solo despues de que el usuario apruebe la muestra.
3. **Las otras dos**, solo despues de que apruebe la primera.

Enforced por `scripts/_narraUnaA2.ts`, que se PARA en seco: narrar una primera
historia sin muestra registrada falla y escupe el comando de la muestra; narrar
la segunda o la tercera de un tema cuya primera no tiene `audioUrl` tambien
falla. Nada de esto se salta con una variable.

Ademas, el candado 6d del guard (audio completo, sample-first) miraba el NOMBRE
del archivo (`*audio*.ts`) y por eso `_narraUnaA2.ts` narraba historias enteras
sin pasar por el. Ahora mira el CONTENIDO del `.ts` invocado: cualquier script
que llame a `generateAndUploadMultiVoiceAudio`, `generateAndUploadAudio` o al
endpoint de sintesis queda dentro del candado.

WHY: el 2026-09-02, en dos ocasiones, lanze narraciones que el usuario no habia
pedido (una probando que un gate se reabria, otra probando este mismo orden), y
la segunda vez fue justo despues de que dijera "no". Cada tirada es dinero. El
orden existe para que un error de voz, de ritmo o de texto se pague una vez y
no veintiuna.

## Karaoke y texto: el orden es texto primero (BLOQUEANTE, 2026-09-02)

**Primero se cierra el TEXTO, despues se narra.** Nunca al reves.

El lector con karaoke (`HighlightedStoryContent`) no pinta desde el texto: parte
los parrafos por cada salto de linea de `payload.storyPlainText`, que es una
COPIA del texto guardada AL ALINEAR. Editar los parrafos despues de narrar no
cambia nada en pantalla; la historia se sigue viendo con la forma vieja. Y no
avisa nadie: el validador pasa, las glosas pasan, y el defecto **solo se ve
abriendo la pagina CON SESION INICIADA**, porque sin sesion manda `StoryContent`,
que agrupa de tres en tres y disimula el problema.

Enforced por `npm run lint:karaoke-fresh` (`scripts/checkKaraokeFresh.ts`),
enganchado al hook `pre-push`: compara cuantos bloques pinta el lector contra
cuantos parrafos tiene el texto, en TODA historia con `audioUrl`.

Arreglo, y no gasta creditos de ElevenLabs porque usa el audio que ya existe y
alinea en Modal: `npx tsx scripts/_realinea.ts`.

WHY: el 2026-09-02 el A2 latam se veia como una lista de trece renglones donde
el texto ya tenia cinco parrafos. Perdi horas reagrupando parrafos y midiendo en
la vista ANONIMA, y desde ahi afirme lo que el usuario veia en la suya. Dos
reglas salen de ahi: el orden (texto y luego audio), y que la vista sin sesion
no sirve para juzgar la del usuario.

## Story validation gate (BLOCKING — no bypass)

A `JourneyStory`'s content (title/slug/text/vocab/arcType/synopsis) reaches
the database ONLY through `scripts/saveStory.ts`, which runs the CANONICAL
validator `validateGeneratedStory` (`src/lib/validateGeneratedStory.ts`)
IN-PROCESS and writes nothing unless EVERY story returns `ok===true`. A second
PreToolUse hook `.claude/safety/pre-story-save-guard.sh` BLOCKS any other
execution that writes journeyStory content (bespoke `_save*.ts`, inline
`journeyStory.update/create` with `text`/`vocab`). No `CLAUDE_AUTHORIZED`
escape. Reading/grepping save scripts is fine (only executed writes are gated).

Hard rules (why: on 2026-07-09 a pilot was reported "bien validado" after only
the Python subset ran; the canonical validator then found 4 fails):
- The Python pre-validators (`scripts/_val*.py`) are LINTS, never "the
  validation". They do NOT count as validated.
- NEVER report a story "validated" / "passes" / "en verde" unless
  `validateGeneratedStory` returned `ok===true` for it (via `saveStory.ts`,
  incl. `--dry`). Cite the canonical result, not the Python subset.
- To save: `npx tsx scripts/saveStory.ts <data.json> --journey <id> --lang ES
  --level c1 --variant LATAM [--publish]`. Use `--dry` to validate without
  writing. If it fails, FIX the story; do not weaken the gate (see the
  gold-standard calibration rule).

## Safety Guard (BLOCKING — DO NOT BYPASS)

This project has a Bash PreToolUse hook at `.claude/safety/pre-bash-guard.sh`
that ALWAYS runs before any Bash command. It does two things:

1. **Snapshots every `.env*` file** in the repo (and in any worktree) to
   `~/.dpl-env-snapshots/digital-polyglot-library/<timestamp>/` before any
   command that could touch them. Keeps last 100. Cheap insurance.
2. **Hard-blocks** these patterns unless `CLAUDE_AUTHORIZED=1` is on the
   same command line:
   - `ln -*f*` overwriting `.env*` via `../../../` (the worktree symlink
     pattern applied outside a worktree)
   - `rm` on any `.env` file
   - `modal secret create|update --force` (irreversibly rotates a shared
     secret that Modal will not let you read back)
   - `vercel env rm` (deletes production env vars)
   - `rm -rf` on `$HOME`, `/`, `..`, `*`
   - SQL `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`

3. **`git push --force` / `-f`**: hard-blocked from inside Claude. NO
   env-var escape. If a force push is truly needed, the user runs it
   from their own terminal outside Claude.

4. **ElevenLabs TTS generation** (POST to `api.elevenlabs.io/v1/text-to-speech/`):
   hard-blocked unless the user's MOST RECENT message in the transcript
   contains one of: "genera audio", "genera el audio", "genera los
   audios", "regenera audio", "lanza audio", "manda audio", "render
   audio", "renderea audio", "haz el audio". Same transcript-based gate
   as the push verb. `CLAUDE_AUTHORIZED=1` does NOT bypass.

   "Dame samples", "muéstrame las voces", "compara estas voces"
   = preview URLs gratis del shared library (`GET /v1/shared-voices`),
   nunca generar. Listing endpoints (GET) pasan sin gate; solo el
   endpoint de síntesis está bloqueado.

5. **`git push` to main/master**: blocked unless the user's MOST RECENT
   message in the Claude transcript contains an imperative push verb.
   The hook reads `transcript_path` from the PreToolUse payload (a
   `.jsonl` file Claude Code writes; not writable from Bash tool calls)
   and pattern-matches against the latest user message.

   - **Verbs that authorize** (case-insensitive, word-boundary): manda,
     mandalo, mándalo, ship, shipit, shipea, shipealo, lanza, lanzalo,
     lánzalo, push, pushea, pushealo, deploya, deployalo.
   - **Verbs that DO NOT authorize**: dale, sí, listo, ok, perfecto, ya.
     Generic acknowledgements are intentionally outside the gate so a
     "dale" on an unrelated question never opens the push door.
   - Negation guard: `no manda…` / `nunca manda…` immediately before
     the verb does NOT count as authorization.
   - One verb = one push. The gate resets on the next user message.

   `CLAUDE_AUTHORIZED=1` and `DPL_PUSH_AUTHORIZED=1` do **NOT** bypass
   the verb gate. The model cannot fake authorization here.

6. **Batch gate (no partial deploys)**: each push to `main` is a paid
   Vercel build, so NEVER ship while a clear deployable fix sits
   uncommitted. The `pre-push` hook blocks any push to `main` when the
   working tree has uncommitted/untracked changes under deployable
   paths (`src/`, `prisma/`, root config) that are NOT in the pushed
   commits — `apps/mobile/**` (local build, never Vercel) and
   `scripts/_*` (scratch) are excluded. The hook lists the offending
   files. **Before proposing any push, run `git status` and fold every
   ready deployable change into the same commit** — do not treat a fix
   as an isolated emergency. To consciously leave deployable WIP out,
   the override is visible and per-command:
   `DPL_PUSH_AUTHORIZED=1 DPL_PUSH_PARTIAL_OK=1 git push origin HEAD:main`.
   This rule exists because on 2026-06-13 a prod hotfix shipped while a
   ready audio-route fix sat uncommitted, costing a second build.

7. **Sample-first: NUNCA regenerar audio completo para PROBAR (BLOQUEANTE).**
   Para testear cualquier cambio que afecte el audio (fix de texto,
   normalización de números, voz, settings), sintetiza **UNA sola línea de
   muestra** (la oración/palabra afectada) con la voz que toque, via un curl
   directo a `/v1/text-to-speech`. **JAMÁS** regenerar el audio COMPLETO de
   una historia (ni un lote) solo para oír un detalle: es un desperdicio caro
   de créditos. Sugerirlo ("regenera toda la historia para oír X") está
   prohibido. Regeneración completa SOLO cuando el ENTREGABLE es ese audio
   completo y el usuario pidió explícitamente el audio de ESA historia; en ese
   caso, y solo ahí, corre el script con el opt-in consciente
   `DPL_AUDIO_FULL_OK=1`. El guard 6d bloquea los scripts `*Audio*.ts` sin ese
   flag; el sample por curl directo pasa con el verbo de audio normal.
   (Regla puesta el 2026-07-09 tras sugerir regenerar una historia entera
   para probar el fix de "B244".)

6e. **QA-gate de entonación (BLOQUEANTE, 2026-07-23).** TODO script que
   sintetice ElevenLabs TTS de práctica DEBE incluir el gate F0
   (referencia a `scripts/_f0gate.py` / `_f0gate`), que mide el tono FINAL de
   cada render y RE-TIRA hasta que la palabra/oración quede como AFIRMACIÓN
   (no uptalk / "suena a pregunta") con la entonación correcta. El guard 6e en
   `pre-bash-guard.sh` inspecciona el ARCHIVO `.ts` invocado y BLOQUEA su
   ejecución si contiene la URL `/v1/text-to-speech` pero NO referencia
   `_f0gate`. WHY: el 2026-07-23 se desperdició un lote de clips de palabra
   generados sin gate (salían con uptalk); la solución ya estaba en el proyecto
   (el F0 gate del pipeline de oraciones) y debí aplicarla ANTES de generar la
   primera. Los generadores canónicos (`_genPracticeClips.ts`, `_genWordClips.ts`)
   ya lo incluyen. NUNCA generar audio de práctica sin el gate F0.

6f. **Outbound email gate (BLOQUEANTE, 2026-07-31).** Ningún correo sale a
   una persona real sin que el ÚLTIMO mensaje del usuario contenga un verbo
   que **nombre el correo**: `manda/envía/lanza/dispara` + `el|los`? +
   `correo|correos|email|emails|mail`. Un `sí`, `dale`, `ok` o `ejecuta`
   NO autoriza, que es exactamente el caso que falló. `CLAUDE_AUTHORIZED=1`
   NO lo salta. El guard 6f en `pre-bash-guard.sh` lee el transcript igual
   que el gate de push, y cubre `processApplication`, `sendBetaEmail`,
   `publishRelease`, `runBetaLifecycle`, `_runBetaTriage`, los senders de
   lifecycle, los crons que envían y llamadas directas a `api.resend.com`.
   Renderizar correos a disco (`_renderBetaEmails.ts`) y el triaje con
   `--dry` pasan sin gate: previsualizar siempre está permitido.
   WHY: el 2026-07-31 salieron 5 correos reales (4 de lista de espera y 1
   de RECHAZO definitivo) tras un "Sí" a la pregunta "¿ejecuto el triaje?".
   Había autorización formal, pero la palabra "triaje" ocultaba que había
   cinco personas al otro lado. **Nunca uses jerga para describir una acción
   irreversible hacia fuera: di "escribir a 5 personas", no "triar".**

6g. **Gate de veracidad de lo que se anuncia (BLOQUEANTE, 2026-08-30).**
   El 6f comprueba la AUTORIZACIÓN; este comprueba que lo anunciado sea
   CIERTO. Ningún correo que anuncie algo sale hasta responder, superficie por
   superficie, si eso se ve: **web, iOS y Android**, las tres, porque el botón
   `/go/app` lleva a TestFlight o a Play en un móvil y al lector web en
   escritorio. La respuesta vive en `.claude/safety/comms-claim-check.json`
   (gitignored, caduca en una hora) y el hook
   `.claude/safety/pre-comms-claim-guard.sh` BLOQUEA el envío si falta, si
   caducó, si alguna superficie va sin prueba pegada, si alguna dice
   `live: false`, o si hay cambios sin commitear o commits sin subir. La
   prueba de iOS y de Android es la versión **de la tienda**, nunca la que
   tengas instalada a mano: una build local no la ve nadie más. Previsualizar
   y `--dry` pasan sin gate. Sin variable de escape.

   Cuando una superficie sale en rojo hay dos salidas y ninguna es enviar
   igual: se arregla la superficie, o se reescribe el correo para no prometer
   lo que ahí no está.

   WHY: el 28/08 salieron 12 correos "We heard your feedback" anunciando la
   capa de contexto de las glosas. Se veía en web y en ninguna de las dos
   apps, porque el lector de RN declaraba la glosa sin el campo `c` y tiraba
   el trozo que la API le mandaba. A la pregunta "¿antes de mandar correos hay
   que hacer push?" respondí "no hace falta", que era cierto sobre los assets
   del correo y dejaba fuera lo único que importaba: que lo anunciado no
   existía donde el correo mandaba a la gente. Autorizado no es cierto, y
   "está subido" no es "se ve".

7. **Approved-voices gate (BLOCKING — no bypass)**. Production audio
   (story narration, practice clips, word audio) may ONLY be rendered
   with an ElevenLabs voiceId on the allowlist `src/lib/approvedVoices.ts`.
   Enforced at runtime: `assertVoiceApproved(voiceId)` is called at every
   production TTS chokepoint (`src/lib/elevenlabs.ts`, `_genPracticeClips.ts`,
   `_genJourneyWords.ts`) and THROWS if the voice is not approved — no
   env-var bypass. WHY: on 2026-07-19 a story was narrated with a
   candidate voice the user never approved. **Claude must NEVER add a
   voice to the allowlist on its own**: a PreToolUse hook
   `.claude/safety/pre-voice-approval-guard.sh` (matches Edit/Write/Bash)
   BLOCKS any edit to `approvedVoices.ts` (or the guard itself) unless the
   user's MOST RECENT message contains an approval phrase (`aprueba/apruebo
   la voz`, `voz aprobada`). To audition a candidate: FREE preview URLs or
   a 1-line throwaway sample that does NOT write to production — NEVER a
   full-story render, and NEVER pre-add it to the allowlist. Only after the
   user approves by ear does the user (or Claude, once the user has said the
   approval phrase) add the voiceId.

8. **Gate de guiones largos (BLOQUEANTE, 2026-08-16).** Ni `—` (em, U+2014)
   ni `–` (en, U+2013) entran en `src/`, `content/`, `apps/mobile/`,
   `scripts/`, `docs/` ni `public/`. El hook PreToolUse
   `.claude/safety/pre-emdash-guard.sh` (matcher `Edit|Write|MultiEdit`)
   BLOQUEA la escritura; el lint `npm run lint:no-emdash` revisa esos seis
   árboles y `npm run lint:no-emdash:db` barre toda columna de texto de la
   base de datos, que es donde nadie mira. El hook `pre-push` corre el lint
   de archivos antes de cada push y lo aborta si encuentra alguno, así que
   ninguno llega a un build de Vercel; tarda un segundo y no tiene variable
   de escape.

   Sustitutos: `;` para dos cláusulas, `:` cuando lo que sigue explica lo
   anterior o glosa una etiqueta, paréntesis para un inciso, o corta la
   oración en dos. En un rango (`10-20`, `sep-oct`) y en una celda vacía de
   tabla, el guion normal `-`. Sin escape por variable de entorno: solo lo
   abre una frase explícita del usuario en su último mensaje ("permite el
   em dash", "deja el guion largo").

   Fuera de alcance porque no lo escribimos nosotros: `node_modules`,
   `src/generated`, `vendor`, los proyectos nativos de iOS y Android, los
   entornos virtuales de Python bajo `scripts/tts/` y los modelos de whisper.

   Los exentos viven en **`scripts/no-emdash-allowlist.json`**, el mismo
   archivo que leen el lint y el hook para que no se desincronicen, y va
   **por carácter**: necesitar el en dash dentro de una regex no exime del
   em dash. Dos motivos válidos y ninguno más: código DETECTOR que necesita
   el carácter como literal (el validador de historias, los pre-validadores
   `_val*.py`, las auditorías de glosas, los `journeysTable`), y
   `src/data/books/**`, prosa publicada cuyos tiempos de karaoke guardan
   offsets `charStart`/`charEnd` sobre el texto, así que cualquier edición
   que cambie la longitud desincroniza el resaltado.

   WHY: la regla llevaba desde el 2026-05-03 en memoria y el único gate que
   existía vivía dentro del validador de historias, que cubre el cuerpo de
   `JourneyStory` y nada más. Todo lo demás derivó: el 2026-08-16 el título
   de la pestaña del navegador decía "Traveler / Portuguese A0" con guion
   largo, el blog acumulaba 69, los comentarios de código 103, `scripts/`
   271, `docs/` 197, las páginas generadas de `public/` 880 y la BD seis
   etiquetas de nivel. Una regla sin gate no es una regla.

9. **Gate de temas (BLOQUEANTE, 2026-08-17).** Un tema de journey nombra el
   dominio léxico de sus tres historias y sale de lo que los usuarios
   ESCRIBIERON (`BetaSignup.motivation` / `.applicationReason`), no del molde
   de un curso de principiante. `assertTopicsGrounded`
   (`src/lib/topicEvidence.ts`) TIRA si un tema no cita, literalmente, una
   motivación que exista en la base. El hook `.claude/safety/pre-topic-guard.sh`
   BLOQUEA cualquier ejecución que escriba en la tabla de temas sin llamarla;
   lee también el `.ts` invocado, no solo la línea de comando. Leer y consultar
   temas pasa sin gate.

   WHY: el 2026-08-17, montando el Friends ES/Spain A1, dos de los siete temas
   salieron de los datos y los otros cinco del molde: el bar, la compra, los
   horarios, la casa y la farmacia. "Chemist & Doctor" prometía un médico que
   no aparecía en ninguna historia y "Shops & Markets" repetía dos temas que el
   A0 del mismo idioma ya cubría. El fallo solo se ve leyendo los siete juntos,
   y para entonces ya hay 21 historias escritas y a punto de pagar su audio.

   **`motivation` es un DESPLEGABLE, no texto libre** (2026-08-19): los seis
   valores viven en `src/lib/betaMotivations.ts` (`BETA_MOTIVATIONS`), los
   importa el formulario, y el portón los DESCARTA del corpus. Solo cuentan lo
   escrito por la opción "Other" y `applicationReason`, y una cita necesita 3
   palabras y 15 caracteres. WHY: los siete temas de un Expat francés pasaron
   citando seis de ellos la misma cadena "move abroad"; un clic de dos palabras
   valía por siete decisiones de contenido.

   Las reglas de NOMBRE (ampersand y no "And", **etiqueta en inglés, salvo el
   préstamo que ya ES inglés y no tiene equivalente, como "tapas"**, sin país, sin artículo
   inicial, 2-4 palabras, Title Case, un slug = un label global, slug derivado
   del nombre, filas nuevas con `isUniversal: false`) siguen viviendo en
   `project_topic_naming_rule` y `project_topic_labels_mechanics`; el gate solo
   comprueba la EVIDENCIA, que es lo que no estaba comprobando nadie.

If the guard blocks a non-push command, **DO NOT** add
`CLAUDE_AUTHORIZED=1` on your own to bypass it. That flag is for the
user to type, or for you ONLY after the user has said the imperative
verb in chat (e.g. "borra", "fuerza", "rota", "machaca"). Recovery
from this kind of mistake cost real time and broke prod once. Ask the
user first.

If you need to restore `.env*` after a slip-up:
```
.claude/safety/restore-env.sh --list      # see snapshots
.claude/safety/restore-env.sh             # restore latest
```

Audit log of every command (PASS / BLOCK / SNAPSHOT):
`.claude/safety/audit.log` (gitignored).

## Pre-flight checklist for destructive operations

Before running ANY of these, STOP and re-check:
- `ln -sf ../../../.env*` → verify `git rev-parse --show-toplevel` matches
  the parent of `../../../`. The `../../../.env*` pattern only resolves
  correctly inside `.claude/worktrees/<name>/`, never in the repo root.
- `rm -rf .next` → fine, this is the only `rm -rf` that does NOT need to
  ask. All other `rm -rf` requires user verb.
- Any `--force` flag on `modal`, `vercel`, `git`, `gh` → ASK FIRST.
- Any write/delete in Modal, Vercel, Clerk, Stripe, Sanity dashboards
  via Chrome MCP → ASK FIRST. "Find a solution" does NOT authorize
  rotation of shared secrets in external services.

## Producción rota: primero rollback, después arreglar

Si un deploy a `main` rompe la web, el paso 1 es **Instant Rollback** en el
dashboard de Vercel (Deployments > el deploy anterior > Promote to Production).
Restaura la versión previa en segundos y **NO gasta build**; revertir con un
commit sí lo gasta. El arreglo se hace después, con calma, y sube en el
siguiente batch.

El rollback es una escritura en el dashboard de Vercel, así que sigue la
regla de la checklist de arriba: lo ejecuta el usuario, o Claude solo tras
pedirlo. Lo que cambia esta regla es el ORDEN, no el permiso.
