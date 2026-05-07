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
- **Synopsis-body coherence (REQUIRED)**: every named character in the synopsis must appear in the body, and vice versa. No renaming between drafts. A synopsis that says "Klaus and Sabine meet" while the body has Anna and Tom is a hard defect — the reader sees the mismatch immediately. Pre-save check: read the speakers list in the body and confirm every named character in the synopsis is one of them.
- The synopsis should describe the arc, not replay the opening scene verbatim. If the body's first paragraph already says "Auf dem Küchentisch steht eine Tasse Linsensuppe, kalt und unberührt" and the synopsis says the same, the synopsis is redundant. Use synonyms or summarize at a higher level.
- Sober concrete style. No marketing tone, no sentimental metaphors, no mention of "the reader" or "language learners".
- Conflict and emotional shape distinct from existing synopses in the journey. Sharing a setting is fine; sharing the arc is not.
- Plausible behavior in the cultural setting. Don't fabricate things a real venue does not host.

## 3. Body

### Format (depends on the journey + audio tier)

Both Conversacional and Viajero now default to **multi-voice dialogue**: a narrator opens the scene, then characters speak in `Speaker: line` blocks. The format-vs-backend table below captures the historical and current defaults — if you start a new story today, go multi-voice.

| Journey type | Audio tier | Body format | Audio backend |
| --- | --- | --- | --- |
| Conversacional (DE) | Paid | Plain text. Narrator paragraphs + `Speaker: line` blocks (`\n` between, `\n\n` between sections). NO HTML. | ElevenLabs multi-voice (`generateAndUploadMultiVoiceAudio`) |
| Viajero (free) | **Free, default** | Same plain-text multi-voice format as above. NO HTML. | Local TTS multi-voice (Kokoro narrator + Chatterbox MTL clones for characters, ref audio = approved Apache-2.0 sample mp3 in `/public/voice-samples`) |
| Legacy single-voice | n/a (deprecated) | HTML with `<blockquote>...</blockquote>` per paragraph. Quoted speech embedded inside narrator prose. | ElevenLabs single-voice |

**Default for new stories regardless of journey: multi-voice plain-text.** Don't write `<blockquote>` HTML in new bodies. Legacy stories still on `<blockquote>` (DE Conversacional `Anna am Winterfeldtmarkt`, `Sonntag in Prenzlauer Berg`; the very first Viajero `Tinto en La Candelaria` before the multi-voice migration) only need converting if/when their audio is regenerated.

**Why this changed**: when Viajero was first defined, all audio was paid (ElevenLabs single-voice was the cheapest path). Now that Apache 2.0 / MIT / CC0 LATAM voices exist (Kokoro Dora + Qwen3-VoiceDesign personas cloned via Chatterbox), free multi-voice is feasible and richer than free single-voice, so Viajero defaults flipped. **Don't quote the old "all Viajero is single-voice" rule from earlier versions of this doc** — it is obsolete.

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

### Arc archetype (REQUIRED)

Every story must declare an `arcType` field in its JSON shape and execute that arc in the body. The default "two characters chat amably and part" pattern is BANNED unless the journey deliberately schedules it (e.g. as a calm beat between heavier stories). At A1 the lexicon is constrained but the narrative shape is not — kids' books at A1-equivalent levels carry real arcs with real stakes inside tiny vocabularies.

The eight archetypes the journey rotates through:

| `arcType` | What it is | Concrete A1 example |
| --- | --- | --- |
| `white-lie` | A character tells a small lie out of kindness and almost gets caught. Reader holds dramatic irony. | A teenager lies to her grandmother on the phone that she ate the soup; grandmother asks how it tasted; the teenager improvises. |
| `last-minute-decision` | The character changes their mind in the final beat. | A man buys roses for his ex; at her door he turns back and gives them to a stranger in the lobby. |
| `return-after-years` | A character returns to a place that has changed or no longer recognizes them. | An older man visits a café he hasn't been to in forty years; the new barista listens politely but doesn't know him. |
| `unspoken-subtext` | Two characters discuss something trivial while another, unspoken topic floats between them. | A landlord visits an old tenant carrying a letter and never delivers it; they make coffee and talk about the weather instead. |
| `plan-falls-short` | What the character wanted didn't pan out; they resolve it differently. | A girl wants to buy her mother a bouquet but only has enough for one stem; the florist wraps it with a free ribbon. |
| `late-reveal` | A line in the final beat recolors the entire conversation that came before. | Two friends meet at a café for their usual Saturday coffee; in the last exchange one mentions she is moving to Munich on Friday. |
| `small-stake` | The character wants something concrete and faces a small, real obstacle. | At the cash register the customer realizes she forgot her wallet; the shopkeeper, who knows her by sight, lets her pay tomorrow. |
| `open-ending` | The story closes on an unanswered question. The reader does not know how the situation ends. | A teenager waits at a U-Bahn station for someone who never shows; he decides to go home, or to go elsewhere alone — the story ends before the choice resolves. |
| `daily-encounter` | A calm, low-stakes everyday encounter (shop, café, market, train) with at least one beat of warmth or observation that lifts it above pure transaction. Acts as a breathing space between heavier arcs in the journey. | A regular customer chats briefly with the baker about a son visiting on Sunday; the baker mentions a cake she just baked. They part on a small, specific shared moment, not a generic friendly goodbye. |

