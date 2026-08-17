# Sound assets: attribution

All UI audio for the app and the web lives HERE, in `apps/mobile/assets/sounds/`
(the web serves byte-identical copies from `public/sounds/`). There is no
`assets/sfx/` any more; see "Why one folder" below.

Sourced from the [Mixkit free sound library](https://mixkit.co/free-sound-effects/).
The Mixkit License allows free commercial use with no attribution required; this
table is kept for our own provenance.

## The five practice sounds

Assignment fixed by the user by ear on 2026-08-07, listening to all nine sounds
that existed at the time. **Do not reassign any of them without asking him.**

| File                     | Length | Plays when                                        | SFX ID |
| ------------------------ | ------ | ------------------------------------------------- | ------ |
| `practice-correct.mp3`   | 1.40 s | every correct answer                              | 253    |
| `practice-wrong.mp3`     | 1.25 s | every wrong answer                                | 2569   |
| `practice-combo.mp3`     | 2.40 s | 2+ correct in a row (replaces `correct`, never on top) | 600 |
| `practice-ring-fill.mp3` | 1.40 s | session end, under the result ring, only if ≥50% right | 2633 |
| `practice-perfect.mp3`   | 4.13 s | session end with a perfect score                  | n/a    |

Plus `journey-milestone-chime.mp3` (0.24 s), the only non-practice sound: it
fires on a journey milestone.

Two invariants worth keeping:

- **One sound per moment.** The combo *replaces* the correct tone instead of
  layering on it, and the perfect chime and the ring fill are mutually
  exclusive. Two overlapping one-shots turn into noise, and on iOS the second
  one tends to swallow the first.
- **The ring fill matches the ring.** `PracticeResultRing` fills in 1200 ms and
  the asset runs 1400 ms. That is why it exists and why it is named that way.

## Why one folder

Until 2026-08-07 these files lived in two folders, `assets/sfx/` and
`assets/sounds/`, holding near-identically named files with *different*
contents. That cost a full night of debugging: the app loaded
`sfx/practice-perfect.mp3` (2.4 s) as its victory sound while the web used
`sounds/practice-perfect.mp3` (4.13 s), and the user reported four times that
the sound he knew had stopped playing. Three fixes went into audio sessions and
preloading; all correct, all irrelevant, because the file itself was the wrong
one.

So: **one folder, and names that say what the sound is FOR, not where it came
from.** `practice-combo.mp3` is the old `sfx/practice-perfect.mp3`;
`practice-ring-fill.mp3` is the old `practice-ring-fill-good.mp3` (the `-good`
suffix meant nothing once `-bad` was deleted).

Deleted the same day, all unused: `practice-ring-fill-bad.mp3`, the `.wav`
copies under `public/sounds/`, and the two base64 modules
`practiceSoundUris.ts` / `practiceRingSoundUris.ts` (438 KB of embedded audio
nothing imported, and the frozen-in-May source of the bug above).

## Source URLs

- https://assets.mixkit.co/active_storage/sfx/253/253-preview.mp3
- https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3
- https://assets.mixkit.co/active_storage/sfx/600/600-preview.mp3
- https://assets.mixkit.co/active_storage/sfx/2633/2633-preview.mp3

## License terms (Mixkit)

> The Mixkit License grants you a worldwide, non-exclusive, perpetual,
> royalty-free right to use the Sound Effects in your projects (whether
> commercial or non-commercial). Attribution is not required.

Full text: https://mixkit.co/license/

## Swap pool

Discarded-but-kept candidates live in `samples/practice-sound-candidates/` at
the repo root. To swap, copy the candidate over the matching file here; that
is the whole procedure now that nothing is duplicated or base64-encoded.

Keep new files at 44.1 kHz / mono and ≤140 KB.
