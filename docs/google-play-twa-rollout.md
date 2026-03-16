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
GOOGLE_PLAY_PACKAGE_NAME=com.example.digitalpolyglot
GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL=play-billing-service-account@project-id.iam.gserviceaccount.com
GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_PLAY_PRODUCT_PLAN_MAP={"premium_monthly":"premium","premium_annual":"premium"}
GOOGLE_PLAY_SHA256_CERT_FINGERPRINTS=AA:BB:...
```

## Bubblewrap

Install and initialize:

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://your-domain.com/favicon/site.webmanifest
```

Values you will need during setup:

- Android package name: `com.yourcompany.digitalpolyglot`
- App name: `Digital Polyglot`
- Start URL: `https://your-domain.com/`
- Theme color: `#0b1e36`
- Navigation scope: `/`

Then build:

```bash
bubblewrap build
```

## assetlinks.json

The repo now serves `https://your-domain.com/.well-known/assetlinks.json` automatically from `GOOGLE_PLAY_PACKAGE_NAME` and `GOOGLE_PLAY_SHA256_CERT_FINGERPRINTS`.

If you want to inspect the shape, it will look like this after those env vars are set:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yourcompany.digitalpolyglot",
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
