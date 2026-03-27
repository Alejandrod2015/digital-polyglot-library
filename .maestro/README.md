# Maestro iOS QA

This repo now includes a minimal Maestro setup for repeatable iOS smoke checks.

The first flows are intentionally conservative:

- `smoke-auth-gate.yaml`
  - validates the signed-out entry screen
  - confirms the primary auth CTA is present
- `qa-main-tabs.yaml`
  - assumes the simulator already has an authenticated in-app session
  - validates the signed-in shell and the main tabs
- `qa-book-reader.yaml`
  - assumes the app is already on a book detail screen
  - validates book detail -> reader -> back to shell
- `qa-interaction-preview.yaml`
  - validates real scroll + tap behavior in preview mode
  - fails if home/explore/book/reader interactions are blocked
- `qa-interaction-authenticated.yaml`
  - validates real Journey scroll + tap behavior in an authenticated session
- `qa-reader-player.yaml`
  - validates reader/player interaction in preview mode
  - checks speed toggle, play toggle and next-story navigation when available

## Prerequisites

1. Start web locally:

```bash
cd /Users/alejandrodelcarpio/digital-polyglot-library
npm run dev
```

2. Start Metro for the iOS dev client:

```bash
cd /Users/alejandrodelcarpio/digital-polyglot-library/apps/mobile
npx expo start --dev-client --host localhost --port 8081
```

3. Boot the simulator and launch the app:

```bash
open -a Simulator
xcrun simctl launch booted com.digitalpolyglot.mobile
```

4. Make sure the simulator is already signed in before running the smoke flow.

5. Optional QA deep links for dev builds:

```bash
xcrun simctl openurl booted 'digitalpolyglot://qa/open-first-book'
xcrun simctl openurl booted 'digitalpolyglot://qa/open-first-story'
xcrun simctl openurl booted 'digitalpolyglot://qa/open-practice'
xcrun simctl openurl booted 'digitalpolyglot://qa/open-favorites'
xcrun simctl openurl booted 'digitalpolyglot://qa/open-journey'
```

## Run the smoke flows

```bash
maestro test .maestro/smoke-auth-gate.yaml
maestro test .maestro/qa-main-tabs.yaml
xcrun simctl openurl booted 'digitalpolyglot://qa/open-first-book'
maestro test .maestro/qa-book-reader.yaml
maestro test .maestro/qa-interaction-preview.yaml
maestro test .maestro/qa-interaction-authenticated.yaml
maestro test .maestro/qa-reader-player.yaml
```

## What the auth-gate flow covers

- app launch
- signed-out iPhone library card
- `Continue with web sign-in`
- `Browse preview catalog`

## What the authenticated flows cover

- bottom navigation visibility
- `Practice` shell
- `Favorites` shell
- `Journey` shell
- return to `Home`
- book detail
- `Start reading`
- reader
- return to book detail
- return to the signed-in shell
- real scroll interaction in `Home`
- real scroll interaction in `Explore`
- real tap interaction for `Book detail` and `Reader`
- real tap interaction for `Journey` map and topic detail
- reader/player interaction for speed, playback and next-story controls

If the authenticated flows stall on shell assertions, the simulator is not actually signed into the native app yet.

## Recommended next additions

1. A dedicated QA seed account with deterministic saved books/stories.
2. A true auth round-trip smoke from the in-app sign-in CTA.
3. Deeper flows:
   - open a story from Explore
   - start a practice session
   - validate Journey topic detail
