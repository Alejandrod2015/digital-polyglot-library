# Traspaso: prueba de nivel, puntuacion y colocacion

Escrito el 2026-09-20 por el chat `BETA_Test_de_nivel_1-Puntuacion` a partir
del transcript del chat anterior ("Likes-dislikes-testers_Insights", luego
renombrado), cuyo registro la app perdio. Su trabajo vive en la rama
`claude/nice-goldstine-b1442a` (worktree `sad-kowalevski-0c8056`), commit
`7ca4244a`. El trabajo sigue en `BETA_Test_de_nivel_1-Puntuacion`, en una
rama nueva creada desde ese commit.

## 1. Diagnostico de la prueba de nivel (2026-09-19)

Como llego el chat hasta aqui: la pestaña Engagement de `/studio/metrics`
mostraba que 3 de 4 comentarios de testers decian "dificil" o "rapido" y que
los 2 votos negativos (ambos de practica) decian "too hard". Cruzando los 45
`onboarding_finished` de fuera con su primera practica de 5 items o mas salio
que la mayoria de los desajustes venian de niveles que aun no existian (el B2
latam no se publico hasta el 2026-09-06 y la app mandaba al peldaño mas
cercano, C1), no de la prueba. Con todos los niveles publicados quedaban dos
casos B2 recientes: griffta.tg (90-97 %, se quedo) y awright14615 (30 %, bajo
sola a A0 saltandose A1, A2 y B1). Ahi el usuario pidio revisar la prueba en
si, y aparecieron estos fallos:

| fallo | efecto |
| --- | --- |
| Solo sumaba aciertos, no que preguntas se aciertan | Con 8 de 10 salias B2 aunque fallaras las dos preguntas de B2; con 6 salias B1 acertando una sola de las tres de B1 |
| Con 3 aciertos ya era A2, y hay 4 opciones por pregunta | Contestando al azar se llegaba a A2 el 47 % de las veces. De los 16 resultados reales, 9 fueron A2 y ninguno A1 |
| El resultado mas bajo era A1 | Existen journeys A0 y un principiante real no podia salir A0 |
| C1 = 10 de 10, sin ninguna pregunta de C1 | La prueba llega hasta B2 (2 A1 + 3 A2 + 3 B1 + 2 B2); el 10/10 es la unica señal por encima |
| 7 preguntas de gramatica y 3 de vocabulario muy frecuente, sin escucha | No mide lo que hace dificiles las historias: vocabulario y velocidad del audio ("Bit fast") |
| Siempre las mismas 10 preguntas | Contenido fijo para Spanish, German e Italian; no hay prueba de frances ni de portugues |
| La prueba hecha desde la biblioteca (historia bloqueada) no se registra | En `UserMetric` solo aparecen las del onboarding (`onboarding_level_test_*`) |
| El evento no guardaba cuantas acerto cada persona | Solo el nivel resultante; sin la nota no se podia juzgar la prueba |

Dato de apoyo a la decision: quien empezo un nivel por debajo del resultado
(christoph, vincent, dovedivine: test A2, empezaron en A1) acerto 93-100 % y
siguio (vincentpearson lleva 14 sesiones). Quien empezo por encima se fue o
tuvo que bajar varios niveles. Colocar demasiado alto cuesta mas que colocar
demasiado bajo.

## 2. Decision del usuario (2026-09-19, literal)

> "De todas formas creo que los niveles de la prueba de nivel no se
> corresponden con los niveles de una historia, porque si bien la gramatica
> esta al mismo nivel no lo esta el vocabulario, entonces tal vez hacer que
> la prueba de nivel tienda a poner al usuario en un nivel mas bajo y de
> todas formas decirle al usuario que creemos que ese es su nivel y que si
> desea puede probar otros niveles luego."

