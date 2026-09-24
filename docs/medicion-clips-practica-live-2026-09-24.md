# Cinco journeys LIVE sin audio de practica: medicion (2026-09-24)

Encargo del chat de planificacion: MEDIR, no arreglar. No se genero ni un clip,
no se toco contenido, ni sets, ni la base. Todo lo de abajo sale de consultas de
lectura, de peticiones HEAD contra R2 (gratis) y del historial de git.

Scripts de la medicion (scratch, `scripts/_*`): `_medirClipsPractica.ts` (hueco
por journey y por historia), `_medirClips2.ts` (forma del payload),
`_medirClips3.ts` (sonda R2 de clips de palabra), `_medirClips4.ts` (caracteres),
`_medirClips5.ts` (fechas de las filas), `_medirClips6.ts` (sonda R2 contra TODAS
las voces aprobadas). Los clips de frase se sondearon con `_restoreClipUrls.ts`
sin `--apply`.

## 1. Que falta exactamente

| Journey | Clips | Falta | Tipo | Historias | Reparto | Pool / featured | En R2 (gratis) | Hay que generar |
|---|---|---|---|---|---|---|---|---|
| `spanish/spain traveler a1` | 96/409 | 313 | palabra (`wordClipUrl`) | 21/21 | uniforme, 0 de 13-17 por historia | 196 / 117 | 95 | 218 |
| `spanish/latam traveler a2` | 84/336 | 252 | palabra (`wordClipUrl`) | 21/21 | uniforme, 0 de 12 por historia | 147 / 105 | 8 | 244 |
| `spanish/latam relationships c1` | 320/352 | 32 | frase (`clipUrl`) | 12/21 | concentrado, 1 a 4 por historia | 31 / 1 | 4 | 28 |
| `french/france relationships a1` | 334/340 | 6 | frase (`clipUrl`) | 2/21 | concentrado (`le-papier-bleu`, `la-ligne-corrigee`) | 6 / 0 | 0 | 6 |
| `spanish/mexico traveler a1` | 559/560 | 1 | palabra (`wordClipUrl`) | 1/21 | puntual (`la-casa-azul-de-coyoacan`, "callado") | 1 / 0 | 0 | 1 |
| **TOTAL** | | **604** | | | | 381 / 223 | **107** | **497** |

Ids: spain a1 `cmsvz6mz9000732gsgsfer0ko`, latam a2 `cmtgelq560007j84n3ujx9bpd`,
latam c1 `cmrdqk484000032r4rt2vw4ej`, france a1 `cmtwz1iop000l32jybeo2jg4x`,
mexico a1 `cmrrqjd2n000032nvnp2tryzg`.

## 2. Deuda real y ruido

El denominador NO es ruido, pero tampoco es todo igual de urgente:

- **Nada de lo que falta es "frase del pool del meaning"**. El gate no exige la
  frase de un `meaning_in_context`, y esos ejercicios no entran en la cuenta.
  Los dos huecos grandes son 100% `wordClipUrl` de `meaning_in_context`; los dos
  pequenos son 100% `clipUrl` de `fill_blank`.
- **381 de los 604 son del POOL** (`featured = false`): solo se ven en la
  pestana de Practica, nunca en la sesion de despues de la historia. Los
  **223 featured** son los que toca un usuario que acaba una historia, y ahi el
  hueco sigue siendo grande: 117 en spain a1 y 105 en latam a2.
- **107 clips YA existen en R2** y solo les falta el puntero en el payload
  (verificado con HEAD contra la clave deterministica). Recuperarlos no cuesta
  ni un credito.

## 3. Por que paso

**Hipotesis (a), "son anteriores al gate": FALSA.** El gate de audio de practica
existe desde `df263d9b` (2026-07-27). Spain a1 se creo el 2026-08-16 y quedo
`active` el 08-24; latam a2 se creo el 08-30. Los dos son posteriores.

Lo que si es cierto, y es la causa de fondo: **hay un camino a `active` sin
gate**. `scripts/setJourneyStatus.ts --status active` escribe el estado con un
unico guard (que el selector de la app encuentre la variante) y NO mira el audio
de practica; el gate solo vive en la ruta del Studio y en `publishJourney.ts`.
La prueba de que el gate nunca corrio en estos dos: 97 de los 117 clips featured
de spain a1 y 99 de los 105 de latam a2 **no existen en R2 bajo ninguna version
de la receta (w5..w1) ni bajo ninguna voz aprobada**. Un objeto de R2 no se
borra; si el journey hubiera pasado el gate al publicarse, estarian ahi.

**Hipotesis (b), "el resembrado borra `wordClipUrl`": CONFIRMADA, pero explica
solo una parte.** Datos:

- Todas las filas que hoy fallan fueron **creadas el 2026-09-18 entre las 11:30
  y las 11:58 UTC**, dentro de la ventana del resembrado masivo documentado en
  `1c2b1c09` (`_seedAllSets.ts --apply` sin `--only`, 3.280 ejercicios de 28
  journeys reescritos entre las 11:50 y las 12:10 UTC). El borrado y reinsercion
  explica que filas de journeys publicados en agosto tengan seis dias de vida.
- El JSON de `scripts/_sets/` **nunca** ha llevado `wordClipUrl`: se comprobo en
  `la-barra-manda.json` en su version del 2026-08-19 y en la de hoy, y en
  `sofia-prueba-el-mole.json`. El puntero solo vive en la base, asi que cualquier
  resembrado anterior al fix lo perdia.
- El fix llego el mismo dia (`55e30ce6`, 13:11, carry-forward de `wordClipUrl`;
  `1c2b1c09`, 18:28, candado `--only/--journey` y carry-forward de `clipUrl`),
  es decir DESPUES del resembrado de las 11:50. La restauracion posterior cubrio
  `clipUrl` de cuatro journeys (DE A1, FR A0, FR A1, ES latam B2) y **nunca
  restauro `wordClipUrl` de estos dos**.
