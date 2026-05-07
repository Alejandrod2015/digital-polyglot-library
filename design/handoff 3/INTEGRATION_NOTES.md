# PR 2 — Real-data integration (separate concern)

Once PR 1 ships and the visual is locked in, this is the spec for wiring real
stats. Do **not** block PR 1 on this — the visual works in dev with mock data
already.

---

## Goal

Populate `publicMetadata.targetLanguagesStats: LanguageStats[]` so the existing
`LanguageSwitcher.tsx` reads real numbers via `readStatsByName()`.

```ts
type LanguageStats = {
  name: string;       // matches an entry in publicMetadata.targetLanguages
  streak: number;     // consecutive days the user practiced THIS language
  xpTotal: number;    // total XP accumulated in THIS language
  progress: number;   // 0–100 — % of current journey (level+topic) completed
};
```

Same order as `targetLanguages` is not required — `readStatsByName()` keys by
name.

---

## Where to compute each field

### `xpTotal`

Aggregate from `UserMetric` (table already exists in
`prisma/schema.prisma`). Filter by `eventType IN ('audio_complete', 'lesson_complete')`
and group by the story's language. The story → language join is via
`JourneyStory.language` (or whatever the existing journey query uses; look at
`src/app/journey/page.tsx` for the canonical lookup).

XP per event: reuse whatever rule the codebase already uses for the streak
counter or progress bar. If none exists, define one (e.g. 50 XP per
`audio_complete`) — add a constant in `src/lib/xp.ts`.

### `progress`

For each language in `targetLanguages`:
1. Find the user's active level + topic for that language.
2. Count completed stories in that level+topic.
3. Divide by total stories in that level+topic. Clamp to 0–100.

The logic for the active language already exists in
`src/app/journey/page.tsx`. Extract it into a helper
`getJourneyProgress(userId, language): Promise<number>` and call it once per
language.

### `streak`

This is the only field that needs **new schema**. Options:

**Option A — New table** (recommended)
```prisma
model UserLanguageStreak {
  id             String   @id @default(cuid())
  userId         String
  language       String
  currentStreak  Int      @default(0)
  longestStreak  Int      @default(0)
  lastActiveDate DateTime
  updatedAt      DateTime @updatedAt

  @@unique([userId, language])
  @@index([userId])
}
```

Update on every `audio_complete` event:
- If `lastActiveDate` was yesterday (UTC day diff = 1) → `currentStreak++`.
- If today (UTC day diff = 0) → no change.
- If older → `currentStreak = 1`.

**Option B — Skip the per-language streak for v1**
Keep showing the existing global streak on the active row only; render `0` for
inactive rows. Mark a TODO. Visually still works because the active row is the
only one users care about for streak in early sessions.

---

## Where to write `targetLanguagesStats`

Extend `src/app/api/user/preferences/route.ts` (already handles
`targetLanguages` writes — see lines 158, 297, 311 in
`src/app/settings/page.tsx` for how clients call it).

Add a separate internal helper that writes stats independently:

```ts
// src/lib/userLanguageStats.ts
export async function refreshTargetLanguagesStats(userId: string) {
  const targetLanguages = await getTargetLanguages(userId);
  const stats: LanguageStats[] = await Promise.all(
    targetLanguages.map(async (name) => ({
      name,
      streak:   await getStreak(userId, name),
      xpTotal:  await getXpTotal(userId, name),
      progress: await getJourneyProgress(userId, name),
    }))
  );

  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: { targetLanguagesStats: stats },
  });
}
```

Call `refreshTargetLanguagesStats()` from:
- The lesson-completion handler (already exists somewhere — grep for `audio_complete`).
- The `POST /api/user/preferences` handler when `targetLanguages` changes.
- A nightly cron if you want freshness without depending on user activity.

---

## Removing the mock

In `LanguageSwitcher.tsx`, delete the two blocks marked `// MOCK DATA`:

1. The top-level `MOCK_STATS` constant.
2. The `if (statsByName.size === 0) { … }` fallback.

That's the entire diff for the client side once PR 2 ships.

---

## Verification

After deploying PR 2:

- [ ] `console.log(user.publicMetadata.targetLanguagesStats)` in dev shows the
      array with the right values for the logged-in user.
- [ ] Sheet shows real numbers, not mocks.
- [ ] Numbers update after completing a lesson and reloading.
- [ ] Adding a new language via `/settings` populates a `0/0/0` row in stats
      (don't crash if a language is in `targetLanguages` but missing from
      stats — `readStatsByName()` already handles that).