El chat propuso tres cambios (un nivel se alcanza acertando sus propias
preguntas; colocar un peldaño por debajo, incluido A0; decir "creemos que
este es tu nivel; puedes probar otros") y el usuario dijo "si".

## 3. Lo hecho en `7ca4244a`, archivo por archivo

`fix(nivel): la prueba cuenta por nivel y coloca un peldano por debajo`.
Solo app movil; sin build, sin push.

| archivo | cambio |
| --- | --- |
| `apps/mobile/src/mobile/levelTest.ts` | `CEFRLevel` gana `"A0"`; nuevo tipo `LevelTestQuestionLevel` (`A1`-`B2`) para las preguntas. `levelFromScore(correct)` desaparece y entran `demonstratedLevel(answers)` (un nivel cuenta solo con 2/3 de SUS preguntas acertadas, 2 de 2 o 2 de 3, y todos los de abajo; el primer nivel que falla corta la subida; 10/10 sigue siendo C1) y `placementFromTest(answers)` (un peldaño por debajo del demostrado, suelo A0). `LEVEL_ORDER` gana `A0: -1`. |
| `apps/mobile/src/mobile/LevelTestRunner.tsx` | Guarda las respuestas con su nivel (`answers: LevelTestAnswer[]`) en vez de un contador. `resultLevel` es `placementFromTest` cuando `source === "onboarding"` y `demonstratedLevel` en cualquier otro origen. `onComplete` devuelve `{ level, demonstrated, correct, total }`. Pantalla de resultado en onboarding: "We think you're at X" y "Your {language} journey starts here. Too easy or too hard? You can add another level anytime from your journeys." Fuera del onboarding sigue "You're at X". |
| `apps/mobile/src/mobile/OnboardingFlow.tsx` | El evento `onboarding_level_test_completed` añade `demonstratedLevel`, `correct` y `total` a `cefrLevel`. |

Como queda la puntuacion en casos concretos:

| caso | antes | demostrado | empieza en |
| --- | --- | --- | --- |
| 8 aciertos, las 2 de B2 mal | B2 | B1 | A2 |
| 10 de 10 | C1 | C1 | B2 |
| Contestando al azar | 47 % salia A2 o mas | 94 % A0 | 99 % A0 |

Verificado en aquel chat: `tsc` de la app sin errores en los archivos
tocados (los 3 errores que salen son de `nativeHeadlessClerk.ts`, no
tocado); los casos de la tabla y 200.000 simulaciones al azar.
No verificado: la pantalla en un telefono.

Lo que NO se toco:

- La prueba lanzada desde una historia bloqueada (`MobileLibraryShell.tsx`)
  NO baja el peldaño: ahi la prueba desbloquea, no coloca, y usa el nivel
  demostrado. Ese flujo tampoco emite ningun evento (sigue sin registrarse).
- Las preguntas: mismas 10 por idioma, mismo reparto 2/3/3/2, sin escucha,
  sin FR ni PT.
- La opcion "I have some / I can hold a chat" del onboarding sin test sigue
  colocando en B1 (es la puerta mas alta sin prueba; a rachaelvorster la
  mando a B1 y comento "Bit fast" y "Too difficult").
- El comentario de cabecera de `levelTest.ts` sigue diciendo "Spanish +
  German" aunque hay `ITALIAN_QUESTIONS`.

## 4. Pruebas de nivel de todos los usuarios hasta el 2026-09-19

Salida de la consulta sobre los 18 intentos `onboarding_level_test_*` de
`UserMetric` (el evento de entonces no guardaba aciertos, solo el nivel):

| fecha | quien | idioma / variante | resultado | 1a practica despues (nivel, acierto) | niveles practicados despues |
| --- | --- | --- | --- | --- | --- |
| 2026-06-24 | sin correo (fiWFkq) | Spanish / latam | **A2** | A2, 11% | A2 |
| 2026-08-10 | christoph.koehner@googlemail.com | Spanish / es | **A2** | A1, 100% | A1 |
| 2026-08-12 | dddrs3@icloud.com | Spanish / latam | **A2** | - | - |
| 2026-08-13 | vincentpearson@sky.com | Spanish / es | **A2** | A1, 100% | A1 > C1 |
| 2026-08-18 | dovedivine2015@gmail.com | Spanish / es | **A2** | A1, 100% | A1 |
| 2026-08-21 | oskar@luckner-net.de | Spanish / es | **A2** | - | - |
| 2026-08-21 | oskar@luckner-net.de | Spanish / es | no la termino | - | - |
| 2026-08-23 | ty@tystober.com | Spanish / latam | **B2** | C1, 60% | C1 > A0 |
| 2026-08-28 | noe170285@hotmail.com | Spanish / latam | **B2** | C1, 80% | C1 > B1 > B2 |
| 2026-09-05 | d.jouannet79@free.fr | Spanish / es | **C1** | - | - |
| 2026-09-05 | gaylingates@gmail.com | German / ? | **A2** | C1, 40% | C1 |
| 2026-09-06 | susan.clark.palmer@gmail.com | Italian / ? | **B1** | A1, 80% | A1 |
| 2026-09-06 | drylotus@gmail.com | Spanish / latam | **C1** | - | - |
| 2026-09-07 | frgregoryj@gmail.com | Spanish / es | **A2** | - | - |
| 2026-09-15 | griffta.tg@gmail.com | Spanish / latam | **B2** | B2, 90% | B2 |
| 2026-09-16 | sin correo (xcPUip) (casa) | Spanish / es | no la termino | - | - |
| 2026-09-17 | learnspanishlikeidid@gmail.com | Spanish / latam | **A2** | - | - |
| 2026-09-18 | awright14615@gmail.com | Spanish / latam | **B2** | B2, 30% | B2 > A0 |

Los C1 de ty, noe y gaylingates no son fallos de la prueba: fueron al
peldaño mas cercano porque su nivel no existia (B2 latam publicado el
2026-09-06; gaylingates en aleman, donde faltan niveles).

## 5. Pendiente y dudas abiertas

| que | detalle |
| --- | --- |
| Build movil | La app no tiene OTA (memoria `project_mobile_has_no_ota`): el cambio solo llega a los testers con la proxima build de iOS y Android. Regla del proyecto: una build al dia, y las dos plataformas juntas. `app.config.js` manda (`buildNumber` 318, `versionCode` 27); `app.json` sigue en 315 / 25 y es config muerta que ya engaño una vez (el chat anterior propuso limpiarla y no llego a hacerlo). |
| Medir con el evento nuevo | `onboarding_level_test_completed` ya lleva `correct`, `total` y `demonstratedLevel`. Cuando haya datos de la build nueva, cruzar `demonstratedLevel` y `cefrLevel` con la primera `practice_session_completed`, como hizo el chat anterior (45 altas de fuera, practica de 5 items o mas). |
| Registrar la prueba desde la biblioteca | El runner de `MobileLibraryShell.tsx` no emite evento; esas pruebas siguen invisibles. |
| Pruebas de FR y PT | No existen; hoy esos idiomas caen en el placeholder generico o esconden la entrada. Solo si el usuario las quiere. |
| Escucha y vocabulario | El diagnostico dice que la prueba no mide lo que hace dificiles las historias. No se ha decidido si añadir escucha o cambiar preguntas. |
| La opcion "Some" sin test | Coloca en B1. Un caso (rachaelvorster) le quedo grande. No se ha decidido si bajar esa puerta. |
| Rama sin subir | `7ca4244a` esta en `claude/nice-goldstine-b1442a`, un commit por delante de `origin/main` (`42141eaa`). Push solo con el verbo del usuario; `apps/mobile/**` no dispara build de Vercel. |
| Herencia del mismo chat, fuera de esta tarea | Pestaña Engagement de `/studio/metrics`: la app movil nunca envia `audio_play` (solo `audio_complete`), y "Avg min / user", "Total escuchado", "Top por minutos" y "Saves" salen a cero porque la API solo los carga para Resumen. `BetaRelease` estaba vacia el 2026-09-09, asi que no salian build notes. Los testers de iOS llevaban semanas en el build 279. |

## 6. Cierre

El chat anterior queda cerrado. El trabajo sigue en
`BETA_Test_de_nivel_1-Puntuacion`, dirigido por `Journey-planning-2`.
