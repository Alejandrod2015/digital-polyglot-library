# Digital Polyglot — Webapp Handoff

**Target repo:** `digital-polyglot-library`
**Scope:** Two screens (Home + Journey) + shared shell (Sidebar, Topbar) + a substantially-improved **light mode**.

This document supersedes the older `home-redesign/HANDOFF.md` and `journey-redesign/HANDOFF.md` — they still exist for reference, but the canonical spec is here and the canonical mockups are at the **project root**:

- `Digital Polyglot.html` — Home
- `Journey.html` — Journey
- `styles.css` — single shared stylesheet (both screens, both themes)

Open both HTML files in a browser and toggle the Tweaks panel to flip Dark/Light and the accent color.

---

## Files in this handoff

```
.
├── HANDOFF.md                ← this file (root spec)
├── Digital Polyglot.html     ← Home entry point
├── Journey.html              ← Journey entry point
├── styles.css                ← all CSS (both screens + dark + light)
├── sidebar.jsx               ← shared <Sidebar>
├── components.jsx            ← Home cards (Continue / Hero / Books / Stories) + SectionHead
├── journey-components.jsx    ← Journey topic banner + story card + top bar
├── app.jsx                   ← Home composition + tweaks
├── journey-app.jsx           ← Journey composition + tweaks
├── tweaks-panel.jsx          ← design-time controls (DO NOT SHIP)
└── handoff-assets/
    ├── home-light.png        ← Home in the new light mode
    ├── home-dark.png         ← Home in dark mode (reference)
    ├── journey-light.png     ← Journey in the new light mode
    └── journey-dark.png      ← Journey in dark mode (reference)
```

---

## Reading order

1. This file — sections **A → E** in order.
2. Open the two HTML mockups and the four screenshots in `handoff-assets/`. The mockup wins any disagreement with existing patterns.
3. The two older handoffs (`home-redesign/HANDOFF.md`, `journey-redesign/HANDOFF.md`) cover earlier work; refer to them only for the per-screen breakdowns that aren't re-spec'd here.

---

## A. Design tokens

All tokens live in `styles.css` (`:root` for dark, `.theme-light` for light). **Do not invent new tokens.** Use these via CSS variables — never hardcode.

### A.1 Dark mode (default)

| Token | Value | Used for |
|---|---|---|
| `--background`, `--bg-content` | `#0b1e36` | main canvas |
| `--bg-sidebar` | `#071326` | sidebar |
| `--surface` | `#111a2b` | image fallbacks |
| `--bg-0 → --bg-4` | navy scale | placeholders/illustrations |
| `--foreground` | `#e6eaf2` | primary text |
| `--muted` | `#9aa7bd` | secondary text |
| `--card-bg` | `rgba(255,255,255,0.06)` | cards |
| `--card-bg-hover` | `rgba(255,255,255,0.10)` | card hover |
| `--card-border` | `rgba(255,255,255,0.14)` | hairlines |
| `--chip-bg` / `--chip-border` / `--chip-text` | translucent white / `#d6deea` | badges, kbd |

### A.2 Light mode (NEW — substantially improved)

The previous light mode was a thin inverse-opacity of dark and felt flat and cold. The new one is built on three principles: **warm paper canvas**, **true-white elevated cards with real shadow**, **stronger text contrast**.

| Token | Value | Notes |
|---|---|---|
| `--background`, `--bg-content` | `#f6f4ee` | warm off-white (NOT cold blue-grey) |
| `--bg-sidebar` | `#eee9de` | slightly creamier to read as a panel |
| `--surface` | `#ffffff` | TRUE white for elevated cards |
| `--bg-0 → --bg-4` | warm cream scale | placeholders |
| `--foreground` | `#1a1a1a` | near-black for max contrast |
| `--muted` | `#6b6657` | warm grey |
| `--card-bg` | `#ffffff` | **solid white**, not low-alpha tint |
| `--card-bg-hover` | `#fbfaf6` | barely-tinted hover |
| `--card-border` | `rgba(28,25,18,0.08)` | warm hairline |
| `--chip-bg` | `#f1ece0` | cream chip |
| `--chip-text` | `#3a342a` | dark warm |

