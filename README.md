This is a [Next.js](https://nextjs.org) app for Digital Polyglot.

## Getting Started

1. Copy `.env.example` into your local environment file and fill the values you need.
2. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Billing setup

- Web billing stays on Stripe.
- Android TWA billing uses Google Play Billing through Digital Goods API and Payment Request API.
- Unified entitlement data is stored in `BillingEntitlement`.
- Setup notes for Bubblewrap, asset links, Play products, and RTDN live in `docs/google-play-twa-rollout.md`.

## Production checks

- `npm run build`
- Verify `/.well-known/assetlinks.json` responds with your real package name and SHA256 fingerprint after env vars are set.
- Verify `/plans` uses Stripe on the open web and Google Play Billing inside the Android TWA.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Google Play TWA rollout guide](./docs/google-play-twa-rollout.md)

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
