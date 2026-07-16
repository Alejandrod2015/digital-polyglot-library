# Google Play launch runbook — Digital Polyglot (Android)

Estado a 2026-07-16. La app iOS ya existe; esto lleva la misma app a Play.
Todo el código y los assets están hechos; lo que queda son pasos en dashboards
(tuyos) y un bloqueante nuevo (borrado de cuenta) descrito abajo.

Cuenta Play: **Digital Polyglot** (org, ID `7331323233578964538`), propietaria
`admin@digitalpolyglot.com` (Chrome Profile 2). App `com.digitalpolyglot.app`,
app ID `4973262390913816082`, hoy en Borrador / prueba interna.

---

## 0. Borrado de cuenta (política de Play) — HECHO

Play exige un modo de borrar la cuenta y sus datos accesible sin reinstalar, y
una URL pública para el Data Safety. Ya construido:

- URL a declarar en Data Safety → Data deletion:
  **`https://digitalpolyglot.com/data-deletion`** (ya la enlaza la app desde el
  menú Legal → "Data deletion", vía `openWebPath`).
- Esa página ahora tiene borrado self-service para el usuario logueado
  (`DeleteAccountPanel`), con confirmación, que llama `POST /api/user/delete`;
  el email a support@ queda como fallback.
- `src/lib/deleteUserData.ts` es la fuente única del borrado (las 10 tablas
  por-usuario + revocación de sesión móvil). El webhook `user.deleted` de Clerk
  ahora la usa: antes solo borraba 4 de 10 tablas, dejando huérfanos
  favoritos-colección, métricas, prefs de email, continue-listening y billing.

Verificado: typecheck limpio; `/data-deletion` renderiza 200 con el panel y sin
errores de consola (estado signed-out, en local sin login).
No verificado: el borrado real end-to-end con una cuenta de prueba (es
destructivo, no se ejecutó); la variante alemana `/data-deletion/de` sigue
solo-email.

---

## 1. Service account (desbloquea verificación de compras Y `eas submit`)

Un solo service account sirve para las dos cosas.

1. **Google Cloud Console** (logueado como `admin@digitalpolyglot.com`):
   habilita la API "Google Play Android Developer" → crea un service account →
   genera una clave **JSON** y descárgala.
2. **Play Console** → Users and permissions → invita el email del service
   account. Permisos: ver la app, gestionar pedidos y suscripciones (para la
   verificación) y gestionar releases (para el submit).
3. El JSON va a **dos** sitios:
   - `apps/mobile/.secrets/google-play-service-account.json` (lo usa
     `eas submit`; `.secrets/` ya está en `.gitignore`).
   - En Vercel (prod), de ese mismo JSON: `client_email` →
     `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`, y `private_key` →
     `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY` (pégalo con los `\n` literales;
     el código ya los reconvierte).

Ya están puestas: `GOOGLE_PLAY_PACKAGE_NAME=com.digitalpolyglot.app` y
`GOOGLE_PLAY_SHA256_CERT_FINGERPRINTS`.

### Notificaciones en tiempo real (RTDN) — opcional pero recomendado

Para que las renovaciones/cancelaciones se reflejen en el server sin que el
usuario abra la app, Play publica RTDN a un topic de Pub/Sub que hace push a
`/api/billing/google-play/rtdn`. Ese endpoint ahora valida el token OIDC que
Google firma en el push (antes aceptaba cualquier POST). Es **fail-closed**:
sin config, rechaza todo. Para activarlo:

1. Play Console → Monetize → Monetization setup → pega el nombre del topic de
   Pub/Sub.
2. En la push subscription de Pub/Sub, activa autenticación OIDC con el service
   account del punto 1.
3. En Vercel (prod): `GOOGLE_PLAY_PUBSUB_AUDIENCE` = el audience que definiste
   en la subscription (p. ej. la URL del endpoint), y opcional
   `GOOGLE_PLAY_PUBSUB_SA_EMAIL` = el email del service account, para fijar el
   emisor.

Limitación conocida: un `Authorization: Bearer` sintácticamente inválido
devuelve 500 en vez de 401, porque el middleware de Clerk pre-parsea el header
antes del handler. Es cosmético (no falsifica ninguna notificación; Pub/Sub
real siempre manda un OIDC bien formado, que el handler rechaza con 401 si no
verifica). No se corrige para no tocar el matcher del middleware, que protege
la auth de todo el sitio.

---

## 2. Productos de suscripción (o el paywall Android no carga nada)