**Rotation rules**:

1. Do not use the same non-`daily-encounter` `arcType` twice in three consecutive stories of the same journey level/topic.
2. `daily-encounter` is the calm-mode arc and may be used more often, BUT no more than two consecutive stories at the same level may both be `daily-encounter`. After two calm beats, the next must use one of the higher-tension arcs (`white-lie`, `last-minute-decision`, `return-after-years`, `unspoken-subtext`, `plan-falls-short`, `late-reveal`, `small-stake`, `open-ending`).

**Forbidden default**: a story whose only beat is "two characters meet, exchange friendly small talk, part on good terms" without ANY arcType (including `daily-encounter`) shall not be saved. If you tag `daily-encounter`, you must execute its requirement: at least one beat of warmth or observation that lifts the story above pure transaction.

### `arcType` field in the saved JSON

In addition to the existing fields (`title`, `synopsis`, `text`, `vocab`), add:

```json
"arcType": "late-reveal"
```

Use one of the eight values above. The field is required for every new story and tracked across the journey for the rotation rule.

## 4. Vocab

- 18 to 22 items per story.
- Each item:
  - `word`: dictionary lemma form
  - `surface` (optional): exact form as used in the text, only if different from the lemma
  - `definition`: 8 to 14 English words. Concise, practical, no clichés. (See vocab audit 2026-05-03 in user memory: the legacy 17-25w prompt produced inflated, encyclopedic definitions in C2 German vs concise 12.5w avg in A1 Italian; the corrected target is 8-14w across all levels.)
  - `type`: one of `verb` | `noun` | `adjective` | `adverb` | `expression` | `slang`
- **Banned definition openers** (do NOT start a definition with these phrases): `Refers to`, `Describes`, `Used to`, `Used for`, `Said when`. Start with the meaning directly. Examples:
  - GOOD: `kochen → Heated ingredients in a pot to create a meal.`
  - GOOD: `Linsensuppe → Lentil soup, hearty German weekday dish with sausage and vegetables.`
  - GOOD: `vergessen → To forget, fail to remember or do something on time.`
  - BAD: `Linsensuppe → Refers to lentil soup, a hearty traditional German dish often eaten on weekdays...`
  - BAD: `vergessen → Used when telling someone you forgot something they asked you to do...`
