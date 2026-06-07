# Handoff: Lifecycle Emails — Digital Polyglot

## Overview
A 7-step lifecycle email sequence (9 sends total) that takes a new user from sign-up to habit, with a 3-step win-back branch for lapsed users. North-star of the whole sequence: **get the user to finish their first story and come back.** Every email has exactly **one CTA**.

The visual language mirrors the marketing site and the app: dark navy canvas with a soft top "lift" glow, big bold Nunito headlines with **one word highlighted in gold**, a rounded yellow CTA, and the app's signature **tap-a-word** reading moment shown as real product (highlighted word → vocab popover → synced audio).

## About the design files
The files in this bundle are **design references created in HTML/React (JSX)** — prototypes that show the intended look, copy, and module composition. They are **not** production code to ship directly.

The actual task described in the brief is to translate these designs into **reusable email builders in the codebase at `src/lib/email.ts`** (the brief: "Me pasas specs + assets y lo traduzco a builders en `src/lib/email.ts`"). Email HTML has its own constraints (tables, inline styles, limited CSS, dark-mode quirks), so treat this bundle as the **spec for look + copy + structure**, and implement it with whatever email-rendering approach the codebase already uses (MJML, react-email, hand-rolled table builders, etc.).

Where a modern-CSS technique here will not survive email clients, the production equivalents are noted inline (see **Email-client porting notes** at the end).

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and copy are final. Recreate pixel-accurately within email constraints. Copy is the **definitive EN copy** and should ship as written.

---

## Design tokens

### Color
| Token | Hex | Use |
|---|---|---|
| `navy` | `#051834` | base canvas / email background |
| `navyTop` | `#0c2c54` | top of the radial "lift" gradient |
| `screen` | `#07203f` | in-app surfaces, cards, tiles |
| `card` | `#0c2950` | vocab popover surface |
| `cardLine` | `rgba(125,211,252,0.16)` | hairline border on cards/tiles |
| `hair` | `rgba(255,255,255,0.08)` | footer divider |
| `fg` | `#eef4fc` | primary text / headlines |
| `fgSoft` | `#c2d2e8` | body copy |
| `muted` | `#8aa0be` | secondary / microcopy |
| `faint` | `#54708f` | meta, footer body |
| `gold` | `#fcd34d` | CTA fill, highlighted headline word, accents |
| `goldInk` | `#2a1a02` | text on gold (CTA label, gold check) |
| `sky` | `#7dd3fc` | tappable-word highlight, sky eyebrows, links, "words" stat |
| `green` | `#5fd0a3` | "days active" stat |
| `blue` | `#2f6df6` | audio play button, progress in scrubber |

**Canvas background** (every email body):
```css
background: radial-gradient(120% 62% at 50% 0%, #0c2c54 0%, #06203f 42%, #051834 74%);
```
For email clients that drop gradients, fall back to solid `#051834`.

### Typography
- Family: **Nunito** (Google Fonts), weights **600, 700, 800, 900**. No italics, no serifs.
- Email fallback stack: `'Nunito', -apple-system, 'Segoe UI', Arial, sans-serif`.

| Role | Size | Weight | Tracking | Line-height |
|---|---|---|---|---|
| Headline H1 | 36–40px | 900 | -0.032em | 1.04 |
| Body lead | 16.5px | 600 | — | 1.52 (max-width ~396px, centered) |
| Eyebrow (overline) | 11.5px | 800 | 0.22em, uppercase | — |
| Stat number (big tile) | 38px | 900 | -0.03em | 1 |
| Stat number (chip) | 22px | 900 | -0.02em | — |
| Card title | 18px (H) / 14.5px (V) | 900 | -0.015em | — |
| Badge / level | 10px | 800–900 | 0.12em, uppercase | — |
| CTA label | 16.5px | 900 | -0.01em | — |
| Footer body | 12px | 600 | — | 1.7 |

Headlines are centered, two lines, with one word/phrase wrapped in `color: #fcd34d` (the `<Gold>` span).

