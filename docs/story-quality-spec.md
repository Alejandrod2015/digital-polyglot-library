# JourneyStory quality spec

Reference for what every JourneyStory should look like across all eight elements (title, synopsis, body, vocab, cover, audio, timings, render). Rules are derived from the `/generate-story` skill plus iteration in production. Last refresh: 2026-05-06.

If you change a rule here, also update the matching feedback file in `~/.claude/projects/-Users-alejandrodelcarpio-digital-polyglot-library/memory/` so the Claude assistant follows the same rules across sessions.

---

## 1. Title

- 2 to 6 words in the target language.
- Exactly **one** concrete cultural anchor: real neighborhood, specific dish, named venue, or traditional object. Not generic nouns ("comida", "día", "viaje", "Essen").
- **Anchor must be recognizable to learners at the target level.** At A1/A2, default to city or famous neighborhood that an English-native beginner can place: Coyoacán, San Telmo, Valparaíso, Miraflores, Mérida, Oaxaca, Cusco, Cartagena. Avoid obscure micro-neighborhoods that even Spanish speakers may not know (Tepozteco, Jalatlaco, Pasaje Defensa, Ascensor Reina). Rule of thumb: if the learner can't pronounce the anchor on the first read, swap for the parent city. Reserve obscure anchors for B2+ where cultural depth is part of the lesson.
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

### Narrator-style alternative

`storyGenerator` also accepts `storyStyle: "narrator"`, which generates continuous third-person prose with no `Speaker: line` blocks. Dialogue, if any, stays embedded in paragraphs with quotation marks. Use it when you need a single-voice TTS render (e.g. languages where a free multi-voice cast is not viable yet) or when the story is structurally contemplative / single-protagonist.

**Observed tendency (informational, not enforced):** the 2026-05-14 `Pellkartoffeln am Abend` DE A1 experiment showed that narrator prose drags grammar (Präteritum, declined-preposition relatives like `in der sie kochte`, `zu`-infinitive constructions like `Art zu essen`) toward A2+ even with strict A1 lexical guardrails. Multi-voice avoids this because speaker turns mechanically constrain grammar to present + Perfekt with simple clauses. So at A1/A2 narrator may yield grammar a notch above target — caller decides whether the trade-off is acceptable. The generator does not gate on level.

### Narrator

- Opens with a full sentence, e.g. "Es ist Samstagnachmittag in Berlin." NOT a verbless fragment ("Samstagnachmittag in Berlin.") — that reads as a stage label, not narration.
- **Establishes four things before the first dialogue line: where, when, atmosphere, and who-is-who.** Every character who speaks in the body must be introduced in the opening narration by name + relation (`su hermana Clara`, `su padre Iván`, `su abuelo Mateo`, `su pareja Sofía`). Never let a new speaker appear in the first dialogue without prior introduction; the reader only sees the body, the synopsis is internal metadata.
- **Vary the opening anchor across the journey.** Rotate between time+place ("Es viernes por la noche en Coyoacán."), weather/season ("En Mérida hace mucho calor desde la mañana."), sensory hook ("Desde la cocina llega un olor suave a pan caliente."), and event-of-the-night ("Esta noche el pasaje celebra una fiesta del barrio."). Hard ban on repeated formulas like "Es de mañana en X" / "Es de tarde en Y" across more than two stories in the same journey.
- Cadence varies: mix short and longer sentences. Five short sentences in a row reads like a list.
- One sensory detail (smell, light, sound, temperature) anchors atmosphere. Not three; one is enough.
- Action moves something forward. Avoid pure description.
- Body of work-published examples in the journey: opening narrators of "Beim Bäcker am Hackeschen Markt", "Tomaten vom Wochenmarkt", "Eiscafé am Sommerabend".

### Dialogue

- Real conversational rhythm: reactions, interruptions, brief silences. Not pure question→answer drill.
- **Turn length (HARD, 2026-07-06): no dialogue turn above 30 words; healthy average ~15-20.** A 40-word turn with three expository sentences is a monologue wearing a speaker label — split it with a reaction or question from the interlocutor. Real case: German C1 story 1 shipped a 40w Nadia turn; the user flagged it. Enforced mechanically by the turn-length gate in `scripts/storyClaude.ts` save.
- Each character has a voice: maternal, curious, teasing, deadpan, etc.
- Callbacks within the story (a phrase reused with a twist late) build cohesion.
- Lexical level matches the target CEFR. One level above is normal exposure (i+1); two levels above is a real problem to fix before saving.

### Bare imperatives (HARD BAN in dialogue)

Short imperatives ending in period as the ONLY sentence of a dialogue turn ("Trae los vasos.", "Siéntate.", "Mira.", "Espera.", "Ven.") render with rising/question intonation in ElevenLabs across ALL voices and models we have tested. Confirmed empirically on 2026-05-29 with Horacio (Spanish, Colombian) on "Trae los vasos de agua.":