**Light-mode-only elevation tokens** (defined inside `.theme-light`):

```css
--shadow-card:
    0 1px 0 rgba(28,25,18,0.04),
    0 1px 2px rgba(28,25,18,0.06),
    0 6px 14px -8px rgba(28,25,18,0.10);

--shadow-card-hover:
    0 1px 0 rgba(28,25,18,0.04),
    0 4px 8px rgba(28,25,18,0.08),
    0 18px 34px -16px rgba(28,25,18,0.20);

--shadow-cover:
    0 14px 28px -10px rgba(28,25,18,0.32),
    0 4px 10px -4px rgba(28,25,18,0.18);
```

Use `var(--shadow-card)` on all elevated cards (continue, hero, book, story) inside `.theme-light`. **Do NOT carry over the dark-mode pure-translucent card style — that's what made the previous light mode look broken.**

### A.3 Accent palette

Four selectable accents, switched via root class. The default is **gold**.

| Class | `--accent` (dark) | `--accent` (light) | `--accent-ink` |
|---|---|---|---|
| `.accent-gold` (default) | `#fcd34d` | `#d18a1f` (deeper amber on cream) | `#2a1a02` |
| `.accent-orange` | `#fb923c` | `#d97757` | `#2d1003` |
| `.accent-lavender` | `#c4b5fd` | `#7c6ad6` | dark / `#ffffff` |
| (no class — cyan) | `#7dd3fc` | same | `#082f49` |

In light mode the accents are **re-mapped to deeper tones** because the saturated dark-mode values look washed out on cream. This is done with a `.theme-light.accent-X` selector — see `styles.css` lines ~147–170.

Use `--accent` for: active nav, primary CTAs, progress bars, series labels, "See all" link, hero eyebrow, "Free today" pill, journey level stat.

### A.4 Badges

Beginner / Intermediate / Advanced badges are token-driven:

```css
--badge-{beginner,intermediate,advanced}-{bg,border,text}
```

Dark mode uses translucent green/amber/rose with light text. Light mode uses **saturated solid fills** (`#e1f5ec`, `#fdf0d6`, `#fde2e6`) with dark ink so they pop on cream cards. Existing `<LevelBadge />` component already maps to these tokens — no code change needed if you keep the existing API.

### A.5 Type

Nunito only. **All weights heavy.** Body = 700, titles = 900.

| Role | Spec |
|---|---|
| Hero h1 | 38px / 900 / -0.025em / 1.05 |
| Section h2 | 22px / 900 / -0.02em |
| Card title (Continue / Story) | 16–17px / 900 / -0.015em |
| Book title | 18px / 900 / -0.015em |
| Body / description | 14.5px / 600 / 1.55 / muted |
| Series / accent label | 12px / 800 / accent |
| Eyebrow (overline) | 11px / 800 / 0.16em / uppercase |
| Stat number | 17px / 900 / tabular-nums |

No italics. No serifs. Ever.

---

## B. Shared shell

These two components appear on **every screen** (Home, Journey, and future screens). Build them once and import.

### B.1 Sidebar (`src/components/Sidebar.tsx`)

Spec is unchanged from the original home handoff — see `home-redesign/HANDOFF.md` Section 1 — with the following additions/clarifications for the **new light mode**:

1. **Logo mark** — in dark mode, gold square + dark ink; in light mode, **swap to a dark mark on cream** (`background: var(--foreground); color: var(--bg-sidebar)`) so it reads as the brand without competing.
2. **Active nav item** — dark mode keeps the existing `background: var(--accent-soft)` tint. Light mode gets a **white pill with shadow** instead of a translucent tint (it reads much stronger):
   ```css
   .theme-light .nav-item.active {
     background: #ffffff;
     color: #1a1a1a;
     box-shadow: 0 1px 0 rgba(28,25,18,0.04), 0 4px 10px -4px rgba(28,25,18,0.10);
   }
   .theme-light .nav-item.active .icon { color: var(--accent-strong); }
   ```