### Spacing / radius / shadow
- Email body width: **560px** (content gutter 40–44px each side).
- Radii: CTA `14`, big cards/tiles `16`, inner surfaces `14`, vocab popover `15`, phone screen `36`, phone bezel `44`, badges/chips `5`, cover thumbnails `9–12`.
- Card shadow: `0 18px 40px -22px rgba(0,0,0,0.7)`.
- CTA shadow: `0 12px 28px -10px rgba(252,211,77,0.65), inset 0 1px 0 rgba(255,255,255,0.55)`.
- Tile/card border: `1px solid rgba(125,211,252,0.16)`.

---

## Reusable components
All components live in `email-kit.jsx`. These are the building blocks the `email.ts` builders should expose. Props and exact styles are in that file; summary below.

| Component | Purpose | Key spec |
|---|---|---|
| `Email` | Email shell | 560px, navy radial bg, Nunito, renders children + `Footer`. Props: `footerNote`, `footerAlign`. |
| `Footer` | Brand + legal | `hair` divider, 22px `Mark` + wordmark, footer body in `faint`, "Manage emails · Unsubscribe" links in `muted` underline. `note` overrides the first line. |
| `Mark` | Logo mark | Rounded square, `linear-gradient(135deg,#fcd34d,#7dd3fc)`, lowercase "dp" in navy, 900. Size/radius props. |
| `CTA` | The single button | Gold gradient `180deg #fde08a→#fcd34d 58%→#f4c430`, label `#2a1a02` 900 16.5px, padding 16×32 (inline) / 17×28 (`block`), radius 14, gold shadow. |
| `Eyebrow` | Overline label | 11.5px / 800 / 0.22em / uppercase. Default gold; pass `color={DPE.sky}` for sky. |
| `Hi` | Tappable word | Inline highlight: bg `rgba(125,211,252,0.92)` (sky) or `rgba(252,211,77,0.92)` (`tone="gold"`), text navy, weight 800, radius 5, padding 1px 5px. |
| `Badge` | Level / tag pill | Translucent tint + colored text. Tones: `sky`, `gold`, `green`. 10px / 800 / 0.12em / uppercase. |
| `StatTile` | Big metric | `screen` tile, number 38px in tone color (`gold`/`sky`/`green`), uppercase label in `muted`. Used in weekly recap. |
| `StatChip` | Inline metric | `screen` chip, 22px gold number + label. Used in celebration. |
| `ProgressBar` | % read | 7px track `rgba(125,211,252,0.16)`, fill gold gradient by `pct`. |
| `StoryCardH` | Horizontal story card | Cover 84×116 + level/badge/meta + title + optional teaser + optional progress. |
| `StoryCardV` | Vertical mini card | Full-width cover (132px tall) + level + meta + title; optional solid-gold `badge` overlay (e.g. "New"). |
| `VocabCard` | Tap-to-translate popover | `card` surface, word 18px 900, "Noun" sky chip, definition in `fgSoft`, sky-outline "♡ Save word" pill. `scale` prop for use inside phone. |
| `AudioBar` | Synced scrubber | Optional blue play circle, time labels (tabular), track with sky→blue fill at 44% + white knob. |
| `CoverArt` | Placeholder scene art | Warm gradient block (`#f1e4c6→#e7b27a→#c96b4a`) for the in-phone story illustration **until real scene art exists**. |
| `PhoneFrame` | Device bezel | Dark gradient bezel radius 44, screen radius 36, notch pill. Welcome only. |

---

## The sequence — per-email spec

Each entry: **trigger**, **subject** (definitive), in-email **eyebrow → headline (gold word) → lead**, the **module**, and the **single CTA**. Component fn names are from `lifecycle-emails.jsx`.

### 1 · Welcome — `EmailWelcome`  *(DECIDED design)*
- **Trigger:** `user.created`, instant.
- **Subject:** `Welcome to Digital Polyglot 👋`
- **Eyebrow:** WELCOME TO DIGITAL POLYGLOT
- **Headline:** "Tap a word. **It clicks.**"
- **Lead:** "Your first short story is ready. Read it, tap any word for the meaning and native audio, and the language starts to make sense."
- **Module:** `PhoneFrame` (width 306) showing the reading screen: header (`‹` + story title + A1 `Badge`), a Spanish sentence with two `Hi` words (`fonda`, `mole`), `VocabCard` (scale 0.92), `AudioBar` (scale 0.92, play). Centered behind a radial gold/sky glow.
- **CTA:** `Open your first story →`  · sub: "About 4 minutes · picked for your level"
- **Note:** the in-phone cover uses `CoverArt` placeholder — swap for real scene illustration when available (see Assets).