| Variant tested | Result |
| --- | --- |
| v2 stability=0.9 period | Question intonation |
| v2 stability=0.9 with `!` | Question intonation |
| v3 + various tags + stability | Question OR s-aspiration (worse) |
| `"Trae los vasos de agua, mija."` (vocative final) | Question intonation |
| `"Trae los seis vasos de agua que están en la nevera."` (long imperative with subordinate clause) | Question intonation |
| `"Trae los vasos de agua. Por favor."` (imperative + 2nd sentence) | Clean declarative |
| `"Trae los vasos de agua. Gracias."` (imperative + 2nd sentence) | Clean declarative |
| `"¿Me traes los vasos de agua?"` (request as question) | Clean question |

The pattern: only a **boundary between two complete sentences** closes the prosody. Length, punctuation, vocatives don't matter.

**Writer rule (enforced by validator `dialogue-bare-imperative`):** every imperative in a dialogue turn must be accompanied by at least one of:

1. Second short closing sentence — `"Trae los vasos. Gracias."` / `"Siéntate. El caldo ya está."`
2. Vocative + second sentence — `"Come, mija. El caldo se enfría."`
3. Rephrased as polite request question — `"¿Me traes los vasos de agua?"`
4. Rephrased as declarative — `"Necesito los vasos de agua."`

Forbidden pattern: bare imperative (≤4 words) as the only sentence of a dialogue turn ending in period.

### Non-vocalized sounds (HARD BAN)

ElevenLabs (and the entire TTS pipeline) cannot render laughs, hums, sighs, or stage directions naturally — they come out either silent, comically mispronounced, or as a flat dictionary read ("ha-ha-ha"). Anything in the body that the narrator can't say as real words breaks the audio. **NEVER include in any story body**:

- Laughter spellings: `haha`, `Hahaha`, `jaja`, `jeje`, `hehe`, `ja ja`, `kkk`, `LOL`.
- Hesitation / filler sounds: `hmm`, `hmmm`, `uhm`, `ehm`, `uh`, `eh`, `ah`, `mh`.
- Reaction sounds: `mmm` (as a sound, not the adverb), `oh!`, `ohh`, `aww`, `ay`, `uy`, `ugh`, `wow`.
- Onomatopoeia in narration or dialogue: `Shhh` / `Sh`, `Mmm`, `Tap, tap`, `Toc, toc`, `Pum`. The TTS reads them as literal letters.
- Stage directions inside dialogue: `(laughs)`, `(sighs)`, `[ríe]`, `*pause*`, `[muttering]`.

> Validator lock (2026-06-26): `body-no-banned-tokens` now also fails on `mm+`, `sh+`, `tap, tap`, `toc, toc`, `pum`. Added after `Shhh`/`Mmm`/`Tap, tap` shipped in a0/a2 LATAM stories because the original token list missed them. Replace a hush with words ("Baja la voz, nos van a oír"), a knock with narration ("un golpecito seco, y luego otro").

**Render reactions as real words instead.** "Hahaha! Ich auch, fast." → "Ich auch, fast." The laugh is implied by the context. "Mmm! Wieso ist roher Teig so lecker?" → "Wieso ist roher Teig so lecker?". Use concrete vocabulary to convey emotion: `Ich war ungeduldig`, `Das schmeckt seltsam`, `Was für ein Glück`, `Komisch`, `Schade`. Pre-save check: grep the body for any of these tokens and remove before save — they're a hard defect, not stylistic preference.

### Dialect matches setting (HARD)

The dialect of the dialogue must match where the story is set, and must stay consistent with the other levels of the same journey.

- **Río de la Plata (Argentina / Uruguay) → voseo is REQUIRED**, not optional: `vos`, `sos`, `tenés`, `querés`, `venís`, `decís`, `mirá`, `vení`, `quedate`, `¿sabés?`. Writing a porteño in `tú` is inauthentic — that's the opposite of the "authentic native language in context" thesis.
- **Mexico / Colombia / Peru / Chile → tú / ustedes**, never voseo.
- Validator locks: `body-voseo-forms` fails on voseo leaking into a non-rioplatense setting; `body-missing-voseo` (2026-06-26) fails on a rioplatense setting written in `tú` with no voseo. The second was added after a0 Buenos Aires shipped in `tú` while a1/a2 of the same journey used voseo — a learner was taught the wrong register, then a different one a level later.

### Names & orthography match the journey language (HARD) [2026-07-06]

Every proper noun and every character in `title`, `synopsis` and `text` must use ONLY the target language's alphabet and naming conventions. No foreign diacritics or scripts, character names included: `Ayşe` (Turkish `ş`) in a German story reached the reader and the user flagged it as a never-repeat error ("solo nombres y escritura del idioma"). A Berlin Späti owner is `Katja`, not `Ayşe`; a Lima vendor is `Rosa`, not `Aiko`. The learner is acquiring the target language's writing system — a single out-of-alphabet glyph breaks that contract and can break TTS.

