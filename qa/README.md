# UX Audit Bot

This repo now includes a first-pass UX audit system that can run repeatedly across apps.

It is intentionally simple:

- `web` screenshot adapter
  - captures core web routes with Playwright + system Chrome
  - stores artifacts in `qa-artifacts/web`
- `studio` screenshot adapter
  - captures the Sanity Studio shell with the same Playwright runner
  - stores artifacts in `qa-artifacts/studio`
- `source` audit
  - scans app source for low-risk UX problems
  - currently detects exact duplicate eyebrow/title copy such as `Stories` + `Stories`
  - flags oversized UI surfaces that are likely getting too hard to maintain
- `visual artifact` coverage
  - reports whether an app currently has fresh screenshots/artifacts available for visual review
- `safe autofix`
  - supports explicit fix mappings for copy issues we trust enough to change automatically

## Supported apps

- `web`
- `mobile-ios`
- `studio`

The system is adapter-based, so we can keep expanding it:

- mobile can use `Maestro` screenshots
- web now uses `Playwright` + Chrome screenshots
- studio can use source heuristics first, then visual adapters later

## Run

```bash
cd /Users/alejandrodelcarpio/digital-polyglot-library
npm run qa:ux:web:capture
npm run qa:ux:studio:capture
npm run qa:ux:audit
```

This writes:

- `qa/reports/ux-audit-latest.json`
- `qa/reports/ux-audit-latest.md`
- `qa-artifacts/web/*.png`
- `qa-artifacts/studio/*.png`

## Run with safe autofixes

```bash
cd /Users/alejandrodelcarpio/digital-polyglot-library
npm run qa:ux:audit:fix
```

This only applies fixes that are explicitly mapped in [ux-audit.config.json](/Users/alejandrodelcarpio/digital-polyglot-library/qa/ux-audit.config.json).

## Web screenshot prerequisites

1. Start the local web app:

```bash
cd /Users/alejandrodelcarpio/digital-polyglot-library
npm run dev
```

2. Run the capture:

```bash
cd /Users/alejandrodelcarpio/digital-polyglot-library
npm run qa:ux:web:capture
npm run qa:ux:studio:capture
```

The capture uses the system Chrome channel through Playwright, so it does not need a separate browser download.

## What it catches today

- exact duplicate eyebrow/title pairs
- giant UI shell files that deserve refactor attention
- missing recent screenshot coverage for an app

## Next useful additions

1. Run Maestro flows automatically before the audit.
2. Add visual diffing on top of the web screenshot adapter.
3. Add spacing/copy consistency heuristics for cards and buttons.
4. Add a reviewer mode that opens findings and patches small issues automatically, then reruns smoke tests.
