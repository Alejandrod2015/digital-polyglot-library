# Plan de despliegue por etapas

Escrito el 2026-09-06. Como publicar nuevas versiones de la web y de las
apps a medida que crece la base de usuarios. Las etapas empiezan el dia que
se abre el registro publico; la beta no cuenta como etapa.

El umbral que decide cada etapa son los **usuarios activos al dia (DAU)**,
no los registrados: es lo que da o no da señal estadistica a un canary. El
segundo eje es el dinero: con suscripciones vivas, una caida cuesta
reembolsos.

Los cortes de 300 y 3.000 DAU son criterio propio, sin dato que los
respalde. El resto sale del estado verificado del repo (2026-09-06) y de la
documentacion de Vercel y de Expo.

## Estado de partida (verificado el 2026-09-06)

- `main` va directo a produccion al 100%. `scripts/vercel-ignore-build.sh`
  salta el build en cualquier rama que no sea `main` (linea 9, a fuego).
- No hay `.github/workflows`: los unicos gates son los hooks locales
  (`pre-push` con typecheck y los 12 lints), que se pueden saltar.
- La app movil no tiene `@sentry/react-native`, ni `expo-updates`, ni
  analitica (`apps/mobile/package.json`). `app.json` no declara `updates`
  ni `runtimeVersion`.
- `eas.json` sube a Play con `releaseStatus: "completed"`: el 100% de golpe.
- La base es Neon (`DATABASE_URL` en `neon.tech`): las ramas de BD existen.
- No hay ningun guard de `VERCEL_ENV` en `src/`. Los 12 crons de
  `vercel.json` (correos de lifecycle, beta, pushes) correrian en cualquier
  proyecto de Vercel que reciba ese archivo.
- La app movil lee la URL de la API por env (`DEFAULT_PRODUCTION_APP_URL`
  en `apps/mobile/src/config.ts` y `app.config.js`).

## Linea de base (antes de abrir el registro; no es una etapa)

1. Sentry en la app movil con release health. Sin esto nada de lo que
   sigue se puede juzgar.
2. `expo-updates` con `runtimeVersion: { policy: "fingerprint" }`, para que
   un cambio nativo nunca reciba un bundle incompatible. La revision de
   tienda son 24-48 horas desde el usuario uno; sin OTA cada fix de JS las
   espera.
3. El gate 6g (`.claude/safety/pre-comms-claim-guard.sh`) tiene que mirar
   tambien el canal OTA, no solo la build de tienda: con OTA, lo que corre
   el usuario ya no es lo que hay en la tienda.

## Etapa 1: lanzamiento (hasta ~300 DAU, primeros suscriptores)

Objetivo: deshacer rapido y no romper a quien paga.

| Dimension | Que se hace |
|---|---|
| Cadencia | Tren semanal fijo. Los hotfix van por su carril y no esperan al tren |
| Web | `main` a produccion. Instant Rollback como plan A, nunca un revert (gasta build). Rama `staging` con proyecto de Vercel propio |
| Staging: BD | Rama de Neon sembrada con el catalogo real, con los correos ANONIMIZADOS antes de usarla |
| Staging: sin salida al mundo | Sin claves de Resend ni FCM, y los crons fuera de su `vercel.json`. Si no, staging manda correos y pushes reales a gente real |
| Staging: build | Parametrizar la rama en `vercel-ignore-build.sh` igual que ya esta `IGNORE_BUILD_VERSION_URL`; con `main` a fuego, staging no construiria nunca |
| CI | GitHub Actions en cada PR: typecheck, los 12 lints, tests. Los hooks locales se saltan; CI no |
| Movil | OTA por canales: `preview` 24 horas en TestFlight interno, luego `production`. Play staged 20% a 100% en 24 horas; Phased Release de iOS activado. El perfil `preview` de EAS apunta a staging por env |
| Base de datos | Expand/contract obligatorio: nunca borrar una columna en la misma release en que deja de usarse. Hay gente con la app vieja instalada durante semanas |
| Restauracion | Confirmar la ventana de PITR del plan de Neon y ensayar una restauracion una vez. El plan de recuperacion actual cubre codigo y envs, no datos |
| Umbral de aborto | En ABSOLUTOS, escrito: 3 usuarios distintos con crash en la misma release en una hora detienen el rollout. Un porcentaje no sirve con 300 DAU (99,5% son 1,5 personas) |
| Coste | Vercel Pro (~20 EUR/mes) + rama de Neon |

## Etapa 2: crecimiento (~300 a 3.000 DAU)

Disparador: el 5% del trafico ya son 50 o mas personas al dia, o entra
alguien mas al repo.

