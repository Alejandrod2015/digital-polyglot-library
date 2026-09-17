# Correos de Clerk con el estilo de Digital Polyglot

Generado por `npx tsx scripts/_clerkEmails.ts`. Nada de esto esta instalado
todavia: son archivos para revisar y, cuando el usuario lo diga, subir a Clerk.

| archivo | que es |
| --- | --- |
| `<slug>.html` | la plantilla, con las `{{variables}}` de Clerk. Esto es lo que se sube |
| `preview/<slug>.html` | la misma con valores de ejemplo, para mirarla |
| `before/<slug>.html` | lo que Clerk manda HOY (bajado de su API el 2026-09-06) |
| `comparativa.html` | antes y despues, lado a lado |
| `subjects.txt` | los asuntos propuestos |

## Las variables no son inventadas

Salen de `available_variables` de la API de Clerk, no de la documentacion:

```
curl -s -H "Authorization: Bearer $CLERK_SECRET_KEY" https://api.clerk.com/v1/templates/email
```

- `verification_code` y `reset_password_code`: `otp_code` (obligatoria),
  `requested_at`, `requested_by`, `requested_from`, `app.name`, `app.url`,
  `app.domain_name`, `app.logo_image_url`, `user.email_address`,
  `user.public_metadata`.
- `magic_link_sign_in`: lo mismo, con `magic_link` (obligatoria) y `ttl_minutes`.
- `invitation`: `action_url` (obligatoria), `inviter_name`,
  `invitation.expires_in_days`, `invitation.public_metadata`, `app.*`.

De `requested_from` y `requested_by` no usamos ninguna: ver abajo.

## El bloque "Didn't request this?"

Hoy imprime `{{requested_from}}`, que sale como la IPv6 entera del que pidio el
codigo, con su ciudad. Aqui se cambia por la hora sola (`{{requested_at}}`).

Motivo: quien recibe el correo no puede comprobar una IPv6 ni sabe que hacer
con ella, y esa direccion es la de OTRA persona cuando alguien se equivoca de
correo al registrarse. La pregunta que el bloque tiene que responder es "esto
lo he hecho yo?", y a esa la contesta la hora. Handlebars en Clerk no permite
recortar la cadena, asi que no hay opcion intermedia: o entera o fuera.

## Como se instala

Dos caminos. El fiable es la API: el editor del dashboard es Revolvapp, que
trabaja con su propio marcado y transpila a tablas, asi que un HTML pegado ahi
puede salir tocado.

```bash
# uno por uno, sobre la instancia de PRODUCCION (hace falta su sk_live).
# `name` y `body` son obligatorios; `markup` vacio a proposito, ver abajo.
jq -n --arg n "Verification code" \
      --arg s '{{otp_code}} is your Digital Polyglot code' \
      --arg b "$(cat qa/clerk/verification_code.html)" \
      --arg m "" '{name:$n,subject:$s,body:$b,markup:$m}' > /tmp/p.json
curl -X PUT "https://api.clerk.com/v1/templates/email/verification_code" \
  -H "Authorization: Bearer $CLERK_SECRET_KEY_PROD" \
  -H "Content-Type: application/json" --data @/tmp/p.json
```

**`markup` vacio, y no es un detalle.** Si el PUT solo manda `body`, Clerk se
queda con el marcado Revolvapp ANTERIOR: el correo sale con el diseño nuevo,
pero el editor del dashboard sigue enseñando el viejo, y el dia que alguien
abra esa pantalla y le de a guardar, el marcado se transpila encima y se lleva
por delante el HTML. Mandando `markup: ""` el editor queda vacio y no hay nada
que pueda pisar el `body`.

**Curl, no python.** La API de Clerk esta detras de Cloudflare y `urllib`
recibe un 403 (error 1010) por su User-Agent.

- Deshacer: `POST /v1/templates/email/<slug>/revert`. Ojo: hoy la plantilla
  trae `can_revert: false` porque no esta personalizada; hay que comprobar que
  pasa a `true` despues del primer PUT.
- El endpoint `PUT /templates/{type}/{slug}` figura como `deprecated` en el
  OpenAPI de Clerk, pero es el unico que escribe el `body` tal cual.
- `from_email_name` y `reply_to_email_name` viajan en el mismo PUT si algun dia
  se quiere dejar de mandar desde `notifications@`.
- `POST /templates/{type}/{slug}/preview` devuelve el render sin guardar nada.

## Ensayo en la instancia de desarrollo (2026-09-06, sk_test)

Las cuatro estan instaladas en DESARROLLO. Produccion sigue intacta.

| comprobacion | resultado |
| --- | --- |
| `PUT` de las cuatro | HTTP 200 |
| el `body` guardado es identico al del repo | si, byte a byte |
| `markup` | vacio en las cuatro |
| `is_custom` / `can_revert` | `true` / `true` |
| `POST /revert` (probado en `invitation`) | HTTP 200, vuelve al asunto, cuerpo y marcado de Clerk |
| `POST /preview` de las cuatro | HTTP 200, cero `{{variables}}` sin interpolar |

El render que devuelve el propio Clerk esta en `clerk-render/`. Coincide con la
previsualizacion local. En el preview, `magic_link` y `action_url` salen como
`#` (valor de prueba de Clerk) y la hora como una fecha de ejemplo de 2021.

Para deshacer el ensayo, sobre la instancia de desarrollo:

```bash
for s in verification_code reset_password_code magic_link_sign_in invitation; do
  curl -X POST "https://api.clerk.com/v1/templates/email/$s/revert" \
    -H "Authorization: Bearer $CLERK_SECRET_KEY"
done
```

## Comprobado y sin comprobar

verified: las `{{variables}}` contra la API de Clerk; los cuatro enlaces y la
imagen del correo responden 200; `npm run lint:no-emdash` limpio; render en
Chrome a 700px y a 390px; la tabla del ensayo de aqui arriba.

not verified: como se ve en Gmail, Apple Mail y Outlook (no hay prueba de
cliente real, ni correo enviado); el modo oscuro forzado de Outlook.com; que
aspecto tiene el editor del dashboard con el `markup` vacio.
