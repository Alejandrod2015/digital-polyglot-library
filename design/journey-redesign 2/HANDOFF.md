# Journey Redesign — Drop-in Handoff

**Target repo:** `digital-polyglot-library`
**Target screen:** `src/app/journey/JourneyClient.tsx`
**Goal:** Replace the current node-graph layout with the iPhone-style vertical journey (colored topic banners + zigzag story cards).

---

## 🎯 What changes

**Out:** the current upper cards (Journey Score · Review Lane · Placement) AND the node-graph map with dashed connecting lines.

**In:** a vertical scroll that matches the iPhone app exactly:

```
[Language pill]                              ⚡ 8 · 🏆 Lv 7 · ⭐ 1.4k

┌─────────────────────────────────────────────────────────────────┐
│ LEVEL A1                                                  [≡]   │
│ Food & Drink                                                    │
└─────────────────────────────────────────────────────────────────┘  ← Topic banner with 3D bevel

  ┌──────────────────────────────────┐
  │ [🍞] Desayuno en la finca   [✓]│  ← Story card, done
  └──────────────────────────────────┘
            ┌──────────────────────────────────┐
            │ [🥭] El mercado de Medellín [✓]│
            └──────────────────────────────────┘
                  ┌──────────────────────────────────┐
                  │ [👵] Café con la abuela     [✓]│
                  └──────────────────────────────────┘
                        ┌──────────────────────────────────┐
                        │ [🌽] Una arepa para llevar  [✓]│   ← Active "next" card
                        └──────────────────────────────────┘     with pulsing halo
                  ...zigzag continues...

┌─────────────────────────────────────────────────────────────────┐
│ LEVEL A2 · Locked                                         [≡]   │  ← muted bg #3b4a66
│ Work & Money                                                    │
└─────────────────────────────────────────────────────────────────┘
   ...locked story cards underneath...
```

Reference: `handoff-assets/journey-final.png`.

---

## 🚨 Visual rules — don't compromise

1. **3D button effect on every banner and card.** Use the box-shadow stack from `globals-additions.css`. Inset highlight on top, 5px (banner) or 4px (card) dark stack underneath. Pressed state shrinks the stack and translates +3px. This is what makes them feel "Duolingo-pressable".
2. **One topic = one color.** Cycle through `TOPIC_PALETTE` in order across the whole journey (not per-level). Same blue/green/purple/orange order as the iPhone `TOPIC_PANEL_PALETTE`.
3. **The "next" card pulses.** Use the `.dp-journey-card.active-card::before` halo defined in `globals-additions.css`. Topic-color blur, 22px filter, 2.4s ease-in-out loop.
4. **Locked levels are visibly muted.** Topic banner bg becomes `#3b4a66`, eyebrow/title fade to white/45 and white/55, all stories show the lock icon, and the cards are `opacity-55`.
5. **No "Take the checkpoint" chip.** The iPhone has no checkpoint UI on this screen. Don't add it.
6. **No upper stats cards.** Journey Score, Review Lane, and Placement cards from the current web are gone. The top bar is just language pill + 3 stats.

---

## 📦 What's in this folder

```
journey-redesign/
├── HANDOFF.md                              ← this file
├── globals-additions.css                   ← CSS to append to globals.css
├── handoff-assets/
│   └── journey-final.png                   ← target visual
├── tsx/                                    ← drop straight into src/components/
│   ├── JourneyTopBar.tsx
│   ├── JourneyTopicBanner.tsx
│   ├── JourneyStoryCard.tsx
│   └── JourneyClient.example.tsx           ← shows the wiring
└── (mockup files for reference)
    ├── Journey.html
    ├── styles.css
    ├── journey-components.jsx
    └── journey-app.jsx
```

---

## ⚙️ Step-by-step (in this order)

### 1. Append CSS to `globals.css`

Copy the contents of `journey-redesign/globals-additions.css` into the end of `src/app/globals.css`. It adds:

- `.dp-journey-card` — 3D button shadow stack
- `.dp-journey-card.active-card` — brighter stack + pulsing halo
- `@keyframes dp-journey-halo` — the 2.4s pulse animation

If your `globals.css` already has the rescue classes (`.dp-aspect-*`, `.dp-hero-grid` etc) from the home handoff, drop these at the bottom of the same Tailwind-rescue block.

### 2. Drop in the 3 TSX components

```
journey-redesign/tsx/JourneyTopBar.tsx       → src/components/JourneyTopBar.tsx
journey-redesign/tsx/JourneyTopicBanner.tsx  → src/components/JourneyTopicBanner.tsx
journey-redesign/tsx/JourneyStoryCard.tsx    → src/components/JourneyStoryCard.tsx
```

Dependencies: only `lucide-react` and `@clerk/nextjs` — both already in the repo. No new packages.

### 3. Wire them into `JourneyClient.tsx`

Open `journey-redesign/tsx/JourneyClient.example.tsx`. It shows the exact structure:

1. Import the 3 components + `TOPIC_PALETTE` + `WAVE_PATTERN`.
2. Render `<JourneyTopBar>` at the top.
3. Flatten `track.levels[].topics[]` into a single ordered list of topics, keeping `levelId` and `locked` on each. The topic palette cycles across this flat list — NOT per-level — so colours don't reset between A1 and A2.
4. For each topic, render `<JourneyTopicBanner>` + a list of `<JourneyStoryCard>` with the per-row `waveOffset` from `WAVE_PATTERN`.
5. **Delete** the current upper cards (`JourneyOverviewCard`, `ReviewLane`, `Placement`) and the node-graph render block.

### 4. Map your existing data to `StoryNodeState`

The mockup uses 4 states: `done | next | available | locked`. Derive them from your existing progress data with this helper (included in `JourneyClient.example.tsx`):

```ts
function deriveStoryState({ isLevelUnlocked, isStoryComplete, isNextRecommended, isUnlocked }) {
  if (!isLevelUnlocked || !isUnlocked) return "locked";
  if (isStoryComplete) return "done";
  if (isNextRecommended) return "next";  // ← only ONE story per topic should be "next"
  return "available";
}
```

The "next" card is the single recommended-next story across the whole active topic. Use your existing `globalJourneyNextStoryId` or `nextStory` selector.

---

## 🎨 Token reference (no new tokens)

| Use | Token | Value |
|---|---|---|
| Topic palette | (literal array) | `["#1f7ee0", "#58a700", "#a560e8", "#ff9600", "#ff4b4b", "#00b894", "#e17055", "#5dd9e8", "#f5b942", "#ff8aa8"]` — same order as iPhone `TOPIC_PANEL_PALETTE` |
| Locked topic bg | (literal) | `#3b4a66` |
| Done check fill | `--color-cyan` | `#7dd3fc` |
| Done check ink | (literal) | `#082f49` |
| Energy stat | `--color-streak` or literal | `#fb923c` |
| Level stat | `--color-gold` | `#fcd34d` |
| XP stat | `--color-cyan` | `#7dd3fc` |
| Story card bg | `--bg-1` | `#08264d` |
| Locked story | (opacity-55 on card) | — |

If `--color-cyan` isn't in your `globals.css` `:root`, add it:

```css
:root {
  /* ... existing ... */
  --color-cyan: #7dd3fc;
}
```

---

## ✅ Acceptance checklist

Visual (compare to `handoff-assets/journey-final.png`):

- [ ] Top bar shows: language pill + 3 stat counters in one line (no wrapping)
- [ ] No upper "Journey Score / Review Lane / Placement" cards
- [ ] Each topic has a big colored banner with `LEVEL X` eyebrow + title + list icon
- [ ] Topic banners visibly look like pressable 3D buttons (clear dark bottom stack)
- [ ] Story cards alternate left/right in a zigzag pattern
- [ ] Active ("next") story card glows with a pulsing topic-colored halo
- [ ] Done stories have a cyan-filled check circle
- [ ] Locked stories show a lock icon and are dimmed
- [ ] Locked levels (A2 and beyond, until unlocked) have muted #3b4a66 banner bg
- [ ] No "Take the checkpoint" chip anywhere

Functional:

- [ ] Topic banner tap opens the topic detail or scrolls into the topic block
- [ ] Story card tap navigates to the story
- [ ] Disabled (locked) cards don't navigate
- [ ] Language pill opens the existing `LanguageSwitcher` sheet
- [ ] No console errors

---

## ⛔ Things NOT to do

- ❌ Do NOT keep the node-graph map or the dashed connector lines.
- ❌ Do NOT cycle topic colors per level — they cycle across the whole flat list.
- ❌ Do NOT add a checkpoint chip / button anywhere on this screen.
- ❌ Do NOT use Tailwind arbitrary `aspect-[...]` / `grid-cols-[...]` for things that already have a `.dp-*` rescue class (same rule as the home handoff).
- ❌ Do NOT introduce new color tokens. Use `TOPIC_PALETTE` for topic colors and `--color-cyan` / `--color-gold` / `--color-streak` / `--bg-1` / `--bg-content` for everything else.

---

## Prompt for Claude Code

> Read `HANDOFF.md` in this folder. Read the "🚨 Visual rules" section twice. Then:
>
> 1. Append `globals-additions.css` to `src/app/globals.css`.
> 2. Drop the 3 TSX files in `tsx/` into `src/components/`.
> 3. Rewrite `src/app/journey/JourneyClient.tsx` following the structure in `tsx/JourneyClient.example.tsx`. Remove the current upper stat cards and the node-graph map entirely — the new screen is just `<JourneyTopBar>` + a list of `<JourneyTopicBanner>` + `<JourneyStoryCard>` rows.
> 4. Wire the existing `globalJourneyNextStoryId` (or equivalent) to mark exactly one story per topic as `state: "next"`. Everything else maps via `deriveStoryState()`.
>
> Acceptance: the result should match `handoff-assets/journey-final.png`. The 3D bevels and the pulsing halo on the active card are NOT optional — they're what make the screen feel like the iPhone app.