- Alcance real de (b) aqui: los **107** clips huerfanos que siguen en R2
  (95 + 8 + 4). Los otros 497 nunca se generaron.

Los 6 de `french/france a1` ya estaban diagnosticados en `1c2b1c09`: no resuelven
en ninguna de las dos formulas, perdida real anterior al incidente. Los 28 de
latam c1 son `fill_blank` del pool que nunca se generaron.

## 4. Cuanto cuesta cerrarlo

| Concepto | Clips | Caracteres (1 toma) |
|---|---|---|
| Palabras por generar (spain a1 218, latam a2 244, mexico 1) | 463 | ~3.745 |
| Frases por generar (latam c1 28, france a1 6) | 34 | ~1.798 |
| **Total a sintetizar** | **497** | **~5.543** |
| Recuperables desde R2, sin sintetizar | 107 | 0 |

Cuota ElevenLabs hoy: **385.564 / 600.000 usados**, quedan **214.436** hasta el
reset del 2026-10-07. Los generadores re-tiran contra el gate F0 (hasta 6 tomas),
asi que el gasto realista es de 1,5x a 2x: **entre 8.000 y 11.000 caracteres**,
o sea **4% a 5% de lo que queda** y alrededor del 1,5% del plan mensual.

Matiz que cambia la decision: **no generar no ahorra el dinero, lo aplaza**. La
ruta `/api/practice/word-tts` sintetiza con ElevenLabs en el momento en que un
usuario toca la palabra y la cachea en R2 por (voz, palabra); cada par unico se
paga una vez de todas formas, solo que en produccion y sin gate.

## 5. Que ve hoy un usuario del mas roto (`spanish/spain traveler a1`)

**No se rompe ni se salta: suena, y suena peor.** El ejercicio se muestra igual;
al tocar el altavoz el movil busca `audioClip.wordClipUrl`, no lo encuentra y cae
a `/api/practice/word-tts`, que primero sondea las claves prehorneadas w5/w4 (por
eso los 95 clips huerfanos de spain a1 SI se oyen bien, aunque el payload no los
tenga) y, si no hay objeto, sintetiza al vuelo. Consecuencias:

1. **Espera en el primer toque** de cada palabra nueva (la ruta admite hasta 120 s;
   el resto de plays salen de la cache).
2. **Sin gate F0**: la ruta de runtime no mide el tono final, asi que la palabra
   puede salir con entonacion de pregunta, que es justo lo que el gate existe
   para evitar.
3. **Sin los 90 ms de lead-in** de la receta w4/w5: en la primera reproduccion con
   la sesion de audio de iOS en frio el onset se recorta.
4. Los `fill_blank` sin `clipUrl` (latam c1, france a1) caen a
   `/api/practice/sentence-tts` (Modal Piper/Kokoro, voz generica del idioma): no
   gasta creditos, pero no es la voz del narrador.

Urgencia: media, no incendio. Nadie se queda mudo y nada revienta; lo que hay es
peor calidad, mas espera y un gasto que se paga igual, a plazos.

verified:
- Hueco por journey, por historia y por tipo de ejercicio, con la regla literal
  del gate (`publishJourney.ts`), contra la base de produccion.
- Reparto pool / featured de cada hueco.
- Existencia en R2 de cada clip que falta: palabras con las cinco versiones de la
  clave (w5..w1) y, en una muestra de nueve palabras featured, contra TODAS las
  voces aprobadas; frases con las dos formulas de `_restoreClipUrls.ts` (`fb1` y
  v4/v3/v2 con rev), en modo informe.
- Fechas de creacion y actualizacion de las filas que fallan, cruzadas con la
  ventana del resembrado documentada en `1c2b1c09`.
- Que el JSON de los sets nunca llevo `wordClipUrl` (dos slugs, dos versiones).
- Fecha del gate de audio de practica (`df263d9b`, 2026-07-27) y ausencia de ese
  gate en `setJourneyStatus.ts`.
- Cuota de ElevenLabs (`scripts/_quota.ts`, GET) y caracteres a sintetizar.
- Ruta de fallback de runtime leida en `MobileLibraryShell.tsx` y en
  `src/app/api/practice/word-tts/route.ts`.

not verified:
- No se escucho ni un clip: la calidad real de lo que hoy sintetiza la ruta de
  runtime (uptalk, onset recortado) esta inferida del codigo, no medida por oido.
- No se probo la app en un dispositivo: la espera del primer toque y el corte de
  onset en iOS no estan cronometrados.
- El numero de re-tiradas del gate F0 es una estimacion (1,5x a 2x), no una
  medida de este lote.
- La sonda contra todas las voces aprobadas se corrio sobre nueve palabras
  featured de seis historias, no sobre las 604.
- No se reviso si otros journeys `active` fuera de estos cinco tienen huecos de
  otro tipo (glosas, narracion, portadas).
- No se miro el lector web, solo el cliente movil.

base: la sonda HEAD contra R2 (`_medirClips3.ts` y `_restoreClipUrls.ts` en modo
informe) dice que 107 de los 604 clips ya estan pagados y solo les falta el
puntero en el payload.

**Recomendacion: empezar por recuperar esos 107 punteros sin sintetizar nada**
(95 palabras de spain a1, 8 de latam a2, 4 frases de latam c1), con un
restaurador de `wordClipUrl` analogo a `_restoreClipUrls.ts`. Cuesta cero
creditos, baja el hueco de 604 a 497 y deja la decision de gastar reducida a un
solo numero limpio.