### 2 · Activation nudge — `EmailNudge`
- **Trigger:** +24h after signup, first story not finished.
- **Subject:** `Your first story takes about 4 minutes`
- **Eyebrow (sky):** PICK UP WHERE YOU LEFT OFF
- **Headline:** "It clicks faster than you **think.**"
- **Lead:** "Your first story takes about 4 minutes, and you are already partway in. Finish it and you will feel the difference."
- **Module:** `StoryCardH` with real cover, level `Beginner`, meta "· 4 min · audio", title, teaser, **and `ProgressBar` at `pct=38`** with label "38% read · about 2 min left".
- **CTA:** `Finish your first story →`
- **Dynamic:** `firstStory.percentRead`, `minutesLeft`, `cover`, `title`, `excerpt`.

### 3 · Celebration — `EmailCelebration`
- **Trigger:** `story_completed` (first one).
- **Subject:** `You finished your first story 🎉`
- **Top:** 60px gold circle with `✓` (goldInk).
- **Eyebrow:** FIRST STORY COMPLETE
- **Headline:** "That's how it **works.**"
- **Lead:** "You just finished your first story. Those words you tapped are already starting to stick. Now keep the thread going."
- **Module:** two `StatChip`: `47 new words seen`, `4 min of reading`.
- **CTA:** `Read your next story →`
- **Dynamic:** `stats.wordsSeen`, `stats.minutes`.

### 4 · How it works — `EmailHowItWorks`
- **Trigger:** day 3, educational.
- **Subject:** `Why reading beats memorizing`
- **Eyebrow (sky):** WHY IT WORKS
- **Headline:** "Words stick when they live in a **story.**"
- **Lead:** "Lists make you memorize. Stories make you remember. See a word inside a scene, tap it once, and it lands where it belongs."
- **Module:** `screen` card with a centered sentence (one `Hi` word), a centered `VocabCard` (max-width 300), and a centered tip line: "Tap once. Meaning, audio and a save button, without leaving the story."
- **CTA:** `Try it on a new story →`

### 5 · Weekly recap — `EmailRecap`  *(key visual email)*
- **Trigger:** day 7.
- **Subject:** `Your first week, in numbers`
- **Eyebrow:** YOUR FIRST WEEK
- **Headline:** "Look how far you've **come.**"
- **Lead:** "Seven days in. Here is the week you just put together, one story at a time."
- **Module:** row of three `StatTile` — `3 stories` (gold), `128 words` (sky), `5 days active` (green) — **then** a "This week" panel: header "THIS WEEK" + "5 of 7 days", and a 7-column row of day bars (active = gold gradient bar, inactive = faint), labeled M T W T F S S.
- **CTA:** `Keep your rhythm →`
- **Dynamic:** `stats.storiesCount`, `wordsCount`, `daysActive`, `weekDays[7]` (booleans).

### 6 · Next story / identity — `EmailNext`
- **Trigger:** day 10–14.
- **Subject:** `You're becoming a reader in your new language`
- **Eyebrow (sky):** YOU'RE BECOMING A READER
- **Headline:** "A few stories down. **Many to go.**"
- **Lead:** "You are reading in a new language now. Here are three more, picked for where you are."
- **Module:** three `StoryCardV` (real covers): "El metro de Madrid" (A2 · 5 min), "Un mate en Palermo" (A2 · 4 min), "Kaffee in Kreuzberg" (A1 · 6 min).
- **CTA:** `Choose your next story →`
- **Dynamic:** `nextStories[]` ({cover, title, level, minutes}).

### 7 · Win-back (branch, inactive 30–45d)

**7a · Reminder — `EmailWinReminder`**
- **Subject:** `Your stories are still here`
- **Eyebrow (sky):** IT'S BEEN A LITTLE WHILE
- **Headline:** "Your stories are **still here.**"
- **Lead:** "Your library, your saved words and your progress are waiting exactly where you left them."
- **Module:** centered row of 3 cover images (96×132) at 0.85 opacity — the "library".
- **CTA:** `Open your library →`  · footer note: "You haven't read in a while, so we're checking in."

