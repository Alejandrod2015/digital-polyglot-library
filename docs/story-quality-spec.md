# JourneyStory quality spec

Reference for what every JourneyStory should look like across all eight elements (title, synopsis, body, vocab, cover, audio, timings, render). Rules are derived from the `/generate-story` skill plus iteration in production. Last refresh: 2026-05-06.

If you change a rule here, also update the matching feedback file in `~/.claude/projects/-Users-alejandrodelcarpio-digital-polyglot-library/memory/` so the Claude assistant follows the same rules across sessions.

---

## 1. Title

- 2 to 6 words in the target language.
- Exactly **one** concrete cultural anchor: real neighborhood, specific dish, named venue, or traditional object. Not generic nouns ("comida", "día", "viaje", "Essen").
- Reads as a name, not a description.
- Unique within the journey: no more than 50% token overlap with any existing title.
- Banned patterns: "A/An [generic] in [city]", three or more stacked anchors, genre labels (mystery, secret, danger, escape), pronouns, "A Day in...", "The Story of X and Y".
- Good examples: "Sauerbraten am Winterfeldtmarkt", "Apfelkuchen in Wedding", "Croque-monsieur à Belleville".

## 2. Synopsis

- 45 to 90 words.
- The first sentence must describe the scene with common nouns (place, props, action), not just proper nouns. The cover prompt builder strips proper nouns from the first sentence; if you write "Paul besucht Oma Hilde in Wedding" the prompt has nothing to grip.
- Sober concrete style. No marketing tone, no sentimental metaphors, no mention of "the reader" or "language learners".
- Conflict and emotional shape distinct from existing synopses in the journey. Sharing a setting is fine; sharing the arc is not.
- Plausible behavior in the cultural setting. Don't fabricate things a real venue does not host.

## 3. Body

### Format

- Plain text. No HTML for multi-voice dialogue stories (the parser reads `Speaker: line` blocks).
- Sections separated by blank lines (`\n\n`). Dialogue lines within a block separated by single newlines (`\n`).
- One narrator block at the start, optional narrator transitions between dialogue acts, optional short narrator block at the end.

### Narrator

- Opens with a full sentence, e.g. "Es ist Samstagnachmittag in Berlin." NOT a verbless fragment ("Samstagnachmittag in Berlin.") — that reads as a stage label, not narration.
- Cadence varies: mix short and longer sentences. Five short sentences in a row reads like a list.
- One sensory detail (smell, light, sound, temperature) anchors atmosphere. Not three; one is enough.
- Action moves something forward. Avoid pure description.
- Body of work-published examples in the journey: opening narrators of "Beim Bäcker am Hackeschen Markt", "Tomaten vom Wochenmarkt", "Eiscafé am Sommerabend".

### Dialogue

- Real conversational rhythm: reactions, interruptions, brief silences. Not pure question→answer drill.
- Each character has a voice: maternal, curious, teasing, deadpan, etc.
- Callbacks within the story (a phrase reused with a twist late) build cohesion.
- Lexical level matches the target CEFR. One level above is normal exposure (i+1); two levels above is a real problem to fix before saving.

### Length

- Target 220-280 words. Hard maximum 320. Hard minimum 180.
- Same target across all CEFR levels. What changes between levels is lexical and syntactic density, not volume.
- If you go over 320, trim before saving (cut a sub-beat, tighten a dialogue exchange, remove a redundant transition). Going over is allowed only when explicitly authorized by the user for that specific story.

### Register variety

- Each story should feel emotionally different from its journey neighbors. Avoid making every story a "friendly stranger helps protagonist, everyone leaves happy" arc.
- Possible alternative registers: contemplative monologue, quiet bittersweet realization, mild misunderstanding played politely, comedic tension, an open-ended decision, a small disappointment handled gracefully.

## 4. Vocab

- 18 to 22 items per story.
- Each item:
  - `word`: dictionary lemma form
  - `surface` (optional): exact form as used in the text, only if different from the lemma
  - `definition`: pedagogical English explanation, 17 to 25 words. Starts with "Used to...", "Describes...", "Refers to...", "Said when...". NOT a one-word gloss; NOT "X, ..." with a comma after a single word
  - `type`: one of `verb` | `noun` | `adjective` | `adverb` | `expression` | `slang`
