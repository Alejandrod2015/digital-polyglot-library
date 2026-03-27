## Mobile app

Expo app scaffold for the future iOS and Android native experience.

Initial goals:

- keep web and backend untouched
- consume shared domain logic from `packages/domain`
- build mobile-specific UX in isolation

Suggested next commands after installing dependencies from the repo root:

```bash
npm install
npm run dev:mobile
npm run ios
```

TestFlight release notes and upload flow live in:

```bash
apps/mobile/TESTFLIGHT.md
```

Maestro smoke QA lives in:

```bash
.maestro/README.md
```
