# Domain restructuring cutover

## Goal

| Subdomain | Antes | Después |
|---|---|---|
| `digitalpolyglot.com` (+ `www`) | WordPress (Apache, 216.172.184.57) | Next.js webapp en Vercel |
| `digitalpolyglot.com/blog/*` | WordPress directo | Next.js rewrite → WP origin |
| `reader.digitalpolyglot.com` | Next.js en Vercel | Sin cambios (sigue sirviendo `/api/*` para mobile circulante) |
| `beta.digitalpolyglot.com` | WP legacy "Polycast" | Next.js, sirve solo `/beta` |
| `wp.digitalpolyglot.com` | no existe | A record al WP origin (proxy interno) |

Foundational principle: el blog (`/blog/*`) sigue viviendo en `digitalpolyglot.com` para preservar la autoridad SEO (Organic Search ~496 sesiones/mes en 28 días, todo en `/blog/*`).

## Order of operations

### Step 1 — Pre-cutover (sin downtime)

1. **DNS**: crear `wp.digitalpolyglot.com` como A record a `216.172.184.57` (mismo IP del WP origin). Esperar propagación (`dig +short wp.digitalpolyglot.com` debe devolver el IP).
2. **WP hostname**: en WordPress (Settings → General), añadir `wp.digitalpolyglot.com` como dirección permitida. Si WP solo acepta `www.digitalpolyglot.com`, hay que actualizar `siteurl`/`home` o configurar un alias en el hosting. Verificar `curl -I https://wp.digitalpolyglot.com/blog/30-mexican-spanish-idioms-for-understanding-everyday-humor/` retorna 200.
3. **Test rewrites en preview**: con `WP_ORIGIN_HOST=https://wp.digitalpolyglot.com` en `.env.local`, levantar Next.js y verificar:
   - `/blog/30-mexican-spanish-idioms-for-understanding-everyday-humor/` carga el post WP completo
   - Imágenes y CSS del tema WP cargan (esto valida `/wp-content/*` rewrite)

### Step 2 — Cutover

1. **Vercel**: añadir `digitalpolyglot.com` y `www.digitalpolyglot.com` como dominios del proyecto Next.js.
2. **DNS**: cambiar A record de `digitalpolyglot.com` y `www.digitalpolyglot.com` para que apunten a Vercel (`76.76.21.21` o el CNAME que Vercel indique).
3. Esperar propagación. Durante la transición algunos usuarios verán WP, otros Next.js. No es destructivo.
4. Verificación post-cutover:
   - `curl -I https://digitalpolyglot.com/` → server: Vercel
   - `curl -I https://digitalpolyglot.com/blog/30-mexican-spanish-idioms-for-understanding-everyday-humor/` → 200 OK (vía rewrite)
   - `curl -I https://digitalpolyglot.com/about-us` → 308 → `/`
   - `reader.digitalpolyglot.com/api/mobile/journey?language=de` → sigue funcionando para mobile

### Step 3 — Beta migration (independiente, en paralelo)

1. Confirmar con el usuario que el WP "Polycast" en `beta.digitalpolyglot.com` se puede apagar.
2. Mover el dominio `beta.digitalpolyglot.com` al proyecto Vercel (o configurar Next.js para servir solo `/beta` en ese host).
3. Verificar `beta.digitalpolyglot.com` → renderiza la landing actual de `reader.digitalpolyglot.com/beta`.

## Rollback

Si algo se rompe en Step 2, revertir el A record de `digitalpolyglot.com` al IP original (`216.172.184.57`). Propagación toma minutos. Next.js queda sirviendo solo `reader.*` como hoy.

## Cosas que NO se incluyen en esta primera fase

- Redirects para WP páginas viejas que no traen tráfico (`/free-e-book`, `/contact`, `/shop`, `/sitemap`, etc.). Tras el cutover quedan accesibles vía `wp.digitalpolyglot.com/...` si alguien las necesita.
- Limpieza de `/?p=XXXX` 404s registrados en GA. Son links externos viejos rotos; no mueven la aguja.
- Definir eventos clave en GA4. Hacer antes del cutover sería ideal para medir el impacto, pero es independiente.
- Migración del blog de WP a Next.js. Out of scope; el rewrite mantiene el statu quo del blog.

## Notas técnicas

- El rewrite en `next.config.ts` usa `WP_ORIGIN_HOST` (default `https://wp.digitalpolyglot.com`) para que se pueda apuntar a otra cosa durante tests sin tocar código.
- `/wp-content/*`, `/wp-includes/*`, `/wp-json/*` también van por rewrite para que el tema WP siga cargando assets cuando un usuario visita un post.
- WordPress puede generar URLs absolutas con `https://www.digitalpolyglot.com/wp-content/...` dentro del HTML del post. Después del cutover esas URLs siguen funcionando porque `www.digitalpolyglot.com` apunta a Vercel y los rewrites las atrapan. Sin embargo, links absolutos del WP hacia páginas no-blog (ej. `/cart/`, `/about-us/`) van a romper. Hacer `grep` en el contenido WP si aparece este caso post-cutover.