| Dimension | Que se hace |
|---|---|
| Web | Rolling Releases 5% > 25% > 100% comparando canario contra estable. Skew Protection activado: con Next.js, un cliente con el bundle viejo llamando al servidor nuevo rompe en silencio |
| Movil | `eas update --rollout-percentage` 5 > 25 > 100 con 30 minutos de vigilancia entre saltos. Anillo beta publico: TestFlight externo y open testing de Play |
| Feature flags | Deploy y release dejan de ser lo mismo: publicar codigo apagado deja de dar miedo |
| Pruebas | e2e en los dos caminos que dan dinero: alta con Clerk y el paywall HASTA la hoja de compra (Play Billing no se automatiza de punta a punta; en iOS, StoreKit Testing local). Playwright en web, Maestro en movil, en CI |
| Compatibilidad | Ventana N-2 de versiones de app, con pantalla de actualizacion forzada por debajo |
| Umbral de aborto | Ya en porcentaje: crash-free < 99,5% o error rate de API > 1% |
| Coste | Vercel Pro + minutos de CI (los e2e moviles necesitan runner Mac o builds de simulador) |

## Etapa 3: escala (mas de 3.000 DAU)

Disparador: una caida de una hora ya cuesta mas que el tiempo de
arreglarla.

| Dimension | Que se hace |
|---|---|
| Web | Despliegue continuo tras verde, con canary automatico que se revierte solo al cruzar el umbral |
| Base de datos | Migraciones en dos fases con backfill en segundo plano, nunca bloqueantes; replica de lectura |
| API | Versionado explicito y contract tests entre la app y la API, porque los clientes viejos viven meses |
| Operacion | SLO con error budget, alertas que suenan, pagina de estado publica, y postmortem escrito de cada incidente |
| Tiendas | Submit automatizado desde CI: la build deja de depender de un portatil |
| Coste | Guardia y herramientas; a este tamaño se paga solo |

## Como se vigila (para que no dependa de la memoria de nadie)

El plan no se recuerda: se mide.

- `src/lib/releaseStage.ts` es el plan en codigo: etapas, cortes de DAU y
  piezas. Cambiar un corte ahi cambia lo que dice el digest.
- `scripts/checkReleaseReadiness.ts` detecta cada pieza `auto` en el repo
  (una dependencia, una linea de config, un archivo) y escribe
  `src/data/releaseReadiness.json`. Va en el manifiesto del `pre-push` como
  `lint:release-readiness`: si el JSON no coincide con el repo, el push no
  pasa. Se regenera con `--write`.
- Las piezas `manual` (Play Console, Vercel, un ensayo de restauracion) se
  marcan en `scripts/release-readiness-manual.json` con `done`, fecha y una
  prueba de al menos cuatro palabras; sin las tres cosas cuentan como
  pendientes.
- El digest de los lunes (`sendWeeklyDigest`) imprime la etapa actual por DAU
  medido (distintos usuarios por dia UTC, promediados sobre la semana), el
  siguiente disparador y las piezas pendientes, empezando por la linea de base.

Lo que queda del lado del usuario para cerrar la linea de base:

1. Crear el proyecto `digital-polyglot-mobile` (React Native) en Sentry, en la
   organizacion `digital-polyglot`, y pegar su DSN en `.env.local` como
   `EXPO_PUBLIC_SENTRY_DSN`. Sin DSN la app no manda nada.
2. `SENTRY_AUTH_TOKEN` en el entorno de build (EAS secret o shell local) para
   que suban los source maps. Sin el, el build FALLA en la fase de bundle;
   una build local sin token lleva `SENTRY_DISABLE_AUTO_UPLOAD=true` en el
   entorno de `xcodebuild` (los stack traces salen sin simbolos).
3. La siguiente build de tienda lleva expo-updates y Sentry (son nativos). Los
   directorios `ios/` y `android/` no van en git, asi que un build local pasa
   por `npx expo prebuild` para recogerlos; EAS lo hace solo.
4. Primera update: `eas update --channel preview --message "..."`, comprobar
   en TestFlight interno, y luego `--channel production`.

## La trampa

Adoptar la etapa 3 por adelantado "para no rehacerlo": se paga la ceremonia
entera cuando aun no existe la señal que la justifica. Cada etapa se monta
el dia que se cumple su disparador, no antes. Y ni una pieza de la 2 hasta
que la 1 este entera.

## Fuera del plan, visto de paso

Tres crons no comprueban ninguna autorizacion y son invocables por URL:
`catalog-health`, `journey-slot-counts` y `voice-availability` (este ultimo
llama a ElevenLabs con la clave del proyecto). Se arregla aparte, copiando
el patron de `CRON_SECRET` de los otros nueve.

## Fuentes

- Vercel Rolling Releases: https://vercel.com/docs/rolling-releases
- Expo, rollouts de EAS Update: https://docs.expo.dev/eas-update/rollouts/
- Expo, deployment de EAS Update: https://docs.expo.dev/eas-update/deployment/