3. **Streak card + profile row** in light mode get the same paper-card treatment — `background: #ffffff`, hairline border, soft 1-px shadow. The plan badge in light mode uses lavender (`bg #e8e3f5`, text `#5b3fc0`) instead of the dark-mode blue.
4. **Sidebar divider** — light mode adds an inset highlight on the right edge so the sidebar reads as a raised panel:
   ```css
   .theme-light .sidebar {
     border-right: 1px solid rgba(28,25,18,0.08);
     box-shadow: inset -1px 0 0 rgba(255,255,255,0.6);
   }
   ```

All the above are already in `styles.css` under the **"LIGHT MODE — component refinements"** block at the bottom — just keep that block intact when you port the styles into `globals.css`.

### B.2 Topbar (Home only — `HomeTopbar.tsx`)

Unchanged from `home-redesign/HANDOFF.md` Section 2 (greet + search pill + bell), with three light-mode tweaks:

- **Search pill** — solid white background with a soft outline; on focus, the outline becomes the accent color with a `0 0 0 4px var(--accent-soft)` halo.
- **Bell icon-btn** — white paper chip with a hairline; the unread-dot border becomes white (not bg-content).
- **kbd `⌘K`** — cream chip (`#f1ece0`) with warm grey ink.

### B.3 Journey top bar (`JourneyTopBar.tsx`)

Already spec'd in `journey-redesign/HANDOFF.md` (language pill + 3 stat counters). Light-mode adjustments:

- Language pill → paper chip (white bg + hairline + soft shadow), flag circle uses cream bg.
- Stat colors deepen for legibility on cream:
  - Energy: `#c4541f` (was `#fb923c`)
  - Level:  `#b46f00` (was `#fcd34d`)
  - Stars:  `#0a8bb4` (was `#7dd3fc`)

---

## C. Page 1 — Home (`src/app/HomeClient.tsx`)

Full per-section specs live in `home-redesign/HANDOFF.md`. The five v1 failure modes listed at the top of that file still apply — re-read them.

What's new here (not in the older handoff):

### C.1 Card elevation in light mode

Every card surface on Home (`.cl-card`, `.hero`, `.book-card`, `.story-card`) uses the same recipe under `.theme-light`:

```css
background: #ffffff;
border: 1px solid rgba(28,25,18,0.06);
box-shadow: var(--shadow-card);
```

