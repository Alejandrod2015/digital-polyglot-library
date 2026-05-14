# Sound assets — attribution

Current practice feedback sounds are sourced from the
[Mixkit free sound library](https://mixkit.co/free-sound-effects/). The
Mixkit License allows free commercial use, no attribution required; the
table below is kept for our own provenance.

## Files

| File                    | Source                                                       | License        | SFX ID | Notes                                  |
| ----------------------- | ------------------------------------------------------------ | -------------- | ------ | -------------------------------------- |
| practice-correct.mp3    | Mixkit — Win category                                        | Mixkit License | 253    | Short success bell (~1.4 s), per-answer |
| practice-wrong.mp3      | Mixkit — Wrong-answer / Negative                             | Mixkit License | 2569   | Brief neutral negative (~1.25 s)        |
| practice-perfect.mp3    | Mixkit — Win category                                        | Mixkit License | 600    | Achievement bell (~2.4 s), combos only  |

## Source URLs

The Mixkit assets above were downloaded from:

- https://assets.mixkit.co/active_storage/sfx/253/253-preview.mp3
- https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3
- https://assets.mixkit.co/active_storage/sfx/600/600-preview.mp3

## License terms (Mixkit)

> The Mixkit License grants you a worldwide, non-exclusive, perpetual,
> royalty-free right to use the Sound Effects in your projects (whether
> commercial or non-commercial). Attribution is not required.

Full text: https://mixkit.co/license/

## Swap pool

If you want to try alternatives without re-curating from scratch, the
discarded-but-kept candidates live in
`samples/practice-sound-candidates/` at the repo root. To swap, copy
the candidate over the matching `practice-*.mp3` here, re-encode to
base64, and update `apps/mobile/src/lib/practiceSoundUris.ts`.

## Alternative sources (CC0)

- https://kenney.nl/assets/ui-audio — game-oriented UI sounds, CC0 1.0
- https://freesound.org — filter by License: CC0 1.0 before downloading
- https://pixabay.com/sound-effects/ — royalty-free, no attribution

Keep new files at 44.1 kHz / mono and ≤120 KB so the embedded base64
in `practiceSoundUris.ts` doesn't bloat the bundle.