- Allowed letters per language: base A-Z plus the language's own set (DE `äöüß`, ES `áéíóúüñ¿¡`, IT `àèéìíîòóù`, PT `ãõáâàçéêíóôú`, FR `àâæçéèêëîïôœùûüÿ`).
- Enforced mechanically: `scripts/storyClaude.ts` save has an orthography gate that rejects any letter outside the journey language's alphabet in title/synopsis/text.

### Narration crutches & repeated beats (HARD BAN on overuse)

Added 2026-06-25 after the es-LATAM **A0** journey shipped with three template tics repeated across ~20 of 21 stories. Each story passed the per-story checks; the mold only showed up reading them back-to-back (the mandatory gestalt step). By then the audio was generated, so it couldn't be cheaply fixed. These are now caught at validation, **before** audio.

Banned devices (validator `body-inner-monologue-tell`, `body-aphoristic-closing`, `body-cliche-beat` — all warn per story; `motif-cross-story` escalates to fail once 2+ siblings already use the same one):

- **Narrated rhetorical question** as a tell: `Se pregunta: ¿…?` / `Mateo se pregunta: ¿Es real?`. It announces the character's inner state instead of showing it. Show the tension through what the character **does or says**, or cut it.
- **Stated-thought moral** / fortune-cookie closing: `X piensa: [aforismo]`, or a bare maxim as the last line (`A veces, un problema es un regalo.` / `la aventura no es llegar; es el camino.` / `Hoy, Camilo es Barranquilla.`). Land the ending on a **concrete image, action, or a line of dialogue**, never a stated lesson.
- **Cliché sentimental beats**, e.g. the "the photo can't capture it / it's more beautiful in my own eyes" beat (used in 3 A0 stories). Find a fresher way to land the emotion.

Rule of thumb: the **same** narration device or emotional beat must not recur across more than two stories in a journey. Variety of *how a story is told and how it ends* matters as much as variety of plot.

### CEFR grammar ceiling per level

The body (not just the vocab list) may reach **i+2** (A1 → up to A2/B1 lexis; see the two-level rule), **but A0 is special: an A0 body may reach A1/A2 and must NOT use B1 constructs.** Validator `body-cefr-a0-grammar` (A0 only) **fails** on:

- Present **subjunctive** after a trigger: `aunque viva lejos`, `para que sepa`, `cuando llegue`. Use the indicative (`aunque vive lejos`).
- The comparative subordinate **`de lo que`**: `más fuerte de lo que creo`. Use a simpler comparative.
- The **`hace X tiempo que` + present** idiom: `hace años que sueña`. Rephrase (`sueña con esto desde hace mucho` is also B1 — prefer a plain present: `siempre quiere ver este lugar`).

### Length

- Target 220-280 words. Hard maximum 320. Hard minimum 180.
- Same target across all CEFR levels A1+. **A0 is the documented exception — see "A0 register" below.** What changes between levels A1+ is lexical and syntactic density, not volume.
- If you go over 320, trim before saving (cut a sub-beat, tighten a dialogue exchange, remove a redundant transition). Going over is allowed only when explicitly authorized by the user for that specific story.

### A0 register (lighter tier) — exception to the A1+ defaults

A0 (Beginner) is **NOT a shorter A1**. It is a deliberately lighter, separate tier, fixed by the **es-LATAM A0 precedent** (measured 2026-06-28) and applied identically to de-germany A0:

- **Narrator-style, single voice** — NOT multi-voice. Continuous third-person prose; brief quoted speech embedded inside narrator paragraphs (no `Speaker: line` blocks). One narrator voice (the journey/topic voice) reads the whole story.
- **Body ~135-145 words** (NOT 220-280) so the narrated audio lasts **~1 minute on average** — the user's standing target. Calibrated to es-LATAM A0: ~139 words → ~63s real audio at tempo 0.94 (~0.45 s/word). ~100-120 words is too short (~50s); push up to land near a minute.
- **Synopsis ~25-40 words** (NOT 45-90).
- **Vocab ~22-26** (definitions still 8-14 English words).
- **Standalone protagonists per topic** — A0 does NOT reuse the journey's A1 recurring cast / `journeyCasts.ts` voicemap. Each topic has its own simple lead (es-LATAM A0: Camilo, Elena, Ana, Valentina, Mateo, Lucía, Pablo; de-germany A0: Lena, Marie, Finn, Sofia, Nora, Emma, Mia).
- **Grammar floor** as in "CEFR grammar ceiling per level" above: subject-first (no V2 inversion), no `es gibt`, no separable verbs, present only, one idea per short sentence. (`feedback_a0_true_floor`.)

