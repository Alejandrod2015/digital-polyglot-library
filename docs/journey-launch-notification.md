# Aviso de journey nuevo: decisión

Fecha: 2026-08-24. Caso que la origina: el Traveler PT-BR A1
(`cmsyrge55000732u9oiu8wue3`) se publicó ese día y no se enteró nadie.

## 0. El hecho que decide

El 24 de agosto, con el A1 ya vivo, el número de personas a las que el sistema
avisó fue **cero**. La única pieza que podía hacerlo, el puente
(`src/lib/journeyBridgePush.ts`), exige haber terminado las 21 historias del
journey anterior. El lector más avanzado del A0 portugués va 15/21 y el
siguiente 10/21, así que `journey_bridge_push_sent` tiene 0 filas desde que
existe. El puente no está roto: está diseñado para la graduación, y un
lanzamiento no es una graduación.

## 1. Lo que ya existe, y a quién alcanza

| Pieza | Qué hace | A quién alcanza hoy |
|---|---|---|
| `journeyBridgePush.ts` + cron 17:00 | Avisa a quien TERMINÓ el journey anterior y no ha abierto el siguiente | 0 personas (nadie ha terminado 21/21) |
| `nextStoryPush.ts` + cron 19:00 | La siguiente historia dentro del mismo journey | No cruza journeys |
| `resumeStoryPush.ts` + cron 18:00 | Historia a medias | 1 envío real, el 2026-08-23 |
| `resolvePushRecipients` | `all` o `type_subscribers`, recorriendo Clerk | Sin noción de idioma |
| `publishRelease` | Correo + push a todos los testers | Es para builds, no para contenido |
| `lifecycleEngine.ts` + cron 09:00 | Un correo por usuario y día, con libro de envíos | Vivo: 8 correos en 48 h |
| `BETA_EMAIL_BUILDERS` (10 plantillas) | Builds, encuestas, reseñas | Ninguna anuncia contenido |
| `SMART_NOTIFICATIONS` | Plan canónico de 17 disparadores | `new_variant_content` (prioridad 11) ya está escrito como "señal lista" |

La decisión de este documento es, en la práctica, **cerrar y construir el
disparador 11 del plan**, no inventar un sistema nuevo.

## 2. Los datos sobre los que se decide

Base de producción, consultada el 2026-08-24.

**Universo.** 45 solicitudes de beta, de las que 20 tienen cuenta creada.
25 usuarios distintos han tocado alguna historia de journey; 20 lo hicieron en
los últimos 30 días.

**Lectores distintos por idioma (histórico):** spanish 22, german 5, italian 4,
portuguese 4, french 1.

**Declarado contra leído.** De los 20 solicitantes con cuenta, 8 no han abierto
nunca una historia. Ninguno lee un idioma distinto del que declaró. Pero de los
4 lectores de portugués, **2 no están en `BetaSignup`**: la declaración no ve a
la mitad del público real de ese idioma.

**Cadencia.** 4 journeys pasaron a live en los últimos 7 días. Hay **15
borradores** en cola (spanish 6, german 3, italian 2, y uno de french, polish,
korean y arabic). La pregunta de la fatiga no es hipotética.

**Permisos.** Solo 4 usuarios han agendado alguna vez un recordatorio local,
que es el único indicio de permiso de notificaciones que guarda la base. Los 3
lectores recientes de portugués tienen la app (eventos con `platform: ios`).
Android no tiene emisor FCM: sus tokens se guardan y no se usan.

## 3. Decisiones

### 3.1 Segmentación: por conducta, con la declaración como refuerzo

El segmento es **quien tocó una historia de ese idioma en los últimos 60 días**
(`UserMetric` + `JourneyStory.slug` + `Journey.language`). La declaración
(`BetaSignup.targetLanguage`) entra solo como refuerzo, y solo para quien tiene
cuenta y app: sirve para el primer journey de un idioma, cuando todavía no hay
conducta que mirar.

El nivel no filtra. Quien va por el A0 recibe el aviso del A1 igual: es un
teaser, no un desbloqueo. La excepción es quien terminó el journey anterior:
ese lo coge el puente, que le habla de su graduación, y el lanzamiento lo
descarta con motivo `bridge_owns_it` para no mandar dos avisos del mismo
contenido.

Quien nunca abrió una historia no recibe "hay un A1 nuevo". Un aviso de
contenido a quien no ha leído la primera historia es un aviso de activación
disfrazado, y ese ya lo manda el motor de ciclo de vida. Quien no tiene cuenta
no recibe nada: lo suyo es instalar la app, que es otro correo que ya existe
(`install_nudge`, 17 enviados).

### 3.2 Canal: push, y nada más por ahora

**Push.** Tipo `new_content`, que ya existe, está en `remote` y viene activado
por defecto. Destino: la portada del journey nuevo. Se despliega desde el
servidor, sin build, y reutiliza APNs, que ya entregó un aviso real el 23 de
agosto.

**Correo: no se construye.** El motor de ciclo de vida lo haría barato, pero el
único público que el push no alcanza y el correo sí es el que nunca leyó nada
en ese idioma, y por 3.1 ese público no debe recibir este aviso. Construir el
builder sería construir el alcance que hemos decidido no usar.

