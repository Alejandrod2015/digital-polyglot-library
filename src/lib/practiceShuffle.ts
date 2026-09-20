/**
 * Deterministic shuffles for practice options, shared by the curated sets
 * (`persistedPracticeExercises.ts`) and the level test bank. Pure: no
 * database, so scripts and tests can import it without `server-only`.
 */
// Deterministic option shuffle. Curated/persisted sets often store the
// correct answer as options[0] (it's the natural way to author them), and the
// reader renders options in array order; so without this the right answer
// always lands in the same (top-left) slot across every exercise, which is an
// obvious giveaway. Seeding the shuffle on the exercise id keeps the order
// STABLE across reloads (no jarring reshuffle) while varying it per exercise,
// and makes the fix immune to how any future seed is authored. The answer is
// matched by value downstream, never by index, so reordering is safe.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleOptionsDeterministic(options: string[], seedStr: string): string[] {
  if (options.length < 2) return options;
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = mulberry32(h);
  const out = [...options];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Deterministic permutation of [0..n-1] for the given seed, so options AND any
// parallel array (e.g. optionTranslations) can be shuffled together; otherwise
// the English gloss ends up under the wrong word.
export function shuffleIndices(n: number, seedStr: string): number[] {
  return shuffleOptionsDeterministic(Array.from({ length: n }, (_, i) => String(i)), seedStr).map(Number);
}

// Match meanings render index-aligned with the words column, so if the meaning
// at row i is the answer for the word at row i the pairing is trivially given
// away (just tap straight across). Derange the meanings column: deterministic
// shuffle, then rotate until NO row's meaning equals that row's answer. This
// guarantees the spatial alignment is broken while staying stable across
// reloads and varied per exercise.
export function derangeMeanings(answersInRowOrder: string[], seedStr: string): string[] {
  const n = answersInRowOrder.length;
  if (n < 2) return [...answersInRowOrder];
  let order = shuffleOptionsDeterministic(answersInRowOrder, `${seedStr}:m`);
  let guard = 0;
  while (order.some((m, i) => m === answersInRowOrder[i]) && guard < n) {
    order = [...order.slice(1), order[0]];
    guard++;
  }
  return order;
}
