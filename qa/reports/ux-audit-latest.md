# UX Audit Report

Generated: 2026-03-27T11:51:56.505Z
Safe autofixes applied: 0

## Web app

- Kind: `web`
- Source files scanned: `139`
- Screenshots/artifacts found: `7`
- Findings: `1`

- [info] Large UI surface with 2502 lines in `src/app/HomeClient.tsx:1`
  Evidence: Large files slow down autonomous fixes and increase regression risk.
  Suggested fix: Split by screen or card family before the next major product sweep.

## iOS app

- Kind: `mobile`
- Source files scanned: `24`
- Screenshots/artifacts found: `173`
- Findings: `1`

- [info] Large UI surface with 12642 lines in `apps/mobile/src/mobile/MobileLibraryShell.tsx:1`
  Evidence: Large files slow down autonomous fixes and increase regression risk.
  Suggested fix: Split by screen or card family before the next major product sweep.

## Sanity Studio

- Kind: `studio`
- Source files scanned: `30`
- Screenshots/artifacts found: `1`
- Findings: `0`

No findings.