**Dentro de la app: sí, pero después.** Un punto en la tarjeta de idioma del hub
(`MobileJourneyLanguageHub.tsx`) cuando hay journey publicado después de la
última visita del usuario a ese idioma. No depende de permisos, no cansa, y es
el único canal que alcanza a quien tiene el push apagado. Pero es código nativo:
build, revisión y que el tester actualice. Va en el próximo build, no antes, y
no bloquea el push.

**Android queda fuera** hasta que haya emisor FCM. En portugués no cambia nada
(6 de 6 son iOS). En francés lo cambia todo (3 de 3 son Android), así que ese
lanzamiento no se anuncia hasta tener FCM o la tarjeta in-app.

### 3.3 Frecuencia: uno por journey, uno de descubrimiento por semana

- Un aviso por journey y usuario, sellado con una fila `journey_launch_push_sent`
  en `UserMetric` (`storySlug` = id del journey), igual que hace el puente. Sin
  tabla nueva.
- Tope: un push de descubrimiento por usuario cada 7 días, dentro del tope
  general del plan de 3 por semana.
- Si dos journeys del mismo idioma caen en la misma ventana de 7 días, se
  agrupan en un mensaje que nombra el idioma y cuenta niveles.
- Si caen dos de idiomas distintos, gana el idioma que esa persona más leyó en
  30 días y el otro se descarta. No se encola: un aviso de lanzamiento con
  cuatro días de retraso no es un aviso, es ruido.
- El texto teasea y no reprocha, y nombra idioma y nivel, como ya hace
  `bridgeCopy`.

### 3.4 Qué se construye para que sea repetible

1. **`Journey.publishedAt`** (migración, la única). Hoy no hay fecha de
   publicación: `updatedAt` se mueve con cualquier edición, y de hecho el A0
   portugués marca 2026-08-19 sin haberse publicado ese día. Sin esta columna el
   disparador no sabe qué es nuevo.
2. **`src/lib/journeyLaunchPush.ts`**, calcado del esqueleto del puente:
   selector, descartes con motivo, sello de una vez, informe en seco. Cron
   diario, apagado por defecto tras `JOURNEY_LAUNCH_PUSH_ENABLED`, como los
   otros tres.
3. **`resolvePushRecipients` NO se toca.** Ese resolvedor existe para las
   campañas manuales de Studio y recorre Clerk entero; el segmento por idioma
   vive en la base, no en Clerk. Meterle un `target: "language"` obligaría a
   cruzar Prisma dentro de un paginador de 5000 usuarios de Clerk. El disparador
   va al revés: resuelve el segmento en la base y le pide a Clerk solo esos
   userId, que es lo que ya hace el puente.
4. **La tarjeta in-app**, en el siguiente build nativo (3.2).

## 4. La prueba: los 6 de portugués, más los que no están en la lista

| Persona | Declaró PT | Cuenta | Lee PT (60 d) | Solo declaración | **Conducta (decidido)** | Correo a los 6 |
|---|---|---|---|---|---|---|
| Steffen | sí | sí | 10/21 del A0, iOS | recibe | **recibe** | recibe |
| Mike | sí | sí | 1/21 del A0, iOS | recibe | **recibe** | recibe |
| Bob | sí | sí | nada | recibe | no | recibe |
| Jean-Pierre | sí | sí | nada | recibe | no | recibe |
| Lindsay | sí | no | nada | no | no | recibe |
| Harvey | sí | no | nada | no | no | recibe |
| `7y52txtK` | no está en BetaSignup | sí | 15/21 del A0, iOS | **no lo ve** | **recibe** | no lo ve |
| Puente actual | - | - | - | - | - | 0 personas |

Alcance del aviso del PT A1: por declaración 2 de los 3 lectores reales; por
conducta los 3, incluido el más avanzado, que la declaración no ve; por correo
a los 6, de los cuales 4 nunca abrieron una historia en portugués.

## 5. Recomendación

Construir `journeyLaunchPush` segmentado por conducta, solo push, con
`Journey.publishedAt` como base y el interruptor apagado por defecto. Primero el
informe en seco sobre el caso del PT A1: si da los 3 esperados y ningún nombre
extraño, se enciende y ese es el primer aviso que sale. La tarjeta in-app entra
en el siguiente build nativo. No se construye builder de correo.

verified:
- 0 filas de `journey_bridge_push_sent`; mejor progreso en el A0 portugués 15/21.
- 4 lectores de portugués, 2 de ellos fuera de `BetaSignup`; 6 solicitudes de
  portugués, 4 con cuenta, 2 con lectura real.
- 11 journeys live, 15 draft, 4 publicados en 7 días.
- APNs entregó un push real el 2026-08-23 (`resume_story_push_sent`).
- `new_content` existe, es `remote` y viene activado por defecto.

not verified:
- Cuántos de esos 3 lectores tienen token APNs vivo y `new_content` activado: la
  clave de Clerk local es `sk_test` y los metadatos de producción no se leen
  desde aquí.
- Si `JOURNEY_BRIDGE_PUSH_ENABLED` y `NEXT_STORY_PUSH_ENABLED` están puestos en
  Vercel: no se pudo listar el entorno de producción.
- Efectividad: `push_opened` tiene 0 filas, así que no hay tasa de apertura de
  push medida en este proyecto.
- Nadie ha leído el texto del aviso en un teléfono real.
