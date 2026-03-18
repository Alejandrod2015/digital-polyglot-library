# Google Play TWA rollout

## What is ready in the repo

- PWA manifest now includes `id`, `start_url`, `scope`, and a maskable icon entry.
- `/plans` detects Google Play Billing through `window.getDigitalGoodsService`.
- Web keeps using Stripe.
- Android TWA can use Play Billing and server-side verification endpoints.
- A unified `BillingEntitlement` table now stores Stripe and Google Play subscription state.

## Environment variables to add

```env
NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_replace_monthly
NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID=price_replace_annual
NEXT_PUBLIC_GOOGLE_PLAY_PREMIUM_MONTHLY_PRODUCT_ID=premium_monthly
NEXT_PUBLIC_GOOGLE_PLAY_PREMIUM_ANNUAL_PRODUCT_ID=premium_annual
GOOGLE_PLAY_PACKAGE_NAME=com.digitalpolyglot.app
GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL=play-billing-service-account@project-id.iam.gserviceaccount.com
GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_PLAY_PRODUCT_PLAN_MAP={"premium_monthly":"premium","premium_annual":"premium"}
GOOGLE_PLAY_SHA256_CERT_FINGERPRINTS=D4:4F:C7:2F:54:64:2B:D4:18:8D:D0:DB:19:20:7F:C9:8B:75:5D:6B:6A:AE:CF:4C:07:FD:5A:02:DF:1A:AD:B2,<PLAY_APP_SIGNING_SHA256>
```

## Bubblewrap

Install and initialize:

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://reader.digitalpolyglot.com/favicon/site.webmanifest
```

Values you will need during setup:

- Android package name: `com.digitalpolyglot.app`
- App name: `Digital Polyglot`
- Start URL: `https://reader.digitalpolyglot.com/`
- Theme color: `#0b1e36`
- Navigation scope: `/`

Then build:

```bash
bubblewrap build
```

## assetlinks.json

The repo now serves `https://reader.digitalpolyglot.com/.well-known/assetlinks.json` automatically from `GOOGLE_PLAY_PACKAGE_NAME` and `GOOGLE_PLAY_SHA256_CERT_FINGERPRINTS`.

Use both fingerprints in `GOOGLE_PLAY_SHA256_CERT_FINGERPRINTS`:
- the upload key fingerprint currently used in this repo: `D4:4F:C7:2F:54:64:2B:D4:18:8D:D0:DB:19:20:7F:C9:8B:75:5D:6B:6A:AE:CF:4C:07:FD:5A:02:DF:1A:AD:B2`
- the Google Play app signing fingerprint from Play Console > `Integridad de la app`

If you want to inspect the shape, it will look like this after those env vars are set:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.digitalpolyglot.app",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
      ]
    }
  }
]
```

## Play Console

Create these subscriptions with stable IDs:

- `premium_monthly`
- `premium_annual`

If you later add another paid tier, extend `GOOGLE_PLAY_PRODUCT_PLAN_MAP`.

## Recommended test flow

1. Upload the first `.aab` to Internal testing.
2. Open `/plans` inside the TWA from the internal track.
3. Confirm monthly and annual prices come from Google Play.
4. Buy a test subscription.
5. Confirm `/api/billing/google-play/verify` creates or updates `BillingEntitlement`.
6. Confirm Clerk metadata changes `plan` and `billingSource`.
7. Point your Pub/Sub push subscription for RTDN to `/api/billing/google-play/rtdn`.