The A1+ validator checks `body-word-count` (180+), `synopsis-length` (45+), `body-dialogue-ratio`, `speakers-count`, `speaker-lines` are **known A0 exemptions** for narrator-style A0 stories — not defects. Everything else in this spec (banned tokens, bare imperatives, narration crutches, cultural anchor taught, vocab defs/distribution, opening variety, arc + final-slot resolution) still applies in full.

### Arc archetype (REQUIRED) — 7-arc kishōtenketsu taxonomy

Every story must declare an `arcType` field in its JSON shape and execute that arc in the body. **Migrated 2026-06-02** from the previous Western 9-arc taxonomy to a 7-arc system anchored on kishōtenketsu (Japanese 4-act structure: setup / development / reframe-turn / harmonic close). The reason: research showed kishōtenketsu natively fits 250-word stories (each act ≈ 60 words) and engagement comes from the act-3 reframe, not from Western conflict escalation — which is hard to sustain at A1 vocab budgets. See `docs/engagement-research-brief.pdf`.

The seven archetypes:

| `arcType` | Target % | What it is | Concrete A1 example |
| --- | --- | --- | --- |
| `reframe-turn` | ~30% | Workhorse kishōtenketsu. Acts 1-2 set a scene; act 3 reveals/recontextualizes; act 4 closes in the new light. Replaces white-lie / last-minute-decision / unspoken-subtext / plan-falls-short. | A father lays three plates for Sunday lunch as always; daughter notices but doesn't ask; in the final beat he says the third plate is for the mother who is gone — and serves a spoonful of broth into it. |
| `juxtaposition-discovery` | ~15% | Two unrelated elements collide with meaning — the core ten mechanism. The reader connects them in act 3. | A young woman folds tamale wrappers with her left hand; her sister watches and realizes everyone in the family folds with the left, except her — the mother is in their hands without anyone naming her. |
| `harmonic-close` | ~15% | Comfort arc. Story completes in calm, no twist. Replaces `small-stake`. | A regular customer chats with the baker about a son visiting Sunday; the baker mentions a cake just out of the oven. They part on a small, specific moment. |
| `mini-cliffhanger` | ~15% | Story is structurally complete BUT the final line opens a question the next story answers. PAIR with a recurring character so the reader carries the hook. | A grandmother on the phone asks her son to tell his daughter "to open the box under my bed when she comes." Conversation ends. The box stays unopened in THIS story. |
| `recurring-character-callback` | ~10% | Payoff for an established character. The reader's history with them is the engine. | The neighbor (introduced 4 stories ago bringing soup) returns with a letter she has been holding since then. The exchange happens in real time. |
| `late-reveal` | ~10% | Information withheld until the final beat recolors the conversation that came before. | Two friends meet for their usual Saturday coffee; in the last exchange one mentions she is moving to Munich on Friday. |
| `daily-encounter` | ~5% | Slice-of-life, no twist required. Pure quotidian texture. Kept SMALL (was overused as default in the previous taxonomy). | At the kiosk the regular customer asks for el periódico de hoy and the same chocolatina as always. The vendor wraps it without asking. |

**Rotation rules** (updated for 7-arc system):

1. Non-comfort arcs (`reframe-turn`, `juxtaposition-discovery`, `mini-cliffhanger`, `recurring-character-callback`, `late-reveal`) cannot repeat in the last 3 stories of the same journey level/topic.
2. Comfort arcs (`harmonic-close`, `daily-encounter`) max 2 consecutive. After two comfort beats, next must be non-comfort.

**Cliffhanger rhythm across a journey**:

Across any 10 consecutive stories within a journey, **50-70% should end on an unresolved beat** (i.e. use `mini-cliffhanger` OR end the final line of any other arc with an open hook). Never 100% — the bonding effect requires variation; constant cliffhangers fatigue. Research-backed (Hahn et al. 2023, Univ. of Buffalo, n=475; Chapter Chronicles NLP analysis of 9,752 Webnovel comments — see brief).

