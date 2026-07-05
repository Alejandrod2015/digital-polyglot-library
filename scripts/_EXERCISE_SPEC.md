# Curated practice set spec (Spanish LATAM, A2 — English-speaking learners)

You author a curated practice set for ONE story. Read `scripts/_authoring.json`,
find the object whose `slug` matches the one you were given, and use ONLY its
`vocab` (each item has `word` lemma, `surface` inflected form, `type`, `def`
English definition, `ex` example sentence from the story).

## Coverage, mix & featured/pool (the template — mole/humo)
- FULL COVERAGE: author one exercise per vocab word. EVERY vocab word must be
  taught by exactly one exercise; no word reused across exercises. A 20-word
  story → ~17 exercises; a 21-word story → ~18. (`match_meaning` teaches 4 words
  in a single object.)
- MIX: exactly **1** `match_meaning`; **0–1** `listen_choose`; the rest split
  between `meaning_in_context` (most) and `fill_blank`. No fixed 6/3/1 ratio —
  let the vocab decide.
- FEATURED vs POOL: exactly **10** exercises are FEATURED (the post-story
  session); the rest are the POOL (surfaced when the user taps Practice). Mark a
  pool exercise with a top-level `"featured": false`. Featured exercises omit the
  key (featured is the default). Put the 10 most central words in the featured
  block, the rest in the pool.

Write the result as a JSON array to `scripts/_sets/<slug>.json`, featured objects
first then pool. Output the file only. The seed (`_seedAllSets.ts`) runs
`validateSet` and REFUSES to seed a set that breaks any rule below.

## Audio voice (RULE — journey practice voice, 2026-07-03)
All practice audio (isolated words AND example sentences) for Spanish-LATAM
journey stories is spoken by the journey's STANDARD PRACTICE VOICE: Jhenny
(`FXGrCtY3PEyfqczBAlqm`, "Jhenny - Warm, Fluid, Smooth", LATAM-neutral),
stored per story in
`JourneyStory.practiceVoiceId`. Rationale: per-country narrators proved too
dirty for short clips (chronic tail noise, flat questions) and burned ~30
renders per story; Jhenny passes the gates nearly first-try and the user
approved her by ear (stories 4-5).
The per-country rule still governs the NARRATION cast and the `listen_choose`
fragments (real story audio), so learners still hear the country's accent.
Exception: the 3 pilots (mole/humo/tacos) keep their approved andreti practice
audio (`practiceVoiceId` null → narrator voice).
Resolution is centralized in `src/lib/practiceVoice.ts`
(`practiceVoiceId ?? voiceId`); generators `_genPracticeClips.ts` /
`_genJourneyWords.ts` and `/api/story-practice` all go through it.

## Global rules
- English scaffold. Spanish ONLY for the target word and the Spanish sentence.
- NEVER use the em-dash character `—`. Use neutral Spanish (tú, not vos).
- English glosses are SHORT (2–5 words), parallel in register/length within one
  exercise. No glosses that give it away by being the only plausible one.
- Do not mention the story plot; an exercise must stand on its own.

## meaning_in_context  (tests: does the learner understand the word?)
```
{
  "type": "meaning_in_context",
  "word": "<vocab `word` lemma, shown to the learner>",
  "sentence": "<the vocab `ex` sentence, with the SURFACE form wrapped in [[ ]] exactly as it appears>",
  "payload": { "prompt": "Choose the meaning in context.",
               "answer": "<short English gloss>",
               "options": ["<answer>","<distractor>","<distractor>","<distractor>"],
               "audioClip": { "storySlug":"<slug>","storySource":"user",
                              "sentence":"<the sentence WITHOUT the [[ ]] markers>",
                              "targetWord":"<the surface form>","language":"spanish" } }
}
```
- SENTENCE LENGTH ≤ ~14 words, trimmed to the clause that holds the marked word.
  Do NOT use the full story sentence when it carries setting clauses (names,
  city/country, subordinate clauses) — it overflows the card and adds reading
  load. The word is shown above; the sentence only gives minimal context.
- The headline `word` MUST be the DICTIONARY form, never the inflected form:
  singular for nouns, masculine singular for adjectives/participles, infinitive
  for verbs. NORMALIZE even when the source vocab stores a plural/inflected form
  as `word` (e.g. vocab "ollas" → headline "olla"; "destinos" → "destino";
  "agachados" → "agachado"). When you singularize a noun headline, make the
  English glosses singular too ("a cooking pot", not "cooking pots"); adjective
  glosses in English are invariable. Exception: lexically-plural nouns
  ("ganas") stay plural.
- `[[ ]]` wraps the inflected SURFACE form present in the sentence (word
  "gritar", surface "grita" → "...un cobrador [[grita]] los destinos..."; headline
  "olla", sentence "...las [[ollas]]..."). If the surface is not literally in
  `ex`, wrap the form that is.
- options[0] === answer. The 3 distractors: same part of speech, plausible,
  near-miss but clearly distinguishable by meaning; never a synonym of the
  answer; A2-level English.
- The gloss describes the LEMMA shown in the headline, NOT the conjugated form in
  the sentence: a verb headline takes infinitive glosses ("to shout", never
  "shouts"/"shouting"/"shouted"); all 4 options in the same form ("to X").