**7b · Value — `EmailWinValue`**
- **Subject:** `New stories since you've been gone`
- **Eyebrow:** NEW SINCE YOU'VE BEEN GONE
- **Headline:** "Fresh stories, your **language.**"
- **Lead:** "We have been busy. New short stories at your level, ready when you are."
- **Module:** two `StoryCardV` with solid-gold "New" badge overlay.
- **CTA:** `See what's new →`  · footer note: "A quick note about what's new since your last visit."
- **Dynamic:** `newStories[]`.

**7c · Sunset — `EmailWinSunset`**
- **Subject:** `We'll stop here — your stories stay saved` *(brief copy; the in-email headline drops the dash)*
- **Top:** 44px `Mark`.
- **Eyebrow (muted):** ONE LAST NOTE
- **Headline:** "We'll **stop here.**"
- **Lead:** "We don't want to crowd your inbox, so we'll pause these emails. Your stories and saved words stay saved, always. Come back whenever you like."
- **CTA:** `Keep me in →`  · sub: "Or do nothing, and we'll quietly step back."  · footer note: "This is the last email in this series."

---

## Dynamic data / merge fields
The builders should accept these (names suggestive):
- `user`: firstName (optional, not currently used in copy), targetLanguage.
- `firstStory`: `{ id, title, level, minutes, coverUrl, excerptHtml (with tappable spans), percentRead, minutesLeft }`.
- `stats`: `{ wordsSeen, minutes, storiesCount, wordsCount, daysActive, weekDays: boolean[7] }`.
- `nextStories`, `newStories`: arrays of `{ title, level, minutes, coverUrl }`.
- `libraryCovers`: array of cover URLs (7a).

All other copy is static and ships as written above.

## Assets
- **Covers:** real catalog covers, in `./assets/` (`cover-es-es.jpg`, `cover-es-mx.jpg`, `cover-es-arg.jpg`, `cover-de-de.jpg`). Originals live in the repo at `public/covers/ss-*.jpg`. In production, render the story's real `coverUrl` (R2). Story **titles** used in the mocks ("El metro de Madrid", "Un mate en Palermo", "Kaffee in Kreuzberg", "Mole en San Ángel") are placeholders — use real catalog titles.
- **Logo mark:** drawn in CSS (`Mark`); the navy/gold/sky "dp" gradient square. White wordmark PNG exists at `public/digital-polyglot-logo.png` if a raster is preferred in email.
- **Pending real asset:** the **in-phone story scene illustration** (Welcome). Currently a `CoverArt` warm-gradient placeholder. Provide the real landscape illustration to finish the Welcome.

## Files in this bundle
- `Lifecycle Emails.html` — open in a browser to see all 9 emails on one canvas (drag to pan, scroll/pinch to zoom, click a title to open fullscreen, ←/→ to step through).
- `email-kit.jsx` — the design system: tokens (`DPE`), `navyBg`, and all reusable components.
- `lifecycle-emails.jsx` — the 9 email compositions (the per-email source of truth for layout + copy).
- `design-canvas.jsx` — presentation harness only (the pan/zoom canvas). **Not part of the email design**; ignore for implementation.
- `assets/` — the cover images referenced above.

---

## Email-client porting notes
Modern CSS used in the mocks and their email-safe equivalents:
- **Layout:** flex/grid + `gap` here → use nested **tables** + cell padding (or MJML columns) for broad client support. Body is a single 560px centered table.
- **Background radial gradient:** keep as progressive enhancement; set a solid `#051834` `bgcolor` on the body table so Outlook/dark-mode render correctly.
- **CTA:** build as a bulletproof button (table cell or VML for Outlook). Gold gradient degrades to solid `#fcd34d` with `#2a1a02` text.
- **Box-shadows / `box-decoration-break`** (used by `Hi` highlight when it wraps) are decorative — fine to drop; keep the highlight bg + padding.
- **Web font:** include the Nunito `@import`/`<link>` with the Arial fallback stack; many clients will use the fallback, which is acceptable.
- **Images:** always set explicit width/height + `alt`; covers should have rounded corners via attribute or a wrapping technique (Outlook ignores `border-radius`).
- **One CTA per email** is a hard rule from the brief — keep it.
- Target body width 560px; ensure single-column stacking on narrow mobile.