- No transparent cognates a learner reads at sight (importante, normal, social, problema, idea, momento).
- Multi-word entries only for genuinely lexicalized expressions ("auf einmal", "schon mal"). Not arbitrary descriptive fragments.
- The `type` field drives the karaoke pill color, so accuracy matters: an adjective tagged as `verb` shows in the wrong color.

## 5. Cover image

- Generate via Flux directly. **Bypass `buildCoverPrompt`** in `src/lib/coverGenerator.ts`: it takes only the first sentence of the synopsis and strips proper nouns, frequently leaving the prompt empty.
- Write a custom prompt that explicitly states:
  - Number of characters (two max in mid-shot)
  - Their ages and relationship (older woman + young grandchild, two strangers on a bench, etc.)
  - Concrete action they are doing
  - Setting and one or two key props
  - Time of day / light condition
  - Style block: "Hand-drawn cartoon vector illustration in the style of contemporary editorial language-learning book covers (Duolingo, Babbel, Headspace, Notion). Clean rounded shapes, gentle line work, expressive but stylized faces."
  - Palette block: cool / warm / earthy variant from `COVER_VARIANT_PALETTE`
  - Final block: "Wide horizontal 16:9 landscape frame. No text, no letters, no captions, no logos, no borders."
- Provider preference: Flux. Fallback Gemini Imagen, but it rejects prompts that mention the age of minors. If the cover involves a child, use Flux.

## 6. Audio

- Multi-voice via ElevenLabs `eleven_multilingual_v2` for German Conversacional. Single-voice via the same lib for narration-only stories.
- Voice catalog in `src/lib/elevenlabs.ts` → `GERMAN_DIALOGUE_VOICES`:

| Slot | ID | Notes |
| --- | --- | --- |
| `moritz` | `Ww7Sq9tx9CCOiNOwWgsx` | M middle-aged baritone, native DE — narrator default |
| `enniah` | `WHaUUVTDq47Yqc9aDbkH` | F middle-aged warm — primary female |
| `gesaTess` | `cllvQaMvj0ZKxH88HGEn` | F middle-aged calm host — calmer baseline than Enniah |
| `luca` | `mmAbrxFQ9xjByXyBpqrK` | M young dynamic — younger male (replaced banned Sebastian) |
| `eleonore` | `8SdTD5IMgFKT1jp7JbPC` | F mature — "Frau" / older female roles |

- **Banned voices, do NOT add back to the catalog**:
  - **Sebastian** `qVRpsZJDV29g1CIPzssm` — uptalk, every line ends like a question
  - **Thorsten** (Piper/Coqui all variants) — monotone "deprimente"
  - **Bark Speaker 3** — muffled / monotone
  - **Simon Sunday** (ElevenLabs DE young male) — monotone "deprimente"
  - **Liam** and **Sarah** (ElevenLabs premade EN) — US accent leaks through `eleven_multilingual_v2` even on German text
- Ambient layer (cafeteria, market, etc.) optional and only for outdoor or public scenes; skip in intimate domestic ones.
- **Cost rule**: never regenerate audio without an explicit instruction from the user. Trigger words: "regenera audio", "lanza audio", "manda audio", or English equivalents. Cover image and word timings can be regenerated freely; audio cannot.

## 7. Word timings (karaoke alignment)

- Generated via Modal + aeneas after the audio is uploaded. Endpoint: `mmAbrxFQ9xjByXyBpqrK` is in the `align` Modal function.
- The alignment is run on `title + body` so the body words map to their actual audio time (the title narration occupies the first ~2 seconds). Title-prefix tokens are stripped and only body tokens persisted, with character offsets re-based to the body-only `storyPlainText`.
- Stored in the `audioWordTimings` JSONB column on `JourneyStory`. Existing rows without it fall through to the legacy reader.
- Marginal cost: zero. A few seconds of Modal CPU per story.

## 8. Render (mobile + web karaoke)

### Vocab pill colors by grammatical type

- Verb → coral
- Noun → sky
- Adjective → emerald
- Adverb → purple
- Expression → pink
- Other / unknown → slate

### Active highlight (audio cursor)

- Color `#f8c15c` (warm amber).
- Applied only to non-vocab words. Vocab pills keep their type color throughout playback so the grammar signal stays stable.
- Format: two-layer inline `<View>` (outer 40 px paddingV asymmetric 10/6 for baseline alignment, inner pill ~24 px tall with rounded corners). Bold inner Text for vocab pills, regular weight for plain text. iOS-specific tuning: see `apps/mobile/src/mobile/ReaderScreen.tsx` `renderKaraokeParagraph`.