**HARD: the LAST published story of a topic must NOT leave an unresolved cliffhanger.** A `mini-cliffhanger` is for the MIDDLE of a topic — the hook must be paid off by a later slot. If the final slot ends open, either resolve it in that slot or add a later slot that pays it off. Incident 2026-06-26: A1 LATAM Community s3 (man with a suitcase, "Es…") and Meeting s3 (Tomás doesn't show) shipped as the last story of their topic with no resolution anywhere — the arc hangs forever.

This is a topic-level / whole-set property, so it is NOT caught by the per-story validator. It is enforced by the **topic-continuity gate**, wired at the points that matter:
- **Audio generation (PRIMARY block — this is where money is spent):** `POST /api/studio/journeys/audio` runs the full gate (deterministic + LLM judge) over the story's whole topic BEFORE calling ElevenLabs, and returns 422 with the blockers if the arc is broken. Pass `{ force: true }` to override. This is the lock that prevents the 2026-06-26 failure mode: burning audio credits on a contradictory/cliffhanger-broken arc.
- **Publish:** `POST /api/studio/journeys/publish` refuses to publish a `mini-cliffhanger` that is the last slot of its topic.
- **Pre-launch full audit:** `POST /api/studio/journeys/audit-continuity { journeyId }` runs the whole journey and returns a report.

The checks themselves:
- `auditTopicArc` (`src/lib/auditTopicArc.ts`, deterministic): fails on a `mini-cliffhanger` in the final slot; warns on a character name reused with a different age/gender across slots.
- `auditCrossStoryRepetition` (same file, journey-wide): warns on formulaic beats reused across 3+ stories (signature phrases + verbatim 6-grams) — the "toma una foto pero…", "respira hondo", "ya no es un extraño" class.
- `judgeTopicContinuity` (`src/lib/judgeTopicContinuity.ts`, LLM): reads each topic's stories in order and flags plot contradictions and dropped threads (the semantic class no regex can catch, e.g. Places "reaches the sea then travels to it"). Best-effort: if `OPENAI_API_KEY` is missing it reports "unavailable", never a silent pass.

The design premise the judge enforces: **episodic series** (recurring cast, each story self-contained, hooks that ARE paid off) — NOT a continuous novel, NOT unrelated vignettes. See user memory `feedback_story_arc_continuity_gate`.

**Recurring cast (REQUIRED for engagement)**:

Each journey should have a defined recurring cast — 1-2 anchor characters appearing in 60-80% of stories, plus 4-8 secondary characters who reappear when their region/branch is in play. The cast for Spanish-LATAM is defined in `src/lib/journeyCasts.ts` (`SPANISH_LATAM_CAST`): familia López dispersa por Bogotá, Buenos Aires, CDMX, Lima y Santiago. **Use existing cast members wherever possible**; only introduce a fresh name when the story genuinely requires one. Voice IDs must match the cast member's `voiceSlot` exactly (no improvising voice assignments).

**Casts persist across levels (not per-level)** [added 2026-06-05]: a journey's recurring cast is shared across ALL its CEFR levels. When the journey grows into A2/B1/etc., new stories REUSE the same characters (they grow with the learner, like a series) — do NOT invent a fresh cast per level. Scale by depth (more stories + evolving arcs + rotating secondary characters), NOT by adding cities/casts: the dialogue-voice pool is limited (~10 per language) and 3 mini-casts already consume most of it. Trade-offs to manage while writing: avoid monotony (let relationships/situations evolve) and keep continuity (ages, relations, backstory) consistent across stories.

**Forbidden default**: a story whose only beat is "two characters meet, exchange friendly small talk, part on good terms" without ANY arcType shall not be saved.

**Retired arcs** (do NOT reintroduce): `white-lie`, `last-minute-decision`, `return-after-years`, `unspoken-subtext`, `plan-falls-short`, `small-stake`, `open-ending`. All re-route to `reframe-turn` or `harmonic-close` per the migration mapping in `src/lib/validateGeneratedStory.ts`.

### `arcType` field in the saved JSON

In addition to the existing fields (`title`, `synopsis`, `text`, `vocab`), add:

```json
"arcType": "reframe-turn"
```

Use one of the seven values above. The field is required for every new story and validated server-side.

## 4. Vocab

- **Count scales with body DENSITY, not a fixed cap** [2026-06-05]. **Hard minimum 20**; the ceiling = `max(25, round(bodyWords / 9))`. So a normal ~250-word story keeps the 20-25 band, while a denser/longer story earns more (e.g. a 330-word recipe-reunion like `la-fonda-de-tio-beto` → up to ~37, and genuinely wants ~30: the ingredients + the cultural terms `mija`/`marchando`/`epazote`/`guajillo` + the key verbs). Rule of thumb for the TARGET: roughly one teachable item per 10 body words. Do NOT pad to the ceiling — only highlight words that genuinely earn a slot (two-functions test below). History: 18-22 (pre-2026-06-04) → 20-25 (2026-06-04/05) → density-scaled (2026-06-05). Over-pilling is still bounded independently by the no-consecutive-pills + per-paragraph distribution rules, so a high count must still spread across the body, not cluster.
- **The cultural anchor word is MANDATORY vocab** [2026-06-11]. The story's central cultural term — the §1 anchor (dish / object / tradition: `mole`, `fonda`, `epazote`, `guajillo`, `jitomate`, `choclo`) — MUST get a vocab slot with a cultural definition, even when it is not high-frequency or "transferable." It is exactly the authentic-language payload DPL exists to teach; dropping it for the CEFR top-1500 frequency discipline inverts the product thesis. The frequency / two-functions filters apply to FILLER vocab, never to the cultural anchor. Real failure: `mole` was left out of `la-promesa-del-mole` (it was the title AND the central object) — the user flagged it as a never-repeat error. **The band is a guide, not a hard ceiling: exceeding it (up to ~30) is fine and preferred over dropping a deserving cultural word.** Hard minimum 20 stays; don't pad with filler, but never cut the anchor. **Sequence nuance** [2026-06-11]: the anchor goes in vocab at its FIRST appearance in the journey sequence (where the learner first meets it). Do NOT re-pill it in later stories of the same topic/journey that reuse it — it's already acquired (journey is sequential slot 1→2→3). The error to avoid is the anchor never being taught anywhere; not re-teaching every recurrence. Before requiring it, check whether an earlier story in the same topic already taught it (e.g. `mole` is taught in `la-promesa-del-mole`, so `humo-en-la-cocina` correctly omits it).
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
- **No long consecutive highlight runs**: do not allow more than 2 vocab pills in a row at render time. Two adjacent pills are acceptable when the phrase naturally demands it; 3 or more consecutive highlighted items read like worksheet markup and break immersion. Technical rule: if the first occurrences of selected vocab create a run of 3+ adjacent highlights, rebalance the selection before saving. Enforced as `vocab-no-consecutive-pills` warn check in the validator.
- **CEFR lexical discipline (A1/A2)** [added 2026-05-23]: for A1 and A2 levels, vocab MUST be drawn from the learner's top-1500 high-frequency words. The word must be one a beginner meets in their first months — household items, daily actions, family, food, places, body, common verbs, basic adjectives. **Forbidden** for A1/A2 vocab slots: rare, literary, regional, or domain-specific synonyms (the #1 quality leak: the LLM "varies" vocab by raiding the thesaurus). Spanish anti-examples and everyday alternatives: `anafe→estufa`, `talega/morral→bolsa`, `alfiletero→caja de costura`, `escabel/taburete/banquillo→silla`, `anaquel→estante`, `gaveta/cajetín→cajón`, `biombo→pared`, `visillo→cortina`, `alacena→armario de cocina`, `cirio→vela`, `peldaño→escalón`, `purificador/compartimiento→` (simpler nouns), `burbujear→hervir`, `candado/cerrojo→llave/cerradura`, `guardarropa→armario`, `boina/visera→gorra/sombrero`. Principle: **if a 6-year-old native wouldn't say the word, it's not A1 vocab** even if it fits the topic. Enforced as `vocab-level-frequency` check in the validator (lists in `src/lib/cefr/{spanish,german,italian,portuguese,french}A1A2.ts`). Threshold: 0 out-of-level = pass, 1-2 = warn, 3+ = fail. **Caveat (2026-06-04):** the A1A2 lists have been padded with content-specific words from the stories themselves (e.g. DE `fischhand`, `schürze`; ES `jitomate`, `choclo`), so a green `vocab-level-frequency` is partly self-referential — it confirms "word is in the accepted set," not "word is genuinely A1." A rigorous level check needs a neutral frequency lexicon; treat the current check as a floor, not proof.

### Selection criteria (what to teach) [added 2026-06-04]

- **Type balance per story (B2+, added 2026-07-06):** minimum 2-3 `expression` items per story; nouns capped at ~40% of the vocab list. At advanced levels idiomatic expressions are the scarcest acquisition (nouns self-acquire); a setting full of concrete objects (Kolonie, market) must not turn the list into an object inventory. Real case: German C1 arrival topic shipped with expressions collapsing 4→1→0 and one story at 52% nouns; both rebalanced. Cross-story synonym check: don't teach a synonym of an already-taught item (`Tresen` after `Theke`) — spend the slot elsewhere.

- **Definition must match the in-context sense, not the dictionary default.** Define the word as it is USED in this story's body. The #1 failure: a word that only appears inside a fixed phrase gets a generic definition that doesn't apply. Real case: `Tag` taught as "day; a 24-hour period" when its only occurrence was the greeting `Guten Tag` (= hello). Rule: if a word appears ONLY inside a fixed/idiomatic phrase, either teach the whole phrase as `type: expression`, or drop the word. Pre-save check: for each item, confirm the definition fits the sentence where the surface actually appears.
- **No proper nouns.** Character names, cities, neighborhoods, brands are not teachable vocabulary. Real case: `Eppendorf` (a Hamburg district) taught with a definition. Drop them and spend the slot on a transferable word.
- **No near-universal trivia words.** Skip words a beginner already owns in week one and that add no teaching value when used trivially (`Tag`, `ja`, `nein`, `Frau`, `Mann`, `Haus`). A slot is precious — do not spend it on day-one knowledge. Exception: keep only if the word is genuinely the teaching point of its sentence.
- **Two functions: comprehension AND acquisition. Cover both.** [corrected 2026-06-05] A vocab list does two different jobs, and they pull in opposite directions:
  - **Comprehension** = gloss the words that would BLOCK the reader if unknown. At A1/A2 these are usually the rare, concrete, scene-specific nouns (`Kabeljau`/cod, `Schürze`/apron, `Zitrone`/lemon). They earn a slot *precisely because* they are unfamiliar; the whole point of an in-story gloss is to unblock the scene.
  - **Acquisition** = words worth memorizing for active reuse. These are the high-frequency, transferable verbs/adjectives/connectors the learner meets everywhere (`brauchen`, `nehmen`, `wichtig`, `nett`, `zahlen`).
  - **"Transferable utility" = how often a word recurs across contexts.** It is a tiebreaker for the *acquisition* slots (which frequent word to keep when over budget), NOT a reason to drop a comprehension-blocker. Earlier guidance said "prefer transferable over scene props"; that was wrong — it would strip exactly the words an A1 reader most needs glossed. Do not exclude a word just because it is low-frequency or scene-specific.
  - **The real disqualifier is "rare AND irrelevant," not "rare."** A proper noun (`Eppendorf`) is recognized as a place without a gloss → excluded. A rare common noun central to the scene (`Kabeljau`) is needed → kept.
  - **Target balance per story:** roughly one third concrete comprehension-blockers + two thirds transferable acquisition words. For a 20-25 item list, that's about 7-9 concrete nouns the level won't know + 12-16 frequent verbs/adjectives. Don't let either side crowd out the other: an all-prop list leaves the learner nothing reusable; an all-frequent list leaves the scene unreadable.
- **No re-teaching across the journey (coverage budget).** A word taught in an earlier story of the same journey+level should NOT be re-taught later — spend the slot on a NEW word to maximize cumulative coverage. Real case: the DE journey re-taught `Tür`/`Suppe`/`Küche`/`Wasser` across 5+ stories while total unique lemmas (231) lagged the ES journey (350) for the same 21-story count. Enforced as `vocab-cross-story` / `vocab-journey-overrepresent`; treat ≤30% overlap with prior stories as the ceiling.
- **Definition style: capitalize the first letter; uniform register.** Every definition starts with a capital and follows `Word; short gloss.`. Avoid terse vague glosses ("a kind of fish") — be specific (`Cod; a mild white fish, easy to cook with salt and lemon.`).

## 5. Cover image

DPL stories are for adults learning a language, NOT for children. Every cover must read as a literary novel cover, not as a kids book or a language-app mascot. The cartoon-bebé / Pixar / Duolingo aesthetic is **banned** (see user memory `feedback_cover_style.md`).

### Workflow

- Generate via Flux directly. **Bypass `buildCoverPrompt`** in `src/lib/coverGenerator.ts` and `src/lib/dalle.ts`: the auto-prompt path produces median "father+daughter on couch with coffee" results that don't reflect the actual story. Always write a custom prompt.
- The custom prompt MUST explicitly include all six blocks below in this order: scene grounding → character description → key props → style → palette → frame constraints.

### 1. Scene grounding (extract from the actual story)

Identify the central visual hook of THIS specific story and put it at the top of the prompt. Examples:
- "Domingo con papá" → a small kitchen table set for THREE (third plate empty)
- "Bank im Tiergarten" → an old wooden park bench under tall trees
- "Espresso am Kollwitzplatz" → a small round café table by a window, two espresso cups (one half-empty)

If the central hook isn't in the prompt, Flux defaults to the statistical mean of the relationship type.

### 2. Characters

- Number (two max in mid-shot)
- Approximate ages (specific: "around 65", "around 40") — NOT "older" / "young"
- Relationship + role in the scene
- Posture / what they're doing in this exact frame
- Restrained adult expressions; NEVER "smiling at the viewer"

### 3. Key props (2-4 max)

- The central object that anchors the scene (the third plate, the half-finished espresso, the empty park bench)
- One or two secondary anchors (pot of caldo, paper bag of bread, window, radio)
- Be specific about what's IN them and HOW they're positioned

### 4. Style block (mandatory wording)

> Hand-drawn editorial illustration in the register of contemporary literary fiction covers (Sally Rooney, Maira Kalman) and warm editorial magazine illustrations (New Yorker, Apartamento, Kinfolk, contemporary cookbook covers). Visible line work with subtle paper-grain texture, NOT flat vector. Faces with realistic adult proportions and soft warm expressions (NEVER smiling directly at the viewer; restrained without being somber). Mood: lived-in, welcoming, atmospheric, grounded, adult.
>
> STRICTLY FORBIDDEN: cartoon-bebé / Pixar / Disney animation; Duolingo, Babbel, Headspace, Notion, Storyset, Freepik mascot aesthetic; oversized round heads; large anime/Pixar eyes; flat pastel color blocks; saccharine wholesome smiles; characters smiling directly at the viewer; muted / desaturated palette; sepia tones; chiaroscuro shadows; somber / melancholic mood; literary-grief aesthetic (Le Monde diplomatique, NYT op-ed gloom); gray / desaturated cinematography.

The forbidden list MUST be included verbatim. Without the cartoon bans, Flux defaults to cartoon-bebé. Without the somber bans, Flux over-corrects to literary-melancholic gray. Both fail.

### 5. Palette (bright daylight default)

**Bright daylight naturalistic + vivid saturated** is the default for every cover. Specifically: warm amber, golden yellow, fresh sage, soft sky blue, terracotta, dusty rose. Lighting is warm and inviting — midday window light, golden hour glow, soft daylight.

NEVER muted / desaturated. NEVER sepia. NEVER chiaroscuro. NEVER somber.

This matches user preference documented in `project_cover_defaults.md`: "bright daylight via Flux, paleta custom bright/vivid, NO earthy preset (sale sepia)". Adult editorial does NOT equal literary melancholic — it equals warm contemporary illustration with realistic proportions.

### 6. Frame constraints

> Wide horizontal 16:9 landscape frame, 1536x1024 resolution. No text, no letters, no captions, no logos, no borders, no watermark.

### Provider

Provider preference: Flux. Fallback Gemini Imagen, but it rejects prompts that mention the age of minors. If the cover involves a child, use Flux.

## 6. Audio

- Multi-voice via ElevenLabs **`eleven_multilingual_v2`** by default (since 2026-05-29 — defaulted back from v3). Single-voice via the same lib for narration-only stories.
- **v3 is opt-in per voice** via `V3_WHITELIST` in `src/lib/elevenlabs.ts`. The whitelist starts empty. To promote a voice, audition it for:
  (a) "s" final intact on imperative-shaped text (Caribbean/Rioplatense s-aspiration is the failure mode)
  (b) prosody stable across a full multi-segment story
  (c) any audio tags you plan to use (`[firm]`, `[gentle]`, etc.) without regressions
  Only after passing all three, add the voiceId to `V3_WHITELIST` with notes + date.
- **Why v2 default** (inverted from v3 on 2026-05-29):
  - v3 introduced s-aspiration on Horacio (Colombian voice rendering with dropped 's' like Caribbean/Andalusian/Rioplatense). Confirmed in all v3 configurations tested (stability 0.5-0.7, with/without `[firm]`/`[matter-of-fact]` tags). Bug at the model level, not configuration.
  - v3 distorted Angela's narrator delivery (unnatural prosody on long prose).
  - The benefit of v3 audio tags ([firm] to fix imperative uptalk) is no longer needed because the writer-side rule (no bare short imperatives in dialogue — see §3) kills the uptalk at the text level before audio.
  - User hard rule: zero s-aspiration in any voice, any case. v2 default makes the artifact physically impossible.
- **v2 voice_settings**: `stability=0.9, similarity_boost=0.8, style=0, speed=0.9, use_speaker_boost=true`. The `speed=0.9` stacks with the downstream ffmpeg `atempo` post-process; render per-segment with `atempo=0.889` (not 0.80) to land at 0.80x effective without double-stretch artifacts.
- **v3 differences** (relevant only for whitelisted voices):
  - No `previous_text`/`next_text` support (request stitching disabled).
  - `stability=0.5` ("Natural" preset) to honor audio tags.
  - No `speed` field; tempo handled by ffmpeg `atempo=0.80`.
  - No SSML break tags; use punctuation for pauses.
  - Same cost per character (1 credit) on both models.
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
18. **Read-the-batch gestalt step (required when working on more than one story)**: dump the first sentences of every story in the journey side-by-side and read them as a sequence. Reject if the same opening template appears 3+ times (`opening-rhythm-rotation` check enforces this mechanically, but the human read catches subtler rhythm/tone repetition the regex can't). Anchor types to rotate through: time+place, sensory hook (smell/light/sound), weather/season, action, dialogue-immediate, character apposition, object-as-anchor. Never declare a journey "done" without doing this read.
19. Does the body avoid the narrated-thought crutches (`Se pregunta: ¿…?`, `X piensa: [aforismo]`), avoid ending on a fortune-cookie maxim, and avoid cliché beats (e.g. "the photo can't capture it")? In the batch read, confirm no single narration device or emotional beat recurs in 3+ stories (`body-inner-monologue-tell` / `body-aphoristic-closing` / `body-cliche-beat` / `motif-cross-story` enforce this).
20. **A0 only**: is the body free of B1 grammar — no present subjunctive (`aunque viva`), no `de lo que`, no `hace X tiempo que` + present? (`body-cefr-a0-grammar` fails on these.)

If 15 or more answers are `yes`, save. If fewer, revise.

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