## fill_blank  (Context — tests word comprehension through a meaning-determined gap)
```
{
  "type": "fill_blank",
  "word": "<the SURFACE form that fills the blank>",
  "sentence": "<a SHORT self-contained Spanish sentence, target replaced by _____ (5 underscores)>",
  "payload": { "prompt": "Complete the sentence.",
               "answer": "<surface>",
               "options": ["<answer>","<distractor>","<distractor>","<distractor>"],
               "translation": "<the cloze sentence in English, blank kept as _____>",
               "optionTranslations": ["<gloss of option 1>","<2>","<3>","<4>"],
               "audioClip": { "storySlug":"<slug>","storySource":"user",
                              "sentence":"<the cloze sentence with the answer filled in>",
                              "targetWord":"<answer>","language":"spanish" } }
}
```
- `translation` + `optionTranslations` (same order as `options`) are MANDATORY.
  Without them the Context card has no English scaffold. `translation` keeps the
  blank as `_____`; the audio is TTS of the FILLED cloze sentence (not a story
  line), so it goes in `audioClip.sentence` fully spelled out.
- HARD LENGTH CAP: the sentence is ≤ 12 words (count the blank as one). Short and
  cotidiano. If you can't make the cue fit in ≤12 words, cut adjectives/clauses or
  pick a different word. Long cloze sentences are rejected.
- HARD RULE — solvable by MEANING ALONE, never by story recall. A learner who
  never read the story must pick the right word from the sentence's context. The
  sentence carries a semantic cue (cause/effect, object, descriptor) that ONLY
  the target word satisfies.
- DO NOT copy the story `ex` sentence when it depends on a plot event. Write a
  FRESH, self-contained micro-sentence that reveals the meaning.
  - GOOD: word "quemar" → "Dejaste la olla en el fuego demasiado tiempo y _____ la sopa."  (only "burned" fits) distractors: enfriaste / serviste / probaste.
  - BAD: "La semana pasada _____ el agua."  (needs story recall; every option fits grammatically)
- UNIQUE answer: exactly one option completes the sentence grammatically AND
  semantically. Distractors: same POS Spanish words, plausible in the slot but
  ruled out by the cue. Match the answer's conjugation/agreement so the grammar
  alone never reveals it.
- VARY the sentence structure across your 3 fill_blanks (no shared template).
- Choose words that CAN be meaning-disambiguated (concrete verbs / nouns /
  adjectives). Skip function words that cannot.

## match_meaning  (4 vocab words ↔ their English meanings)
```
{
  "type": "match_meaning",
  "word": "<w1>,<w2>,<w3>,<w4>",
  "sentence": "",
  "payload": { "prompt": "Match the words to their meanings.",
               "pairs": [
                 {"word":"<w1>","answer":"<gloss1>","options":["<gloss1>","<gloss2>","<gloss3>","<gloss4>"]},
                 {"word":"<w2>","answer":"<gloss2>","options":["<gloss1>","<gloss2>","<gloss3>","<gloss4>"]},
                 {"word":"<w3>","answer":"<gloss3>","options":["<gloss1>","<gloss2>","<gloss3>","<gloss4>"]},
                 {"word":"<w4>","answer":"<gloss4>","options":["<gloss1>","<gloss2>","<gloss3>","<gloss4>"]}
               ],
               "audioClip": null }
}
```
- Pick 4 vocab words easy to gloss concisely (prefer concrete nouns). Every
  pair's `options` = the same 4 glosses in the same order. Display order /
  position is handled downstream; do not worry about it. No `audioClip` (word
  audio is resolved at runtime via `word-tts`).

## listen_choose  (optional — "Which word did you hear?" from a REAL story line)
```
{
  "type": "listen_choose", "featured": false,
  "word": "<vocab lemma>",
  "sentence": "<the EXACT text of one audioFragment line from the story>",
  "payload": { "prompt": "Which word did you hear?",
               "answer": "<the conjugated surface form as heard>",
               "options": ["<answer>","<distractor>","<distractor>","<distractor>"],
               "optionTranslations": ["<gloss of option 1>","<2>","<3>","<4>"],
               "language": "spanish",
               "audioClip": { "storySlug":"<slug>","storySource":"user",
                              "sentence":"<the SAME exact fragment text>",
                              "targetWord":"<answer>","language":"spanish",
                              "voiceId":"<the speaker's voiceId from audioFragments>" } }
}
```
- The audio is the REAL story fragment (character voice), so `sentence` MUST be
  the exact fragment text and `voiceId` the speaker's — no audio is generated for
  this type. Distractors are other same-form conjugations (all "was X-ing", all
  "we X", …).

Validity self-check before writing: full vocab coverage, one exercise per word,
none reused; exactly 1 match, ≤1 listen; exactly 10 featured; every meaning
sentence has a `[[ ]]` and ≤14 words; every fill ≤12 words with `translation` +
`optionTranslations`; meaning/fill carry an `audioClip` with `sentence` +
`targetWord`; listen carries `voiceId`; no em-dashes; options[0]===answer.
Then run `npx tsx scripts/_validateSets.ts --only=<slug>` — it must print ✓.