### Tap behavior

- Autoscroll pauses 1.8 seconds after every touch on the ScrollView, so vocab pills are reliably tappable while the audio plays.
- Tap on a vocab pill opens the popup, which shows the type label as a small uppercase badge tinted with the same hue as the inline pill.

---

## Reference example: Bank im Tiergarten

A story written specifically to illustrate the spec, not yet generated.

### Title

`Bank im Tiergarten`

Three words, neighborhood + concrete object, distinct from existing titles.

### Synopsis (62 words)

> Stefan sitzt an einem Samstagnachmittag auf einer Bank im Tiergarten und liest die Zeitung. Er ist erst seit zwei Wochen in Berlin und vermisst Hamburg manchmal. Eine ältere Frau setzt sich neben ihn. Sie kennt diese Bank seit über sechzig Jahren. Aus einer kurzen Bemerkung über das Wetter wird ein leises Gespräch über die Stadt, die früher anders war.

### Body (~265 words)

```
Es ist Samstagnachmittag im Tiergarten. Die Sonne scheint hell zwischen den Bäumen, und auf dem Weg gehen Familien mit Kindern und Hunden spazieren. Stefan sitzt auf einer alten Holzbank und liest die Wochenendzeitung. Er ist neu in Berlin, erst seit zwei Wochen. Eine ältere Frau setzt sich langsam neben ihn. Sie heißt Frau Albrecht.

Frau Albrecht: Schöner Tag heute, oder?
Stefan: Ja, sehr schön. Wirklich warm für Mai.
Frau Albrecht: Sind Sie aus Berlin?
Stefan: Nein, ich komme aus Hamburg. Ich wohne erst seit zwei Wochen hier.
Frau Albrecht: Ach, ein Hamburger. Willkommen, dann.
Stefan: Danke. Berlin ist anders, oder?
Frau Albrecht: Sehr anders. Aber man gewöhnt sich.

Stefan: Und Sie? Wie lange schon hier?
Frau Albrecht: Lange. Ich kam 1962 aus Dresden.
Stefan: 1962? Das ist über sechzig Jahre!
Frau Albrecht: Ja, ja. Berlin war damals eine andere Stadt.
Stefan: Wie war es?
Frau Albrecht: Klein. Grau. Aber auch lebendig. Wir hatten weniger, und wir waren freundlicher.
Stefan: Vermissen Sie das?
Frau Albrecht: Manchmal. Nicht das Grau. Die Freundlichkeit, ja.

Stefan: Ich finde die Leute hier eigentlich nett.
Frau Albrecht: Wirklich? Sie sind Optimist.
Stefan: Vielleicht. Ich gebe der Stadt eine Chance.
Frau Albrecht: Das ist klug.

Sie sitzen einen Moment ruhig. Ein kleiner Hund rennt am Weg vorbei.

Frau Albrecht: Ich muss los. Ich treffe meine Tochter.
Stefan: Schönen Nachmittag, Frau Albrecht.
Frau Albrecht: Ihnen auch, Hamburger.

Frau Albrecht steht auf und geht langsam weg. Stefan sieht ihr kurz nach. Dann macht er die Zeitung wieder auf.
```

Why this body works as a reference:

- Narrator opens with a full sentence with a verb ("Es ist Samstagnachmittag im Tiergarten."), not a verbless fragment.
- Sentence cadence varies: short ("Sie heißt Frau Albrecht."), long (the second sentence with two clauses), medium.
- One sensory detail (sun between the trees, families walking with children and dogs) without overdescribing.
- Dialogue has a real opening beat (small talk about the weather), a moment of recognition ("ein Hamburger"), then a deeper memory exchange about Berlin in 1962, and a quiet closing ("Ich muss los. Ich treffe meine Tochter."). Each character has a voice (Frau Albrecht concise and direct, Stefan more explicative).
- A callback at the end ("Ihnen auch, Hamburger") that ties back to the recognition moment in the second exchange.
- Register distinct from "Apfelkuchen in Wedding" (kitchen, family) and "Sonntag in Prenzlauer Berg" (home, breakfast). This is a brief encounter between strangers with an intergenerational tinge, and the close is open-ended (Stefan alone again with his paper) rather than the warm collective close those two have.
- Words above A1 used in the body are still A2 or low B1 at most: spazieren, gewöhnen, lebendig, vermissen, Optimist, Chance, klug. None two levels above A1.