On hover: keep the white bg, swap the shadow to `var(--shadow-card-hover)`. **Do NOT change the bg on hover** in light mode — the shadow does the work. (Dark mode keeps its existing bg-shift behavior, that's the point of the contrast.)

### C.2 Hero corner pill in light mode

The "Free today · resets in Xh Ym" pill changes background:

```css
.theme-light .hero-corner {
  background: rgba(255,255,255,0.92);
  border-color: rgba(28,25,18,0.10);
  color: #3a342a;
  box-shadow: 0 4px 12px -6px rgba(28,25,18,0.18);
}
```

The inner "FREE TODAY" chip stays accent (deep amber in light, bright gold in dark).

### C.3 Placeholder pattern in light mode

The mockup uses striped-gradient placeholders for cover-image slots (kids will get real R2 URLs in prod, but the placeholder texture must look right when covers are missing). In light mode the diagonal stripes invert:

```css
.theme-light .placeholder {
  background:
    repeating-linear-gradient(135deg,
      rgba(28,25,18,0.04) 0,
      rgba(28,25,18,0.04) 2px,
      transparent 2px, transparent 10px),
    linear-gradient(135deg, var(--ph-a, #efe9da) 0%, var(--ph-b, #e8e2d2) 100%);
  color: rgba(28,25,18,0.55);
}
```

When a real cover URL is present, render the `<img>` instead — placeholder is only the fallback.

### C.4 Subtle main-canvas gradient (light mode only)

To avoid a perfectly flat cream wash, the `.main` element in light mode gets a 2-stop radial gradient:

```css
.theme-light .main {
  background:
    radial-gradient(1100px 600px at 100% -10%, #fff8e4 0%, transparent 55%),
    radial-gradient(900px 700px at -10% 110%, #f0ece1 0%, transparent 60%),
    var(--bg-content);
}
```

Adds depth without competing with the cards. Don't apply this to the sidebar — it stays solid `--bg-sidebar`.

---

## D. Page 2 — Journey (`src/app/journey/JourneyClient.tsx`)

Full per-section spec lives in `journey-redesign/HANDOFF.md`. Re-read the **"🚨 Visual rules — don't compromise"** block before touching code: 3D bevels, topic palette cycling across the whole flat list, pulsing halo on the next card, no checkpoint chip, no upper stat cards.

What's new here (not in the older handoff):

### D.1 Story card in light mode

The dark mode card sits on `var(--bg-1)` (a deep navy). In light mode the card becomes white with a softer 3D shadow stack:

```css
.theme-light .j-story-card {
  background: #ffffff;
  border: 1px solid rgba(28,25,18,0.06);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.9),
    inset 0 -1px 0 rgba(28,25,18,0.08),
    0 4px 0 rgba(28,25,18,0.10),
    0 6px 14px -8px rgba(28,25,18,0.14);
}
.theme-light .j-story-card:active {
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.9),
    inset 0 -1px 0 rgba(28,25,18,0.08),
    0 1px 0 rgba(28,25,18,0.10);
}
```

Title color stays `--foreground` (dark warm), thumb bg becomes cream (`#f1ece0`), check circle border darkens, locked cards drop to `opacity: 0.55` with muted title color.

### D.2 Active ("next") card

The pulsing topic-colored halo stays — opacity drops slightly to `0.42` peak in light mode so it doesn't overpower the cream surround. Animation, duration, and the topic palette **do not change**.

### D.3 Locked topic banner in light mode

The dark-mode locked banner uses `#3b4a66` (slate). On cream that reads as a hole, so light mode swaps to a warm desaturated tone:

```css
.theme-light .j-topic-banner.locked {
  background: #c8c2b3;   /* warm grey instead of slate */
  /* same 3D shadow stack with softer dark layers */
}
.theme-light .j-topic-banner.locked .eyebrow { color: rgba(255,255,255,0.70); }
.theme-light .j-topic-banner.locked .title   { color: rgba(255,255,255,0.85); }
```

Active (unlocked) topic banners keep their topic color in both themes — that's the whole point of the per-topic palette.

### D.4 Checkpoint chip

Already implemented in the dark mockup. **The current journey-redesign handoff said "no checkpoint" — that decision has been reversed.** The mockup now renders a checkpoint chip between topic blocks. Three states:

- **Locked** — `.j-checkpoint-chip` with a dashed border, muted color
- **Ready** — solid amber on amber-tinted bg, calls for action
- **Passed** — solid green on green-tinted bg

Tokens differ per theme (light mode uses opaque solid fills, dark mode uses translucent tints). Both sets are in `styles.css` — search for `.j-checkpoint-chip`.

---

## E. Light mode — wiring & toggle

### E.1 The class

A single class on the shell root toggles everything:

```tsx
<div className={`shell ${theme === "light" ? "theme-light" : ""} accent-${accent}`}>
```

That's it. Every token re-binds, every component picks up its light-mode refinement automatically. No per-component conditional CSS in TSX.

### E.2 Where to store the preference

Persist the user's theme + accent in `publicMetadata` (Clerk) so it follows them across devices. Fall back to `localStorage` for signed-out users. Default = `{ theme: "dark", accent: "gold" }`.

### E.3 System-preference fallback

For first-time visits with no stored preference, honour `@media (prefers-color-scheme: light)` once, then persist the resulting choice. Don't keep re-reading the media query — users expect their explicit toggle to stick.

### E.4 What you DON'T need to do

- Don't duplicate any component for light mode.
- Don't write any new images for light mode — the same cover URLs / placeholder gradients work in both.
- Don't change the topic-color palette in journey — colored banners look correct on both backgrounds.
- Don't add per-route theme overrides — the toggle is global.

---

## F. Acceptance checklist

### Both themes

- [ ] Sidebar logo + active nav + streak card + profile pill all render correctly
- [ ] Tweaks panel (dev-only) lets you flip Dark/Light and Accent live; the choice persists across reload
- [ ] All four accent variants render without breaking anywhere (`cyan / orange / gold / lavender`)
- [ ] No console errors, no missing tokens, no fallback-to-default-font flashes

### Home — light mode

- [ ] Canvas is a warm cream (`#f6f4ee`) with the radial-gradient depth on `.main` only
- [ ] Sidebar reads as a creamier panel, with the dark logo mark
- [ ] Continue Listening cards: pure white, hairline border, soft elevation shadow; cover image renders (not an empty box); progress bar still visible
- [ ] Hero is a 2-column grid with the "FREE TODAY" pill top-right of the image, on a white card
- [ ] Latest Books / Latest Stories cards all white-with-shadow
- [ ] Badges (Beginner/Intermediate/Advanced) use the saturated solid-fill light-mode tokens — readable, not washed out
- [ ] "See all" link and series labels use the deep-amber light-mode accent (`#d18a1f`), not the dark-mode `#fcd34d`

### Home — dark mode

- [ ] Looks identical to the previous (approved) dark version — no regressions

### Journey — light mode

- [ ] Top bar: language pill is a paper chip; stats are color-deepened for cream legibility
- [ ] Topic banners (active) keep their topic color and the 3D bevel
- [ ] Story cards are white-with-shadow, title in dark warm, check circle visible
- [ ] Locked topic banner uses warm grey `#c8c2b3` (NOT the dark-mode slate)
- [ ] Pulsing halo on the active card is present but slightly softer
- [ ] Locked story cards fade to `opacity: 0.55` with muted title

### Journey — dark mode

- [ ] Looks identical to the previous (approved) dark version — no regressions

---

## G. What NOT to do

- ❌ Don't merge the light-mode tokens into `:root` — they live exclusively under `.theme-light` so the cascade works.
- ❌ Don't apply white card backgrounds in light mode via inline style — use the tokens (`var(--card-bg)`) so accent and theme changes stay decoupled.
- ❌ Don't bring back the old `rgba(15,29,51,0.06)` card-bg for light — that's the broken v1.
- ❌ Don't change the dark-mode tokens. The new work is **additive**, not a redesign of dark.
- ❌ Don't replicate the topic-banner shadow stack with Tailwind arbitrary values — the multi-line `box-shadow` strings don't survive class extraction cleanly. Use the rescue CSS class `.j-topic-banner` from `styles.css` (or `.dp-journey-banner` if you've already pulled `globals-additions.css`).

---

## H. Prompt for Claude Code

> Read `HANDOFF.md` at the repo root of `digital-polyglot-library`. Open the two HTML mockups (`Digital Polyglot.html`, `Journey.html`) in a browser and toggle the Tweaks panel to confirm Dark/Light parity.
>
> Sections A–E describe tokens, the shared shell, the Home screen, the Journey screen, and the new light mode. Sections F–G are the acceptance checklist and the don'ts. The mockup is the source of truth.
>
> Implementation order:
> 1. Sync tokens — append the `.theme-light { ... }` block and the `.theme-light .X` refinements (everything after line ~1283 in `styles.css`) into `src/app/globals.css`.
> 2. Wire the theme toggle — store `theme` + `accent` on Clerk `publicMetadata` (fallback localStorage), set the root class as `shell theme-light accent-gold` (or whatever the user picked).
> 3. Build/refresh the shell (Sidebar, Home topbar, Journey topbar) — see Section B.
> 4. Wire Home — see Section C and the older `home-redesign/HANDOFF.md` for per-card details.
> 5. Wire Journey — see Section D and the older `journey-redesign/HANDOFF.md` for the topic-banner / story-card / zigzag pattern.
> 6. Walk the Acceptance Checklist (F) screen-by-screen against the four screenshots in `handoff-assets/`.
>
> Open a PR with the checklist filled in and screenshots of: (1) Home light, (2) Home dark, (3) Journey light, (4) Journey dark, all at desktop ≥ 1280px.