- **Vocab item must appear in the BODY**, not only in the synopsis. The reader's karaoke pill highlights vocab in the body; a vocab word that lives only in the synopsis is invisible at runtime and wastes a teaching slot. Verify the surface form is present in `text` before saving.
- **No transparent cognates** a learner reads at sight. Expanded list (DE): `Mathe`, `Kaffee`, `Tomate`, `Tomaten`, `Banane`, `Schokolade`, `Tee`, `Telefon`, `Apfel`, `Optimist`, `Chance`, `Computer`, `Familie`, `Restaurant`, `Park`, `Auto`, `Bus`, `Hotel`, `Adresse`, `Information`, `Foto`, `Musik`, `Konzert`, `Pizza`, `Spaghetti`, `Hamburger` (the food). Romance/Spanish examples: `importante`, `normal`, `social`, `problema`, `idea`, `momento`, `televisión`, `radio`, `posible`. Pick teachable items instead.
- **No same-root duplicates in the same story**: pick either the verb or the noun, not both. Bad: `fernsehen` + `Fernseher`; `Linsen` + `Linsensuppe`; `lügen` + `anlügen`; `lächeln` + `Lächeln`; `kochen` + `Koch`. They teach the same root twice and waste two of 21 slots. Detection: if two vocab items share the first 4-5 root chars after stripping common prefixes (`an`, `ge`, `ver`, `be`, `er`, `ent`, `auf`, `aus`, `ein`, `nach`), drop one.
- **Separable verbs**: when picking a separable verb (`anlügen`, `fernsehen`, `aufmachen`, `zuhören`, `abräumen`), the `surface` field MUST be a single contiguous string that actually appears in the body. If the body splits the verb (`lüg mich nicht an`, `Marie räumt den Tisch ab`), use the lemma form (`anlügen`, `abräumen`) as both `word` AND `surface`, NOT the separated form. Otherwise the karaoke pill matcher fails because the surface is not a literal substring of the body.
- Multi-word entries only for genuinely lexicalized expressions (`auf einmal`, `schon mal`, `mein Schatz`, `tut mir leid`). Not arbitrary descriptive fragments.
- The `type` field drives the karaoke pill color, so accuracy matters: an adjective tagged as `verb` shows in the wrong color.
- **Distribute vocab across the body**: aim for roughly 3-5 vocab items per paragraph, NOT more than ~30% of items in any single paragraph. If you pick vocab linearly while reading the body you tend to cluster everything in the opening narrator beat (that's where descriptive nouns and setup verbs live), and the rest of the story has zero vocab pills. The pedagogical contract is that the learner encounters teachable items throughout the audio. Pre-save check: count vocab items per paragraph; if any paragraph has 0 and another has 6+, rebalance before saving.

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

## 9. Pre-save checklist

Before running the `save` script, walk through these ten binary questions. If any answer is `no`, fix the story before saving. The script does not enforce these; the assistant must self-audit.

1. Does the title have a concrete cultural anchor (neighborhood, dish, named venue, traditional object) and avoid generic nouns and banned patterns?
2. Does the first sentence of the synopsis describe the scene with common nouns (place, props, action), not just proper nouns?
3. Does the narrator open with a complete sentence (subject + verb), not a verbless fragment?
4. Does the narrator's cadence vary (mix of short and long sentences, never five similar ones in a row)?
5. Does the narrator include at least one sensory detail (smell, light, sound, temperature)?
6. Does each character have a distinguishable voice (lines you can attribute to one and not the other without the speaker label)?
7. Is there at least one callback inside the body (a phrase, gesture, or word reused with a twist late in the story)?
8. Is the declared `arcType` actually executed in the body, not just labeled? Reread and confirm the arc is recognizable to a reader.
9. Does the close avoid the default "everyone parts happy" formula unless the arc explicitly justifies it?
10. Are all body words within the target CEFR level or one level above (i+1)? No words two or more levels above target?
11. Are all `definition` strings between 8 and 14 English words and free of the banned openers (Refers to / Describes / Used to / Used for / Said when)?
12. Does every `vocab.word` (or `surface`) literally appear in the `text` body? No vocab item lives only in the synopsis?
13. Is the `vocab` list free of transparent cognates and free of same-root duplicates (no verb+noun pair from the same root)?
14. Does every named character in the synopsis (proper noun) also appear in the body, and vice versa? No "Klaus said" in the synopsis when the body says "Anna said".
15. For separable verbs in vocab, is the `surface` a contiguous substring of the body? If not, the surface should be the lemma (`anlügen`), not the split form (`lüg an`).
16. Is the body in the correct format for the journey type? Multi-voice Conversacional DE stories use `Speaker: line` plain text, NOT `<blockquote>` HTML.
17. Is the vocab distributed across the body? Roughly 3-5 items per paragraph; no paragraph has 0 while another has 6+. (Pre-save sanity check: scan ¶ counts.)

If 12 or more answers are `yes`, save. If fewer, revise.

---

## Reference example A — gentle subtext: Bank im Tiergarten

A story written specifically to illustrate the spec, not yet generated. **`arcType: "unspoken-subtext"`**: two strangers chat about Berlin's weather while the older woman is really talking about loss and change. The reveal is implicit, never spelled out.

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

---

## Reference example B — late reveal: Espresso am Kollwitzplatz

A second worked example, deliberately at the heavier end of the engagement spectrum. **`arcType: "late-reveal"`**: two friends meet for their usual Saturday coffee; in the last beat one of them mentions she is moving to Munich next week. The line recolors the entire previous hour: Mara's distance, the uneaten cake, the shorter laughs were all pointing at this. The story closes on Lina alone with a half-finished espresso.

This is the engagement target for the journey rotation. Bank im Tiergarten is acceptable as a calm beat between heavier ones; Espresso am Kollwitzplatz is closer to what most stories should feel like.

### Title

`Espresso am Kollwitzplatz`

Three words, dish + Berlin square (Kollwitzplatz, not used in existing titles). The title does not preview the reveal; it sits as a routine setting until the final beat changes its meaning.

### Synopsis (58 words)

> Lina und Mara sind beste Freundinnen seit der Schulzeit. Jeden Samstag treffen sie sich im selben kleinen Café am Kollwitzplatz, immer am gleichen Tisch. Heute ist Mara still und isst keinen Kuchen wie sonst. Lina merkt es, fragt aber nicht weiter. Erst beim Abschied, mit der Jacke schon an, sagt Mara den Satz, der die ganze Stunde rückwirkend verändert.

The first sentence is "Lina und Mara sind beste Freundinnen seit der Schulzeit." After stripping proper nouns: "sind beste seit der." Weak. Better, the second sentence is what the cover prompt should pivot on: "Jeden Samstag treffen sie sich im selben kleinen Café am Kollwitzplatz." That gives the cover a real scene. (Reminder: bypass `buildCoverPrompt` and write the prompt explicitly.)

### Body (~265 words)

```
Es ist Samstagnachmittag in Berlin. Im kleinen Café am Kollwitzplatz ist es ruhig. Es riecht nach Kaffee und frischem Gebäck. Lina sitzt schon am Fenster und wartet auf Mara, ihre beste Freundin seit der Schulzeit. Sie treffen sich jeden Samstag hier, immer zur gleichen Zeit, immer am gleichen Tisch.

Mara: Hallo, Lina. Entschuldige, ich bin spät.
Lina: Kein Problem. Setz dich. Was nimmst du?
Mara: Einen Espresso, glaube ich. Nichts zu essen heute.
Lina: Wirklich? Du isst sonst immer Kuchen.
Mara: Heute nicht. Ich habe keinen Hunger.
Lina: Alles gut?
Mara: Ja, ja. Nur ein bisschen müde.

Der Espresso kommt. Mara trinkt langsam. Sie schaut oft aus dem Fenster.

Lina: Wie war deine Woche?
Mara: Voll. Sehr voll. Und deine?
Lina: Normal. Im Büro war viel los. Sonst ruhig.
Mara: Schön.

Sie reden über kleine Dinge. Über das Wetter. Über einen Film. Über Linas neuen Hund. Mara lacht ein paar Mal, aber kürzer als sonst. Lina merkt es, sagt aber nichts.

Mara: Ich muss los, Lina.
Lina: Schon? Wir sind erst seit einer Stunde hier.
Mara: Ich weiß. Aber heute ist viel.
Lina: Okay.

Mara steht auf und nimmt ihre Jacke vom Stuhl. Bevor sie geht, dreht sie sich noch einmal um.

Mara: Übrigens, Lina. Ich ziehe nächste Woche nach München. Wegen der Arbeit.
Lina: Was?
Mara: Ich wollte es dir sagen. Heute war schwer.
Lina: Mara…
Mara: Wir sehen uns, ja? Versprochen.

Mara lächelt klein und geht. Lina bleibt sitzen. Vor ihr steht der halbvolle Espresso. Im Café ist es immer noch ruhig.
```

Why this body executes the `late-reveal` arc:

- **Subtext layered through the body, not stated**: Mara is late, doesn't eat, drinks slowly, looks out the window often, laughs shorter than usual. The reader can pick up that something is off; the reveal at the end confirms it.
- **Lina notices but doesn't push**: she asks once ("Alles gut?"), accepts the answer, lets the conversation move to small things. Real friend behavior at A1 vocabulary level.
- **The reveal lands in the second-to-last beat**: "Übrigens, Lina. Ich ziehe nächste Woche nach München." The casual marker "übrigens" (by the way) is the cruelty: a life change presented as a footnote.
- **The close echoes the opening with one detail changed**: opening narrator says "Im kleinen Café am Kollwitzplatz ist es ruhig." The closing narrator says "Im Café ist es immer noch ruhig." Same calm, completely different feeling. That's the callback that earns the arc.
- **No "everyone happy" close**: Lina is left alone with a half-finished espresso. Mara has gone. The story ends in stillness, not warmth.

### Vocab list (20 items)

| word | surface | type | definition |
| --- | --- | --- | --- |
| treffen | treffen | verb | Used when meeting someone, by appointment or chance, very common verb for social plans with friends or family. |
| Freundin | | noun | Refers to a female friend; the masculine form is Freund and is used for either male friends or romantic partners. |
| Schulzeit | | noun | Refers to one's school years as a period of life, often used when talking about long friendships or shared memories. |
| Espresso | | noun | Refers to a small strong coffee, prepared at high pressure, common order in central European cafés in the afternoon. |
| Kuchen | | noun | Refers to a sweet baked dessert similar to cake, central in German coffee culture and Saturday social rituals. |
| Hunger | | noun | Refers to the physical sensation of needing to eat; "ich habe Hunger" is the standard way to say "I am hungry". |
| müde | | adjective | Describes a tired feeling, physical or emotional; can be used literally or as a polite cover for something heavier. |
| langsam | | adjective | Describes a slow pace; used both for movement and for the way someone speaks, eats, or makes decisions. |
| oft | | adverb | Means often; describes something that happens many times rather than rarely or only once. |
| Woche | | noun | Refers to a week; in German conversation a frequent reference point for plans, work, or recent events. |
| voll | | adjective | Describes something full; informally used for a busy, packed schedule, as in "Meine Woche war voll." |
| ruhig | | adjective | Describes a moment, person, or place that is calm and quiet, without noise, hurry, or strong emotion. |
| lachen | | verb | Used to describe laughter; intensity and length carry meaning, a short laugh hints at something held back. |
| merken | merkt | verb | Used when noticing something, often something subtle; close in meaning to "to realize" or "to pick up on". |
| übrigens | | adverb | Means "by the way"; introduces a remark that the speaker presents as a side note, sometimes to soften something major. |
| ziehen | ziehe | verb | Used reflexively in "ich ziehe um" or alone in "ich ziehe nach X" to mean moving residence to a new place. |
| wegen | | preposition | Means "because of"; introduces a reason or cause, common in everyday explanations of decisions. |
| Arbeit | | noun | Refers to work, both as activity and as a job; central word in conversations about daily life and major decisions. |
| versprechen | Versprochen | verb | Used when committing to do something for someone; the past participle alone is a common short reply meaning "I promise". |
| halbvoll | | adjective | Describes something that is half full; here applied to the espresso left on the table, a quiet visual closing detail. |

### Cover prompt (custom, bypassing `buildCoverPrompt`)

> Editorial book cover illustration of two young women in their late twenties sitting at a small round café table by a window in a quiet Berlin neighborhood square. One has long dark hair and wears a soft jumper; she smiles politely but her gaze drifts to the window. The other leans forward, looking at her friend with quiet concern. Between them on the wooden table sit two small espresso cups; one is half empty. Through the window the soft light of a Saturday afternoon falls on a leafy square with a few walkers passing.
>
> Two characters only, mid-shot framing, both faces clearly visible, atmosphere of unspoken news between close friends.
>
> Hand-drawn cartoon vector illustration in the style of contemporary editorial language-learning book covers. Clean rounded shapes, gentle line work, expressive but stylized faces. The look used by Duolingo, Notion, Headspace and Babbel landing pages.
>
> Color tonality: cool harmony anchored on sage green, lavender and dusty blue, with vivid confident saturation, not pastel and not washed-out.
>
> Wide horizontal 16:9 landscape frame. No text, no letters, no captions, no logos, no borders.

### Audio voice map

```ts
voiceMap = {
  narrator: GERMAN_DIALOGUE_VOICES.moritz,    // baritone narrator
  Lina: GERMAN_DIALOGUE_VOICES.enniah,        // warm middle-aged female; the friend who notices
  Mara: GERMAN_DIALOGUE_VOICES.gesaTess,      // calmer host baseline; fits Mara's composed-but-distant voice
};
ambientPath = null; // intimate café scene; no ambient layer
```

The casting choice matters here: pairing a warmer voice (Enniah) with a cooler one (Gesa Tess) helps the listener feel Mara's distance even before the reveal. If both characters had the same warmth, the subtext would not land as well.

### Estimated audio length

- ~265 body words at ~2.5 wps for German A1 multi-voice = ~106 s
- Title "Espresso am Kollwitzplatz" narrated first = ~3 s
- Total: 1:45 – 1:55 minutes

Same range as the other examples; engagement is in the arc, not in the runtime.

---

## How to use these examples

When generating a new story:

1. Read this whole spec, including both reference examples.
2. Pick an `arcType` from §3 that has not appeared in the last three stories of the same journey/level/topic.
3. Use the closer reference example for tone calibration: §A for low-intensity beats, §B for the engagement target.
4. Generate, then run yourself through the §9 pre-save checklist.
5. Save only when 8+ checklist items pass.