### Vocab list (20 items)

| word | surface | type | definition |
| --- | --- | --- | --- |
| spazieren | spazieren | verb | Used to talk about taking a relaxed walk for pleasure, often in a park or through a city neighborhood. |
| Bank | | noun | Refers to a bench, a long seat usually made of wood or metal placed in parks, streets, or public squares. |
| Zeitung | | noun | Refers to a newspaper, the printed daily or weekly publication people read for news, opinion, or weekend leisure. |
| neu | | adjective | Describes something that did not exist or was not present before, often used about people just arrived in a place. |
| erst | | adverb | Used to emphasize that something has only just started or that little time has passed since it began. |
| willkommen | | adjective | Used to greet someone arriving at a place; common at borders, doors, or welcoming a new resident or guest. |
| anders | | adjective | Describes something that differs from what was known or expected; common in comparisons between cities or experiences. |
| gewöhnen | gewöhnt | verb | Used reflexively (sich gewöhnen) to describe getting used to a new place, habit, or situation over time. |
| damals | | adverb | Refers to a moment far in the past; used when contrasting how things were then with how they are now. |
| Stadt | | noun | Refers to a city, a place where many people live and work, with streets, neighborhoods, shops, and public spaces. |
| lebendig | | adjective | Describes a place full of energy, activity, and life, often with people, music, conversations, or street culture. |
| weniger | | adverb | Means less; used to compare smaller quantities, intensity, or frequency than another thing or another time. |
| freundlich | | adjective | Describes someone or something kind, warm, and pleasant in attitude, often used about strangers or service interactions. |
| vermissen | Vermissen | verb | Used to talk about feeling the absence of someone or something you love, often a person, place, or past time. |
| manchmal | | adverb | Means sometimes; describes something that happens occasionally rather than always, never, or frequently. |
| klug | | adjective | Describes someone or something thoughtful, wise, or shrewd; positive judgment about a decision or attitude. |
| ruhig | | adjective | Describes a moment, person, or place that is calm and quiet, without noise, hurry, or strong emotion. |
| treffen | | verb | Used when meeting someone by appointment or chance; very common verb for social plans with friends or family. |
| Tochter | | noun | Refers to a daughter, a female child in relation to her parents; common word in family conversations. |
| Hamburger | | noun | Refers to a person from Hamburg; can sound affectionate or teasing depending on context, as used here at the close. |

### Cover prompt (custom, bypassing `buildCoverPrompt`)

> Editorial book cover illustration of a young man in his early thirties and an older woman in her late seventies sitting side by side on a wooden park bench in a sunny Berlin city park. The man wears a casual jacket and holds a folded newspaper on his lap. The woman wears a soft autumn coat, her hands resting calmly. They are looking at each other in a gentle conversation. Tall trees, a paved path, and other walkers visible in the soft background. Warm late-afternoon light filters through the leaves. Two characters only, mid-shot framing, both faces clearly visible, kind affectionate atmosphere across a generational distance.
>
> Hand-drawn cartoon vector illustration in the style of contemporary editorial language-learning book covers. Clean rounded shapes, gentle line work, expressive but stylized faces. The look used by Duolingo, Notion, Headspace and Babbel landing pages.
>
> Color tonality: warm harmony anchored on peach, terracotta and sage, with vivid confident saturation, not pastel and not washed-out.
>
> Wide horizontal 16:9 landscape frame. No text, no letters, no captions, no logos, no borders.

### Audio voice map

```ts
voiceMap = {
  narrator: GERMAN_DIALOGUE_VOICES.moritz,         // baritone, native DE
  Stefan: GERMAN_DIALOGUE_VOICES.luca,             // young male, dynamic
  "Frau Albrecht": GERMAN_DIALOGUE_VOICES.eleonore, // mature female, "Frau" role
};
ambientPath = null; // park is outdoor but quiet; no ambient catalog match for Tiergarten
```

### Estimated audio length

- ~265 body words at ~2.5 wps for German A1 multi-voice = ~106 s
- Title "Bank im Tiergarten" narrated first = ~3 s
- Total: 1:45 – 1:55 minutes

Same range as the existing journey examples (`Sonntag in Prenzlauer Berg` 1:51, `Apfelkuchen in Wedding` 2:08).
