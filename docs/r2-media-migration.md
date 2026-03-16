## R2 Media Migration

This app now resolves catalog media from:

- `/media/catalog/images/<filename>`
- `/media/catalog/audio/<filename>`

If you set `NEXT_PUBLIC_MEDIA_BASE_URL`, those paths are served from that base URL instead of the app origin.

Example:

```env
NEXT_PUBLIC_MEDIA_BASE_URL=https://cdn.digitalpolyglot.com
```

Then the catalog media URLs become:

- `https://cdn.digitalpolyglot.com/media/catalog/images/...`
- `https://cdn.digitalpolyglot.com/media/catalog/audio/...`
- `https://cdn.digitalpolyglot.com/media/generated/images/...`
- `https://cdn.digitalpolyglot.com/media/generated/audio/...`
- `https://cdn.digitalpolyglot.com/media/standalone/...`

### Recommended R2 layout

Bucket key layout:

- `media/catalog/images/<filename>`
- `media/catalog/audio/<filename>`
- `media/generated/images/<filename>`
- `media/generated/audio/<filename>`
- `media/standalone/<slug>/cover.<ext>`
- `media/standalone/<slug>/audio.<ext>`

### Required env vars for new uploads

Server-side uploads use S3-compatible object storage credentials:

```env
MEDIA_STORAGE_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
MEDIA_STORAGE_BUCKET=digital-polyglot-media
MEDIA_STORAGE_ACCESS_KEY_ID=...
MEDIA_STORAGE_SECRET_ACCESS_KEY=...
MEDIA_STORAGE_REGION=auto
MEDIA_STORAGE_PUBLIC_BASE_URL=https://cdn.digitalpolyglot.com
NEXT_PUBLIC_MEDIA_BASE_URL=https://cdn.digitalpolyglot.com
```

When these env vars are set:

- newly generated covers upload to object storage instead of Sanity
- newly generated audio uploads to object storage instead of Sanity
- public standalone story queries prefer `coverUrl` / `audioUrl`
- Sanity stays as a metadata/CMS layer, with asset fallback only for older docs

### Current local source of truth

Catalog assets are stored locally in:

- `public/media/catalog/images`
- `public/media/catalog/audio`

These folders can be uploaded directly to R2 while preserving the same key paths.

### Safe rollout

1. Upload `public/media/catalog/**` to R2 with `npm run media:upload-catalog`.
2. Point `cdn.digitalpolyglot.com` at the bucket.
3. Set `NEXT_PUBLIC_MEDIA_BASE_URL=https://cdn.digitalpolyglot.com`.
4. Set the `MEDIA_STORAGE_*` env vars for server-side uploads.
5. Redeploy.
6. Run `npm run media:backfill-standalone` to copy existing standalone story media to object storage and patch `coverUrl` / `audioUrl`.

No code changes should be needed after that for the static catalog, and new generated media will stop landing in Sanity.
