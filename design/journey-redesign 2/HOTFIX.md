# Journey HOTFIX — same Tailwind JIT bug as the home redesign

## Why it looks wrong now

Two issues compounded:

### 1. Arbitrary Tailwind values didn't compile

Same problem you already saw on the home redesign: when arbitrary classes like `max-w-[440px]`, `rounded-[22px]`, `p-3`, `gap-4` live inside an imported component, Tailwind v4's JIT silently drops them. The story cards rendered without their max-width → they sprawled to fill the entire content column. The 3D bevel on the topic banner is also driven by inline classes and got partially dropped.

**Fix:** I bundled all the geometry into the existing `.dp-journey-card` rescue class plus a new `.dp-journey-banner` rescue class. Same pattern as `.dp-aspect-4-3` / `.dp-hero-grid`.

### 2. No story is marked `state: "next"` or `state: "done"`

Looking at the localhost screenshot, every card has an empty-circle check (the `available` state). Nothing is highlighted as the active "next" story, and no completed stories show the cyan check.

**Why:** the implementation isn't deriving the state from your progress data — it's defaulting everything to `available`.

**Fix:** wire up the `deriveStoryState()` helper (already in `tsx/JourneyClient.example.tsx`) using your existing progress signals. **Exactly one story per topic should be `state: "next"`** — the one your existing `globalJourneyNextStoryId` (or equivalent) points at.

## What to apply

### Step 1 — Replace the journey block in `globals.css`

Open `src/app/globals.css`, find the existing `.dp-journey-card { … }` block (the one I shipped in v1) and **replace** it with the contents of `HOTFIX-globals.css` in this folder. Three things change:

- `.dp-journey-page` (new) — caps the journey content at 760px and centers it. Apply this class to the outer container in `JourneyClient.tsx`.
- `.dp-journey-card` (extended) — now carries the **full** geometry (display, gap, padding, border-radius, **max-width: 440px**), not just the box-shadow.
- `.dp-journey-banner` (new) — same rescue treatment for the topic banner. Apply this class to the `<button>` in `JourneyTopicBanner.tsx`.

### Step 2 — Add `.dp-journey-page` to the journey container

```tsx
// src/app/journey/JourneyClient.tsx
return (
  <div className="dp-journey-page px-10 py-7 pb-20">  {/* ← add dp-journey-page */}
    <JourneyTopBar ... />
    ...
  </div>
);
```

### Step 3 — Apply `.dp-journey-banner` to the topic banner button

```tsx
// src/components/JourneyTopicBanner.tsx
<button
  type="button"
  disabled={locked}
  onClick={onTap}
  style={{ backgroundColor: bg }}
  className="dp-journey-banner"   {/* ← replace the long Tailwind class string with this single class */}
>
  …
</button>
```

The card already has `.dp-journey-card` — no change needed there.

### Step 4 — Wire `deriveStoryState()` so stories actually advance

In `JourneyClient.tsx`, replace the line where you build each story's `state` with a real derivation. The helper is in the example file:

```ts
function deriveStoryState({
  isLevelUnlocked,
  isStoryComplete,
  isNextRecommended,
  isUnlocked,
}: {
  isLevelUnlocked: boolean;
  isStoryComplete: boolean;
  isNextRecommended: boolean;
  isUnlocked: boolean;
}): StoryNodeState {
  if (!isLevelUnlocked || !isUnlocked) return "locked";
  if (isStoryComplete) return "done";
  if (isNextRecommended) return "next";
  return "available";
}
```

In the topic-flattening loop, replace this:

```ts
state: !level.unlocked ? "locked" : (s.state ?? "available"),
```

with:

```ts
state: deriveStoryState({
  isLevelUnlocked: level.unlocked,
  isUnlocked: !s.locked,                                // your story-level lock signal
  isStoryComplete: completedStoryIds.has(s.slug),       // your progress data
  isNextRecommended: s.slug === globalJourneyNextStoryId, // exactly one true per active topic
}),
```

Both `completedStoryIds` and `globalJourneyNextStoryId` already exist in `JourneyClient.tsx` — that's where the old node-graph picked the "you are here" marker from.

## Acceptance check

After applying the above, you should see:

- [ ] Story cards sized at ~440px wide max, sitting in a clearly zigzagged pattern
- [ ] Topic banners and story cards visibly look like pressable 3D buttons (clear 4–5px dark stack below)
- [ ] Pressing a card or banner shrinks the stack and depresses by 3px
- [ ] At least one story per active topic glows with a pulsing topic-colored halo (the "next" card)
- [ ] Completed stories show a cyan-filled check; locked levels stay grey

The screenshot in `handoff-assets/journey-final.png` is what it should look like — compare side-by-side.