Play Console → Monetize → Subscriptions. Crea dos, con estos IDs EXACTOS (los
espera el código, `billing.ts` los mapea a plan `premium`):

- `premium_monthly` — base plan mensual, €14,99.
- `premium_annual` — base plan anual, €149.

Sin base plan activo el `offerToken` viene vacío y el botón de compra no
arranca.

---

## 3. Ficha (store listing)

Play separa el copy distinto que iOS. Este es un BORRADOR desde el
posicionamiento (lenguaje auténtico, público anglosajón, sin framing de
"reader/reading", sin claims de "native" porque el audio es IA). Cotéjalo con
tu copy ya aprobado en App Store Connect antes de pegar.

- **App name** (máx 30): `Digital Polyglot`
- **Short description** (máx 80):
  `Learn real Spanish through short stories, audio and practice in context.`
- **Full description** (máx 4000):

```
Digital Polyglot teaches you Spanish the way people actually speak it.

Every lesson is a short, self-contained story set in a real place, with a
character and a small twist. You follow the story with audio, tap any word to
see what it means, and save the ones you want to keep.

Right after each story you lock in the new words with a quick round of
practice, in the same context you just met them. You remember far more this
way than from isolated flashcards.

- Short stories in authentic Spanish, by theme
- Audio for every story, at your own pace
- Tap any word for an instant, in-context definition
- Save words and practice them right after the story
- A guided journey that grows with you, theme by theme

Start at your level and build a real feel for the language, one story at a
time.
```

---

## 4. Data Safety (respuestas exactas)

Derivado de la App Privacy ya declarada en Apple y de las deps reales (sin
Sentry, sin SDK de analytics, sin ads/attribution). Clerk y las tiendas de pago
son procesadores que actúan en tu nombre → NO cuentan como "compartir".

Does your app collect or share user data: **Yes**.
Is all data encrypted in transit: **Yes**.
Do you provide a way to request data deletion: **Yes** (la URL del punto 0).
Data shared with third parties: **None**.

Data collected (todos: Collected = Yes, Shared = No, Linked to user = Yes,
Processed ephemerally = No, Optional = No):

| Tipo de dato | Categoría Play | Propósitos |
| --- | --- | --- |
| Name | Personal info | App functionality |
| Email address | Personal info | App functionality, Account management |
| User IDs | Personal info | App functionality, Analytics |
| Purchase history | Financial info | App functionality, Analytics |
| App interactions | App activity | App functionality, Analytics, Personalization |
| Device or other IDs | Device or other IDs | App functionality |

No: location, contacts, messages, photos, audio del usuario, health, calendar,
files. No "Financial info → payment info" (el pago lo maneja Google Play, no la
app).

---

## 5. Content rating (cuestionario IARC)

- Category: **Reference, News, or Educational**.
- Violence: No. Sexuality: No. Controlled substances: No. Gambling: No.
- Profanity / crude humor: **No** para el contenido inicial A1–B1.
  ATENCIÓN: si más adelante publicas historias C1 con lenguaje adulto/vulgar,
  vuelve al cuestionario y marca lenguaje "mild/infrequent"; el rating de Play
  se puede actualizar y no hacerlo es un riesgo de strike.
- User-generated content / interacción entre usuarios: No.
- Resultado esperado: Everyone / PEGI 3.

---

## 6. Assets (subir a mano en la ficha)

Generados en `apps/mobile/play-store-assets/` con
`apps/mobile/scripts/build-play-assets.py` (regenerables; los titulares son
editables en el dict del script):

- `feature-graphic.png` — 1024x500 (obligatorio, no existía).
- `play-screenshot-01..05.png` — 1600x2938 (ratio 1.836, dentro del 2:1 de
  Play; las capturas iOS crudas a 2.17 lo violaban). Orden narrativo con
  titulares: real stories → tap any word → practice that sticks → remember 2× →
  a journey by theme.
- App icon 512x512: se puede exportar de `apps/mobile/assets/icon.png`
  (1024x1024, sin alpha) reescalado.

URLs: privacidad `https://digitalpolyglot.com/privacy`, soporte
`https://digitalpolyglot.com/contact`.

---

## 7. Build y submit (NO lanzar sin tu OK; máx 1 build/día)

Pre-flight del `versionCode` SIEMPRE con
`npx expo config --type public --json` (nunca leyendo el archivo). Hoy resuelve
`version 1.0`, `android.package com.digitalpolyglot.app`, `versionCode 2` (la
TWA gastó el 1). Con el service account en su sitio:

```
eas build --platform android --profile production
eas submit --platform android --profile production   # track internal, draft
```
