// /src/lib/elevenlabs.ts
import OpenAI from "openai";
import crypto from "node:crypto";
import { buildAudioSegmentsFromTranscript, type AudioSegment, type TranscriptSegment } from "@/lib/audioSegments";
import { analyzeDeliveryQuality, analyzeTranscriptQuality, type AudioQaResult } from "@/lib/audioQa";
import { alignAudioOnModal } from "@/lib/audioWordTimings";
import { getPublicObjectUrl, uploadPublicObject } from "@/lib/objectStorage";

// Default ElevenLabs voice settings used across all journey TTS calls.
//   stability=0.9        más alta que 0.8 anterior. Bajaba la incidencia
//                         de "phantom syllable" al final de la oración -
//                         el modelo autorregresivo dejaba de generar 1-2
//                         fonemas extra antes del stop. Trade-off: voces
//                         menos expresivas; aceptable para A1/A2.
//   similarity_boost=0.8 keeps each voice recognizable.
//   style=0              suppresses model-added expressive style.
//   speed=0.9            10% slower so A1/A2 learners can follow along.
//   use_speaker_boost    sharpens consonants for clearer foreign-word delivery.
export const DEFAULT_VOICE_SETTINGS = {
  // 2026-06-10: bajado de stability 0.9 / style 0 (sonaba plano/monótono,
  // el usuario lo notó en el primer render) a 0.4 / 0.3 para más emoción.
  // Trade-off: más expresivo pero menos consistente. El cache key incluye
  // settingsFingerprint, así que el cambio re-renderiza limpio.
  stability: 0.4,
  similarity_boost: 0.8,
  style: 0.3,
  speed: 0.9,
  use_speaker_boost: true,
} as const;

/** Per-voice settings override shape (mutable, unlike the `as const` defaults).
 *  Lets one render use distinct stability/style per voice; p.ej. subir
 *  stability solo a voces que respiran de más a baja estabilidad. */
export type VoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  use_speaker_boost: boolean;
};

// ── Eleven v3 (Alpha) ──────────────────────────────────────────────────
// v3 supports inline audio tags ("[firm]", "[gentle]", "[whispers]") that
// override the model's default prosody per segment. This is the structural
// fix to the v2 problem we documented in audit: v2 reliably renders short
// Spanish imperatives ("Trae los vasos de agua.") with rising intonation
// regardless of parameter tuning, because the imperative-shape-at-sentence-
// boundary triggers a baked-in upspeak bias in `eleven_multilingual_v2`.
//
// v3 differences from v2:
//   - No `previous_text` / `next_text` support (request stitching disabled).
//     Per-segment context now lives in the audio tag we inject, not in
//     surrounding-text hints.
//   - No `speed` parameter in voice_settings (tempo handled downstream by
//     `applyNarrationPostProcess` via ffmpeg `atempo`).
//   - `stability` semantics shifted: 0.5 ("Natural" preset in the UI) is
//     the sweet spot for honoring audio tags while keeping voice identity
//     stable. 0.9 ("Robust") would ignore tags. 0.0-0.3 ("Creative")
//     over-emotes.
//   - No SSML break tags; use punctuation (ellipses) for pauses.
export const ELEVENLABS_MODEL_V2 = "eleven_multilingual_v2" as const;
export const ELEVENLABS_MODEL_V3 = "eleven_v3" as const;
export type ElevenLabsModel = typeof ELEVENLABS_MODEL_V2 | typeof ELEVENLABS_MODEL_V3;

export const DEFAULT_VOICE_SETTINGS_V3 = {
  stability: 0.5,
  similarity_boost: 0.8,
  style: 0,
  use_speaker_boost: true,
} as const;

/**
 * Classify a dialogue segment and return an Eleven v3 audio tag prefix
 * (e.g. "[firm]", "[gentle]") or "" for no tag.
 *
 * The rules are rules-based (not LLM) and deliberately narrow: only target
 * the patterns we've proven trigger v2 uptalk and that v3 mishandles
 * without explicit direction. Adding tags too broadly costs nothing in
 * credits but flattens the model's natural expressive range.
 *
 * Returns empty string for narrator segments and for any text that
 * doesn't match a known problem pattern. Safe to call on every segment.
 */
function classifyAudioTag(
  segment: { speaker: string; text: string },
  language?: string
): string {
  const isNarrator = segment.speaker.toLowerCase() === "narrator";
  const text = segment.text.trim();
  if (!text || isNarrator) return "";

  const lang = (language ?? "").toLowerCase();

  if (lang === "spanish") {
    // Common Spanish tú/usted imperatives at sentence start. Tested
    // against the v2 uptalk bug on 2026-05-29: "Trae los vasos de agua."
    // and similar reliably rendered with question intonation. The
    // [firm] tag in v3 forces a declarative falling cadence.
    const SPANISH_IMPERATIVES =
      /^(Trae|Tráe|Pon|Pón|Mira|Mire|Espera|Espere|Ven|Venga|Dame|Deme|Toma|Tome|Saca|Saque|Abre|Abra|Cierra|Cierre|Lee|Lea|Habla|Hable|Ayuda|Ayúdame|Ayúdeme|Llama|Llame|Come|Coma|Bebe|Beba|Sigue|Siga|Para|Pare|Sube|Suba|Baja|Baje|Entra|Entre|Sal|Salga|Dale|Hazlo|Hazme|Dime|Anda|Ándale|Vete|Váyase|Pasa|Pase|Cuelga|Cuelgue|Coge|Coja|Agarra|Agarre|Busca|Busque|Trae|Lleva|Lleve|Deja|Deje|Quita|Quite|Apaga|Apague|Prende|Prenda|Enciende|Encienda|Cuenta|Cuente|Para|Pare|Siéntate|Siéntese|Levántate|Levántese)\s/u;
    if (SPANISH_IMPERATIVES.test(text)) return "[firm]";

    // Soft, intimate consolation / endearment moments. The [gentle] tag
    // keeps the cadence warm + slow without the over-cheerful boost that
    // softenPunctuationForTts strips when we replace `!` with `.`.
    const SPANISH_GENTLE =
      /(está\s+bien|tranquil[oa]|no\s+te\s+preocupes|todo\s+va\s+a\s+estar\s+bien)/iu;
    if (SPANISH_GENTLE.test(text)) return "[gentle]";
  }

  // Future: German, Italian, French, Portuguese rules. Add as we
  // discover voice/model interactions that need explicit direction.
  return "";
}

// Ambient bed volume (0.0-1.0). 0.10 keeps the room tone present without
// fighting the dialogue. 0.15 was a touch hot.
export const DEFAULT_AMBIENT_VOLUME = 0.10;

// Tempo applied to every narrator track via ffmpeg `atempo` (preserves pitch).
// 0.94 = 94% of original speed. History:
//   - 2026-05-15: 0.80 (initial validated default).
//   - 2026-06-01 morning: bumped to 0.856 per "aumenta 7%".
//   - 2026-06-01 afternoon: bumped again to 0.94 per "dale 10% más rápido".
//     0.856 × 1.10 ≈ 0.9416, rounded to 0.94. Near-natural speed, still slower
//     than 1.0x so A1 learners can parse without lag.
// atempo single chain valid range is [0.5, 2.0]; 0.94 is well within safe range
// for quality (no formant distortion).
export const DEFAULT_NARRATION_TEMPO = 0.94;

// Approved native-German voices for multi-character dialogue stories. All IDs
// were verified against the ElevenLabs shared library with langs=de:standard.
// Previous code labelled Ww7Sq9tx9CCOiNOwWgsx as "Carl" but that voice is
// actually Moritz Morgenstern. Banned per user feedback: Thorsten variants,
// Bark Speaker 3, Simon Sunday. Earlier American-accent picks (Liam, Sarah)
// have been retired because the gringo accent leaks through eleven_multilingual_v2.
export const GERMAN_DIALOGUE_VOICES = {
  // All native-DE. License terms verified against the ElevenLabs API:
  //   moritz, enniah → premade default voices (no notice_period, perpetual)
  //   eleonore → professional shared, 730 days (2 years, max available)
  // No US-accent voices in this set (Sarah and Liam retired).
  //
  // BANNED voices (do NOT add back):
  //   - Thorsten (Piper/Coqui, all variants); monotone "deprimente"
  //   - Bark Speaker 3; muffled / monotone
  //   - Simon Sunday (ElevenLabs); monotone "deprimente"
  //   - Sebastian "qVRpsZJDV29g1CIPzssm"; uptalk AND sounds boring /
  //     adult when used for a kid; rejected as Paul (9 yrs) in
  //     Apfelkuchen in Wedding (2026-05-14).
  //   - Gesa Tess "cllvQaMvj0ZKxH88HGEn"; solo testing, nunca usada en
  //     producción; removida 2026-05-18.
  //   - Luca "mmAbrxFQ9xjByXyBpqrK"; solo testing, nunca usada en
  //     producción; removida 2026-05-18.
  moritz:    "Ww7Sq9tx9CCOiNOwWgsx", // M middle-aged, native DE, baritone; narrator
  enniah:    "WHaUUVTDq47Yqc9aDbkH", // F middle-aged, native DE, warm; primary female
  michael:   "KSEa36Zojh7KLdIkb8Qu", // M young, native DE, "youthful + calm narrative"; preferred for teen/younger characters.
  eleonore:  "8SdTD5IMgFKT1jp7JbPC", // F middle-aged, native DE, mature narrator; "Frau" roles
  // ── Round 2 (June 2026); added for German conversational beta cast
  // (Berlin / München / Hamburg). NOTE: preview volume on these 4 is a
  // notch lower than the original 4; consider extra loudnorm headroom
  // when rendering with these voices.
  ela_calm:  "e3bIMyLemdwvh75g9Vpt", // F young, "Dry & Calm", narrative_story register
  ela_warm:  "SJJe86Va82zRzg6zi2dX", // F young, "Empathetic & Warm", conversational
  jane:      "hOBDmVrVUuqtp1I3KsIq", // F older-feeling (metadata: middle-aged), "Calm & Grounded", soft conversational
  felix:     "IQuqJPpP2hMHjjDY2QTe", // M middle-aged, "Confident", conversational; alt to Moritz timbre
  marius:    "JDXBO1etYlVlJZRMoYzH", // M young, professional, narrative_story; alt to Michael (round 3 pick)
  daniel:    "wcqN36SUOZ0EhToc2OIu", // M older-feeling (metadata: middle-aged), "Calm & Real UGC", conversational
  gjango:    "wZUI6Qb377V1PsC35d6y", // M middle-aged, native DE, calm, narrative_story; JOURNEY NARRATOR (replaces Marius, 2026-06-05). Preview level is low but loudnorm (-16 LUFS) normalizes it on render. Shared-library voice: add to the ElevenLabs account before the first render.
  // ── Round 4 (2026-06-15): approved for German "Traveler" V2 journey casting
  // (user auditioned A1/A2/B1/B2/C1/C2 in localhost player). All shared-library
  // → add each to the ElevenLabs account before the first render.
  daien:     "9iYBWBbTzTDIt6imiMxp", // F young, native DE, pleasant, narrative_story; Hanna / Nichte
  joerg:     "KVgqk9YVh0pWUJiWQN8j", // M middle-aged, native DE, confident, narrative_story; Stefan
  daniel_konv:"2EkqFDbWjmOn56BMSmts", // M middle-aged, native DE, casual conversational ("Friendly Conversationalist"); Verkäufer
  marlena:   "MTTjXkEpZepLTqO0xH0f", // F middle-aged, native DE, warm professional/conversational; Kundin
  // ── Round 5 (2026-07-07): banquillo aprobado por el usuario para el journey
  // Expat B1 (audición numerada; licencias verificadas: high_quality,
  // notice_period 730 días, ya añadidas a la cuenta). Adultos en activo
  // (regla dura: sin viejos ni niños en contenido nuevo).
  ben_de:    "MMwckqU477oQxnAk1SgA", // M middle-aged, calm natural conversational
  charlie:   "vmVmHDKBkkCgbLVIOJRb", // M middle-aged, casual real (colegas/amigos)
  ela_cheer: "NE7AIW5DoJ7lUosXV2KR", // F young, urbana y alegre (amigas Berlín)
} as const;

// Approved Spanish (LATAM) voices for multi-character dialogue stories. IDs
// verified against the ElevenLabs shared library with language=es.
// Curation principle: avoid promotional/announcer registers and theatrical
// storyteller registers. Default to conversational, intimate, audiobook-poetry
// voices that work for A1-A2 contemplative stories set in LATAM cities.
//
// BANNED voices (do NOT add back, user feedback):
//   - Cristian "F1SMDtOTbvqlHI6wVNVa" (Neutral, Warm, Confident); preview reads as
//     "narrador de fútbol" / locutor institucional, demasiado declarativo para A1
//     historias íntimas. Rejected 2026-05-28 on Domingo con papá narrator audition.
//   - Hernando "yHD4CsKkghm19ToGLJEC" (Rich and Commanding, colombian); "no suena
//     como el papá", lectura comercial/autoritaria, no paternal. Rejected 2026-05-28.
//   - El Abuelo Charlie "Yb8JGzcZyW5YYzenhRCm" (Wise-sounding, Calm); teatral, "como
//     narrador de cuentos para niños". Rejected 2026-05-28.
//   - Harold "69cPH0Ypmuc48Y3Ty25o" (Natural, Friendly, Calm, 65 yrs); buena
//     calidad pero acento se lee como venezolano, no encaja Bogotá. Rejected 2026-05-28.
//   - Salvatore "wfTWLJ20rcMqvU8gIiAB" (Natural Conversations & Storyteller, latin
//     american old); rejected 2026-05-28 on Domingo con papá audition.
//   - Aurelio "PHNjiQZ95SnMQ7rDQsXz" (Gentle and Tender, mexican old); rejected
//     2026-05-28 on Domingo con papá audition.
//   - Juan "tL5DHtPRo8KiW5xsx8yD" (Romantic and Soft, colombian middle-aged) -
//     rejected 2026-05-28 on Domingo con papá audition.
//   - Tina "lZmnvfWF4ko4J7F7QDtX" (Warm, Friendly & Conversational, peruvian
//     middle-aged); "sounds muffled / tapada". Rejected 2026-05-29 on Una pizca
//     de canela Lucía audition.
//   - Esperanza "6sefJctHkzCgLShKcnrI" (Serene and Assured, colombian middle-aged)
//    ; "yells / too loud" in v3 + stability=0.5 context. Rejected 2026-05-29 on
//     Una pizca de canela Lucía audition.
//
// Old male LATAM audition (2026-06-01, hueco "abuelo"):
//   - Benjamin "80lPKtzJMPh1vjYMUgwe" (Deep Smooth Rich, tagged mexican / es-MX)
//    ; Mislabeled. Usuario lo escuchó (2026-06-01) y dijo "es español de España".
//     Recordatorio estructural: el accent tag de ElevenLabs lo pone el creador
//     y no se verifica. Ver feedback_elevenlabs_accent_unreliable.md.
//
// Rioplatense audition (2026-06-01, El control no funciona Beatriz + Mateo):
//   - Andrea "CDrROTHWaKY3O9vD3F3t" (Calm Balanced Didactic, argentine F middle-aged)
//    ; Rejected 2026-06-01 on Beatriz audition.
//   - Argie "arMlPrYpUo1XH5F2zM6R" (Warm Argentine Female, F middle-aged)
//    ; Rejected 2026-06-01 on Beatriz audition.
//   - Zeta "8Nz6hV5TPv151P6ZNEBV" (Calm Clear Authoritative, argentine F middle-aged)
//    ; Rejected 2026-06-01 on Beatriz audition.
//   - Lisandro "nnTkGIqnpqpdIrWbRAtF" (Mellow and Suave, argentine M young)
//    ; Rejected 2026-06-01 on Mateo audition.
//   - Bautista "Hw05DSJqSd5iZ9AswbcE" (Smooth and Articulated, argentine M young)
//    ; Rejected 2026-06-01 on Mateo audition.
//   - Facundo "qnvusyIjzlSoWYJ0C2Nm" (Rhythmic and Expressive, argentine M young)
//    ; Rejected 2026-06-01 on Mateo audition.
//   - Eduardo "hWlKHuPiFgEVc4rtnFfm" (Natural Warm Professional, argentine M middle-aged)
//    ; Rejected 2026-06-01 on Mateo audition.
//   - Lucas "xcAUMhbpNX2WRGsuhjFy" (Solemn and calm, argentine M middle-aged)
//    ; Rejected 2026-06-01 on Mateo audition.
//
// SPAIN-ONLY voices (do NOT use for LATAM stories; reserve for future Spain
// catalog when we add Iberian Spanish journeys):
//   - Isabel "56yWreYpxeKhcXjVscuF" (Nurturing and poised, tagged latin american
//     but actually Spain-Spanish accent; distinción c/z=θ, l alveolar). Strong
//     candidate for future Spain F middle-aged roles. Identified 2026-05-29.
export const SPANISH_DIALOGUE_VOICES = {
  // Core LATAM neutral + Colombian (original cast)
  angela:    "Po9nYFo9ScA7odSuQLIW", // F middle-aged, latin american, mature warm; narrator (poetry/documentary register)
  horacio:   "57D8YIbQSuE3REDPO6Vm", // M middle-aged, colombian, natural+warm "safe & reliable"; older paternal male (don Hernán-type)
  luna:      "1ZhMG5ZZgJ6XpkOrB8Az", // F young, colombian, conversational warm friendly; adult-young female (Marina-type)
  alma:      "3ttovAt5bt3Kk38UGIob", // F middle-aged, latin american (neutral), conversational warm; adult female sibling/peer
  // Argentine / rioplatense
  nieve:     "nAFxIJGj7iSTeltygOfB", // F old, argentine; acento CORDOBÉS (Córdoba, AR), verificado al oído por el usuario 2026-06-09 (NO porteño). Abuela mayor / Doña Sara. Ojo si la escena exige acento porteño de Buenos Aires.
  paola:     "PoLFkTquRWtbexdwW3Xa", // F middle-aged, argentine, professional neutral versatile; madre/tía rioplatense ~45-55
  mariana:   "9rvdnhrYoXoUt4igKpBw", // F middle-aged, argentine, intimate + assertive, deep clear emotional; peso emocional rioplatense
  renzo:     "acHf5gp7AGOY30tJjvD4", // M young, argentine, bold + urban, modern street-smart; hombre rioplatense joven ~25-35
  roma:      "6Mo5ciGH5nWiQacn5FYk", // F middle-aged, argentine, casual conversational; peer rioplatense (added 2026-06-01 round)
  // Mexican (added 2026-06-01)
  ana_sofia: "ewn5JTa3lNPY8QVuZJi6", // F young, mexican, casual conversational; joven adulta MX
  cindy:     "pBabaO9WxfrjXjKADHma", // F young, mexican; RECHAZADA 2026-06-10 (sonó muy mal al oído). NO reusar.
  zetian:    "P5kgBjTRY5DDGaw8gXLc", // F young, mexican; RECHAZADA 2026-06-10 ("no me convence" al oído). NO reusar.
  ana_maria: "m7yTemJqdIqrcNleANfX", // F young, mexican (es-MX), calm/natural/clear; Renata (CDMX) + Itzel (Oaxaca). Elegida 2026-06-10 tras A/B en la línea real (ganó a cindy/zetian/camila).
  emilio:    "DV9FrN0pQkPWIoxW5dvT", // M middle-aged, mexican, calm informative; papá/tío MX
  patricio:  "77K94gl6ZCRVTHG8Gi1w", // M middle-aged, mexican, pleasant social-media; alternativa MX middle
  tom:       "p1Q3ihQuPjyyENa1RGtl", // M young, mexican, kind sincere calm; hijo/teen MX
  // Chilean (added 2026-06-01)
  catalina:  "6Gr4AVmTax1pMJO0lHRK", // F young, chilean, professional conversational; joven adulta CL
  angela_cl: "prblQcKOdF08ozhxP2mk", // F middle-aged, chilean, calm warm; mamá CL
  vicente:   "6WgXEzo1HGn3i7ilT4Fh", // M young, chilean, confident; joven adulto CL
  // Peruvian (added 2026-06-01)
  elena:     "dyTONAae6PhdRb3hMKPM", // F middle-aged, peruvian, versátil natural cercana; mamá Lima
  joselo:    "UK00oAtGYBrHBUbesfMv", // M middle-aged, peruvian, confident informative; papá/tío Lima
  // Mature female fill (added 2026-06-09, user-approved from shared library to
  // resolve same-story voice collisions: Lupita was sharing ana_sofia with
  // Sofía; Doña Rosa was sharing the narrator voice angela). Accent tags are
  // creator-set and not verified by ear; confirm in audition before relying.
  andreti:     "JW8DGEuLp9WxIS5IdxMM", // M ~50, latin american neutral, calm; NARRATOR del journey spanish-latam (elegido 2026-06-09, reemplaza a Angela). Las 3 stories viejas (La fonda, Alguien pregunta, El departamento nuevo) quedan con Angela hasta re-render.
  azu:         "D3ws14YxTqcjPaXEOehR", // F old, mexican, calm soft melodic; señora mayor MX (Lupita)
  maria_blanco:"HRi5Prm2B3PevwpDmVLP", // F old, colombian, airy rich pleasant; abuela/señora mayor CO (spare, no role yet)
  lina_botero: "SnspHxfVcWQjJgnp6SL3", // F middle-aged, colombian, calm emotional; vecina/madre CO (Doña Rosa)
  // 7-theme restructure voice bank (added 2026-06-09, user-approved al oído
  // del preview; accent = tag del creador, no verificado más allá del timbre).
  // Para temas nuevos: Lima/Perú, Cartagena/Colombia, Oaxaca/México.
  sabina:    "wnQAQM2xwHFeVXM7PQOq", // F adult, peruvian, calm refined; Lima
  terry:     "ulJB4yAMefhHYn0FWgGy", // M young, peruvian, gentle narration; Lima
  carito:    "J8BF9c7OgbHiqagCNoEj", // F young, colombian, gentle conversational; Cartagena
  valentina: "CUpuXTxjB4hhpAJNei6V", // F young, colombian, casual calm; Cartagena
  juan:      "beQfcCW5PgdTQs4cETaz", // M young, colombian, natural conversation; Cartagena
  esme:      "dZtUsFRKkioPsu9syJF6", // F middle-aged, mexican, crisp; Oaxaca / llena el hueco mid-F MX
} as const;

// v3 voice WHITELIST. v2 is the safe default for every voice; v3 is
// opt-in PER VOICE after explicit user audition confirming no
// regressions (s-aspiration, distortion on prose, off-register
// renders, etc).
//
// Why v2 default + v3 whitelist (inverted 2026-05-29):
// - v3 introduced s-aspiration on Horacio (Caribbean/Rioplatense
//   accent leak on a Colombian voice); confirmed by user A/B test on
//   "Trae los vasos de agua." in v3 stability=0.5, 0.7, with/without
//   `[firm]` and `[matter-of-fact]` tags. All variants aspirated.
// - v3 distorted Angela's narrator delivery; confirmed earlier same day.
// - The benefit of v3 audio tags ([firm] to fix imperative uptalk) is
//   no longer needed: the writer-side rule (no bare short imperatives
//   in dialogue, enforced by validator + spec + worker prompt) kills
//   the uptalk at the text level, BEFORE audio. So v3 lost its main
//   structural justification.
// - User hard rule: zero s-aspiration in any voice, any case. Defaulting
//   to v2 makes the s-aspiration physically impossible.
//
// To promote a voice to v3, audition it carefully on:
// (a) imperative-shaped text (does s stay clean?)
// (b) a full multi-segment story (does prosody drift across segments?)
// (c) the specific audio tags you plan to use ([firm], [gentle], etc).
// Only after passing all three, add to V3_WHITELIST below.
export const V3_WHITELIST: ReadonlySet<string> = new Set<string>([
  // Empty until each voice is explicitly audited and approved.
  // Format: "voiceId", // Voice Name; audition notes + date
]);

export function pickModelForVoice(
  voiceId: string,
  fallback: ElevenLabsModel
): ElevenLabsModel {
  // Whitelist override: voice explicitly approved for v3 wins.
  if (V3_WHITELIST.has(voiceId)) return ELEVENLABS_MODEL_V3;
  // Otherwise: v2 is the safe default regardless of what the caller
  // passed. Callers that REALLY need v3 for a non-whitelisted voice
  // must add it to the whitelist (which requires audition).
  return ELEVENLABS_MODEL_V2;
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function normalizeLanguageName(value?: string): string {
  const raw = (value ?? "English").trim().toLowerCase();
  if (!raw) return "English";

  const aliases: Record<string, string> = {
    english: "English",
    spanish: "Spanish",
    german: "German",
    italian: "Italian",
    french: "French",
    français: "French",
    francais: "French",
    portuguese: "Portuguese",
    português: "Portuguese",
    portugues: "Portuguese",
  };

  return aliases[raw] ?? `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
}

function normalizeRegionName(value?: string): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "default";

  const aliases: Record<string, string> = {
    colombia: "colombia",
    mexico: "mexico",
    méxico: "mexico",
    argentina: "argentina",
    peru: "peru",
    perú: "peru",
    germany: "germany",
    deutschland: "germany",
    italy: "italy",
    italia: "italy",
    france: "france",
    francia: "france",
    brazil: "brazil",
    brasil: "brazil",
    portugal: "portugal",
  };

  return aliases[raw] ?? raw;
}

function selectVoiceId(candidates: string[], seed: string): string {
  if (candidates.length === 0) {
    throw new Error("No voice candidates provided");
  }
  if (candidates.length === 1) return candidates[0];
  return candidates[hashSeed(seed) % candidates.length];
}

export function buildAudioNarrationText(title: string, storyText: string): string {
  const plainTitle = title.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const plainStory = storyText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const titleWithPause =
    plainTitle.length === 0
      ? ""
      : /[.!?…:]$/.test(plainTitle)
        ? plainTitle
        : `${plainTitle}.`;

  if (!titleWithPause) return plainStory;
  if (!plainStory) return titleWithPause;

  return `${titleWithPause}\n\n${plainStory}`;
}

export async function generateAndUploadAudio(
  storyText: string,
  title: string,
  language?: string,
  region?: string,
  // 2026-07-07: la historia puede fijar su narrador (JourneyStory.voiceId).
  // Sin esto, la selección caía SIEMPRE al pool default del idioma y el
  // voiceId elegido por el usuario se ignoraba en silencio (bug FR A0:
  // historia 1 salió con "Marie" y la 2 con "Alexandre" en vez de las
  // voces aprobadas). El override gana; el pool queda como fallback.
  voiceIdOverride?: string
): Promise<{
  url: string;
  filename: string;
  assetId: string | null;
  audioSegments: AudioSegment[];
  audioQa: AudioQaResult;
  voiceId: string;
} | null> {
  try {
    // 🔹 El audio debe narrar primero el título, luego hacer una pausa y empezar la historia.
    const narrationText = buildAudioNarrationText(title, storyText);

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error("[elevenlabs] ❌ Missing ELEVENLABS_API_KEY");
      return null;
    }

    // 🔊 Selección automática de voz según idioma y región
    const voicesByLangRegion: Record<string, Record<string, string[]>> = {
      Spanish: {
        colombia: ["b2htR0pMe28pYwCY9gnP"], // Sofía (Colombia)
        mexico: ["htFfPSZGJwjBv1CL0aMD"], // Antonio (México)
        argentina: ["p7AwDmKvTdoHTBuueGvP"], // Malena (Argentina)
        peru: ["JddqVF50ZSIR7SRbJE6u"], // Valeria (LATAM)
        default: ["JddqVF50ZSIR7SRbJE6u"],
      },
      German: {
        germany: ["Ww7Sq9tx9CCOiNOwWgsx"], // Carl
        default: ["Ww7Sq9tx9CCOiNOwWgsx"], // Carl
      },
      English: {
        default: ["21m00Tcm4TlvDq8ikWAM"], // Rachel
      },
      Italian: {
        italy: ["W71zT1VwIFFx3mMGH2uZ"], // Marcotrox
        default: ["gfKKsLN1k0oYYN9n2dXX"], // Violetta
      },
      French: {
        france: [
          "sANWqF1bCMzR6eyZbCGw", // Marie
          "kENkNtk0xyzG09WW40xE", // Marcel
          "IPgYtHTNLjC7Bq7IPHrm", // Alexandre
        ],
        default: [
          "sANWqF1bCMzR6eyZbCGw", // Marie
          "kENkNtk0xyzG09WW40xE", // Marcel
          "IPgYtHTNLjC7Bq7IPHrm", // Alexandre
        ],
      },
      Portuguese: {
        brazil: ["aU2vcrnwi348Gnc2Y1si"], // José
        portugal: ["5tqq6ewvJtcNtaffrqUJ"], // Duarte
        default: ["aU2vcrnwi348Gnc2Y1si", "5tqq6ewvJtcNtaffrqUJ"],
      },
    };

    // Normalizar idioma y región
    const normalizedLang = normalizeLanguageName(language);
    const normalizedRegion = normalizeRegionName(region);

    // Seleccionar voz
    const voiceCandidates =
      voicesByLangRegion[normalizedLang]?.[normalizedRegion] ||
      voicesByLangRegion[normalizedLang]?.default ||
      voicesByLangRegion.English.default;
    const selectedVoice = voiceIdOverride?.trim()
      ? voiceIdOverride.trim()
      : selectVoiceId(voiceCandidates, `${normalizedLang}:${normalizedRegion}:${title}`);

    console.log(
      `[elevenlabs] 🎙 Using voice ${selectedVoice} for ${normalizedLang} (${normalizedRegion})`
    );

    // 🧠 Llamar a ElevenLabs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: softenPunctuationForTts(narrationText),
          model_id: "eleven_multilingual_v2",
          voice_settings: DEFAULT_VOICE_SETTINGS,
          // Deletrea números/fechas en el idioma (horas, cantidades) en vez de
          // dejarlos en "auto"; junto al separado de códigos alfanuméricos
          // arregla el audio cuando hay números.
          apply_text_normalization: "on",
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("[elevenlabs] ❌ Error generating audio:", errText);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);
    const buffer = await normalizeLoudness(rawBuffer);
    // 📁 Crear nombre de archivo seguro
    const filename = `${filenameFromTitle(title)}_${Date.now()}.mp3`;
    const transcription = await transcribeAudioSegments(buffer, filename, narrationText);
    const audioQa = analyzeTranscriptQuality(narrationText, transcription.transcriptText);

    console.log("[elevenlabs] ⬆ Uploading audio...");

    const uploaded = await uploadPublicObject({
      key: `media/generated/audio/${filename}`,
      body: buffer,
      contentType: "audio/mpeg",
    });

    if (uploaded?.url) {
      console.log("[elevenlabs] ✅ Audio uploaded to object storage:", filename, "→", uploaded.url);

      return {
        url: uploaded.url,
        filename,
        assetId: null,
        audioSegments: transcription.audioSegments,
        audioQa,
        voiceId: `elevenlabs/${selectedVoice}`,
      };
    }

    console.warn("[elevenlabs] R2 upload returned null; object storage may be unconfigured.");
    return null;
  } catch (err) {
    console.error("[elevenlabs] 💥 Failed to generate/upload audio:", err);
    return null;
  }
}

// Best-effort loudness normalization via ffmpeg's dynaudnorm + loudnorm
// filters. dynaudnorm smooths volume between speaker segments inside a single
// file; loudnorm hits a podcast-standard target so all stories sit at the same
// listening level. If ffmpeg isn't available in the runtime (e.g. some
// serverless environments) we log and return the original buffer so audio
// generation still succeeds.
export async function normalizeLoudness(buffer: Buffer): Promise<Buffer> {
  try {
    const { writeFile, mkdtemp, rm, readFile } = await import("fs/promises");
    const { tmpdir } = await import("os");
    const path = await import("path");
    const { spawn } = await import("child_process");

    const dir = await mkdtemp(path.join(tmpdir(), "loudnorm-"));
    try {
      const inPath = path.join(dir, "in.mp3");
      const outPath = path.join(dir, "out.mp3");
      await writeFile(inPath, buffer);
      await new Promise<void>((resolve, reject) => {
        const proc = spawn("ffmpeg", [
          "-y",
          "-loglevel", "error",
          "-i", inPath,
          "-af", "dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5",
          "-codec:a", "libmp3lame",
          "-b:a", "128k",
          outPath,
        ]);
        let stderr = "";
        proc.stderr.on("data", (c) => { stderr += c.toString(); });
        proc.on("error", reject);
        proc.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 300)}`));
        });
      });
      return await readFile(outPath);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (err) {
    console.warn("[elevenlabs] loudness normalization skipped:", err instanceof Error ? err.message : err);
    return buffer;
  }
}

// Some ElevenLabs voices over-emote on exclamation marks, treating "!" as a
// strong cue for cheerfulness or animation. For language-learning A1/A2
// stories the result sounds fake. This softener flattens "!" to "." before
// TTS while preserving "?" (we want question intonation). The original story
// text in the DB is not touched; this only affects the audio layer.
// Códigos alfanuméricos (B244, A12, sala 305B) los TTS los leen mal: intentan
// interpretarlos como una palabra/número raro. Los separamos char-a-char para
// que, con apply_text_normalization="on", cada letra se lea como letra y cada
// dígito por separado ("B244" → "B 2 4 4" → "be dos cuatro cuatro"). Exigimos
// >=2 dígitos para no tocar unidades tipo "m2"/"km2".
function spaceOutAlphanumericCodes(text: string): string {
  return text.replace(
    /\b([A-Za-zÀ-ÿ]{1,3}\d{2,4}|\d{2,4}[A-Za-zÀ-ÿ]{1,3})\b/g,
    (match) => match.split("").join(" ")
  );
}

export function softenPunctuationForTts(text: string): string {
  return spaceOutAlphanumericCodes(
    text.replace(/!+/g, ".").replace(/\.{2,}/g, ".")
  );
}

// Parses a story body that opens with a narrator paragraph and then has
// "Speaker: line" turns into a list of segments tagged with the speaker name.
// Multi-paragraph narrator blocks are merged. Empty lines are dropped.
export type DialogueSegment = { speaker: string; text: string };

const SPEAKER_LABEL_REGEX =
  /^\s*([\p{Lu}][\p{L}\p{M}.'-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'-]*){0,3})\s*:\s+(.*\S)\s*$/u;

export function parseDialogueSegments(storyText: string): DialogueSegment[] {
  const cleaned = storyText.replace(/<[^>]+>/g, " ");
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim());
  const segments: DialogueSegment[] = [];
  let narratorBuffer: string[] = [];
  const flushNarrator = () => {
    if (narratorBuffer.length === 0) return;
    const text = narratorBuffer.join(" ").replace(/\s+/g, " ").trim();
    if (text) segments.push({ speaker: "narrator", text });
    narratorBuffer = [];
  };
  // A blank line ends a narrator PARAGRAPH (2026-07-09). It used to be skipped
  // outright, so narrated prose collapsed into ONE segment — and since the gap
  // (DIALOGUE_GAP_SEC) is inserted BETWEEN segments, a narrator story got no
  // paragraph pauses at all and ran on breathlessly. Multi-voice never showed it:
  // every turn is its own segment, so it got its gaps for free.
  //
  // The flush is GUARDED on sentence-final punctuation, and that guard is the
  // point: splitting on blank lines alone would be trusting the text to be
  // well-formed. It is today (measured: 161/161 segments across every
  // single-voice story end on closing punctuation), but a stray blank line mid
  // sentence would silently cut narration in half and nobody would notice until
  // they heard it. If the buffer is not at a sentence end, the blank line is
  // treated as a soft wrap and the paragraph keeps accumulating — so a mid
  // sentence split is impossible by construction, not by luck.
  // `\s*` before the closing quote is not cosmetic: French typography puts a
  // space before the guillemet (`... oui. »`), so a tight regex would fail to
  // see the sentence end, skip the flush, and silently merge French paragraphs
  // back into one segment — reintroducing this very bug for fr stories.
  const SENTENCE_END = /[.!?…‽⁇⁉]\s*["»”’)\]]*$/u;
  const flushParagraph = () => {
    if (narratorBuffer.length === 0) return;
    const sofar = narratorBuffer.join(" ").replace(/\s+/g, " ").trim();
    if (!SENTENCE_END.test(sofar)) return; // mid-sentence: not a real paragraph break
    flushNarrator();
  };
  for (const line of lines) {
    if (!line) { flushParagraph(); continue; }
    const m = line.match(SPEAKER_LABEL_REGEX);
    if (m) {
      flushNarrator();
      segments.push({ speaker: m[1].trim(), text: m[2].trim() });
    } else {
      narratorBuffer.push(line);
    }
  }
  flushNarrator();
  return segments;
}

// Per-segment cache key for the multi-voice pipeline. Hashing (voiceId,
// softened text, voice settings hash) means swapping a single character's
// voice in a story re-generates only that character's segments; the
// narrator and other speakers serve from R2 for free.
//
// Sufijos del key (versionados para invalidar cache cuando cambia el
// pipeline):
//   trim-v1: silenceremove para clicks/breaths.
//   trim-v2: stability 0.9 + previous_text/next_text + end-trim 60ms
//            para "phantom syllable".
//   trim-v3: trim por alineación forzada (aeneas en Modal). Reemplaza
//            silenceremove + end-trim duro: corta exactamente al final
//            de la última palabra alineada + 30 ms de margen, content-
//            aware en lugar de threshold-based. Si Modal align falla,
//            cae al pipeline trim-v2 como fallback.
function multivoiceSegmentCacheKey(
  voiceId: string,
  softenedText: string,
  model: ElevenLabsModel = ELEVENLABS_MODEL_V2,
  settingsOverride?: VoiceSettings,
  disableStitching?: boolean
): string {
  const settings =
    settingsOverride ??
    (model === ELEVENLABS_MODEL_V3 ? DEFAULT_VOICE_SETTINGS_V3 : DEFAULT_VOICE_SETTINGS);
  const settingsFingerprint = JSON.stringify(settings);
  // Model is in the fingerprint so v2 and v3 renders of the same text
  // never collide in the cache (the same speaker + line produces
  // perceptually different audio across model versions).
  const hash = crypto
    .createHash("sha256")
    // trim-v6 (2026-06-10): bump para invalidar segmentos cacheados con el
    // trim heurístico (fallback cuando STUDIO_AUDIO_TOKEN estaba vacío → dejaba
    // respiros de cola). Ya con el token puesto, re-genera + re-recorta con el
    // align preciso (aeneas en Modal).
    // trim-v7 (2026-06-11): el stitching (previous_text/next_text) hace que
    // ElevenLabs meta una INHALACIÓN en la costura entre turnos (anticipa el
    // next_text como si fuera a seguir hablando). El align no la agarra porque
    // está pegada, no en el borde exacto. Ahora el stitching va en el key
    // (`-nostitch` cuando está apagado) porque cambia el audio de verdad; sin
    // esto, un render sin stitching reusaría el segmento con aire cacheado.
    // -noprev (2026-06-11): disableStitching ahora apaga SOLO previous_text y
    // mantiene next_text=" " (suprime el respiro de cola). Sufijo nuevo para
    // no reusar los segmentos "-nostitch" previos (next_text apagado del todo)
    // que dejaban exhalación al final de las preguntas.
    .update(
      `${voiceId}|${model}|${settingsFingerprint}|${softenedText}|trim-v7${
        disableStitching ? "-noprev" : ""
      }`
    )
    .digest("hex")
    .slice(0, 24);
  return `media/multivoice-segments/${hash}.mp3`;
}

/**
 * Recorta el segmento exactamente al final de la última palabra
 * alineada (+30 ms de margen) y al inicio de la primera (-50 ms).
 * Solución content-aware al phantom-syllable: no depende de threshold
 * de silencio porque el artefacto es VOCAL, no silencio.
 *
 * Flujo:
 *  1. Sube el buffer a R2 con la cache key del segmento (necesario
 *     para que aeneas tenga una URL pública).
 *  2. Llama a `alignAudioOnModal` con el texto plano + idioma.
 *  3. Lee `firstWord.startSec` y `lastWord.endSec`.
 *  4. ffmpeg atrim al rango exacto.
 *  5. Re-sube el buffer recortado a la misma cache key (overwrite).
 *
 * Devuelve el buffer recortado, o `null` si la alineación falló (el
 * caller cae al trim heurístico viejo). Idempotente: ejecutarla 2
 * veces sobre el mismo segmento devuelve audio equivalente.
 */
async function alignTrimSegment(args: {
  rawBuffer: Buffer;
  plainText: string;
  language: string;
  cacheKey: string;
}): Promise<Buffer | null> {
  const { rawBuffer, plainText, language, cacheKey } = args;

  // 1. Upload raw para que aeneas pueda leerlo via URL pública.
  try {
    await uploadPublicObject({
      key: cacheKey,
      body: rawBuffer,
      contentType: "audio/mpeg",
    });
  } catch (err) {
    console.warn(`[elevenlabs] align upload-raw failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
  const audioUrl = getPublicObjectUrl(cacheKey);
  if (!audioUrl) {
    console.warn("[elevenlabs] align skipped: cache URL not resolvable");
    return null;
  }

  // 2. Aeneas align.
  let tokens;
  try {
    const result = await alignAudioOnModal({ audioUrl, plainText, language });
    tokens = result.tokens;
  } catch (err) {
    console.warn(`[elevenlabs] aeneas align failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
  if (!tokens || tokens.length === 0) {
    console.warn("[elevenlabs] aeneas returned 0 tokens");
    return null;
  }

  // 3. Compute trim window. Margen 50 ms al inicio (para no cortar
  // la primera consonante) y 8 ms al final. El +8 ms (antes +30 ms)
  // mata la "phantom syllable": el modelo autorregresivo encadena 1-2
  // fonemas del próximo token justo después de lastEnd; los +30 ms de
  // "breath" que dejábamos contenían ese arranque y lo hacían audible
  // ("como si el personaje siguiera hablando"). Cortar casi pegado a
  // lastEnd lo elimina, y es seguro porque aeneas alinea el clip
  // AISLADO → el fin de la última palabra es preciso (no clippea habla).
  // La pausa de 0.45 s entre turnos ya da el espaciado natural.
  const firstStart = tokens[0]?.startSec;
  const lastEnd = tokens[tokens.length - 1]?.endSec;
  if (typeof lastEnd !== "number" || !Number.isFinite(lastEnd) || lastEnd <= 0) {
    console.warn("[elevenlabs] aeneas missing endSec for last token");
    return null;
  }
  const trimStartSec = Math.max(0, (typeof firstStart === "number" ? firstStart : 0) - 0.05);
  const trimEndSec = lastEnd + 0.008;

  // 4. ffmpeg atrim + re-encode (192 kbps libmp3lame igual que la
  // pasada anterior). asetpts para resetear timestamps y que el
  // concat demuxer no se queje del PTS.
  const { writeFile, mkdtemp, rm, readFile } = await import("fs/promises");
  const { tmpdir } = await import("os");
  const path = await import("path");
  const { spawn } = await import("child_process");

  const dir = await mkdtemp(path.join(tmpdir(), "align-trim-"));
  let trimmedBuffer: Buffer;
  try {
    const inPath = path.join(dir, "in.mp3");
    const outPath = path.join(dir, "out.mp3");
    await writeFile(inPath, rawBuffer);
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", [
        "-y",
        "-loglevel", "error",
        "-i", inPath,
        "-af",
        `atrim=start=${trimStartSec.toFixed(3)}:end=${trimEndSec.toFixed(3)},asetpts=PTS-STARTPTS`,
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        outPath,
      ]);
      let stderr = "";
      proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg align-trim exit ${code}: ${stderr.slice(0, 400)}`));
      });
    });
    trimmedBuffer = await readFile(outPath);
  } catch (err) {
    console.warn(`[elevenlabs] align-trim ffmpeg failed: ${err instanceof Error ? err.message : err}`);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }

  // 5. Re-upload trimmed to the same cache key (overwrite the raw).
  try {
    await uploadPublicObject({
      key: cacheKey,
      body: trimmedBuffer,
      contentType: "audio/mpeg",
    });
  } catch (err) {
    console.warn(`[elevenlabs] align upload-trimmed failed: ${err instanceof Error ? err.message : err}`);
    // No es fatal; devolvemos el buffer recortado de todos modos; la
    // cache va a quedar con el raw, próxima vez se re-genera.
  }
  return trimmedBuffer;
}

// Pasa el buffer del segmento por dos limpiezas en cascada:
//
// 1. `silenceremove` con threshold -45 dB / duración mínima 50 ms en
//    ambos extremos. Quita el silencio inicial con click de attack, y
//    la cola con breaths/vocal-fry/mouth-clicks que `eleven_multilingual_v2`
//    encadena al final de la oración.
//
// 2. End-trim duro de 60 ms via `areverse → atrim → asetpts → areverse`.
//    Esto recorta contenido aunque NO sea silencio; es el único modo
//    de matar la "phantom syllable" donde el modelo autorregresivo
//    genera 1-2 fonemas del próximo token antes del stop signal.
//    silenceremove con threshold normal no lo toca porque es vocal.
//    60 ms es agresivo pero deja intacta la última sílaba en speed=0.9
//    (~70-90 ms por fonema final). Si recorta demasiado, ajustar a 40 ms.
//
// Re-encoda a 192 kbps (mismo bitrate que sirve el endpoint TTS) así el
// concat posterior no muestra discontinuidades de bitstream.
async function trimSegmentArtifacts(buffer: Buffer): Promise<Buffer> {
  const { writeFile, mkdtemp, rm, readFile } = await import("fs/promises");
  const { tmpdir } = await import("os");
  const path = await import("path");
  const { spawn } = await import("child_process");

  const dir = await mkdtemp(path.join(tmpdir(), "trim-"));
  try {
    const inPath = path.join(dir, "in.mp3");
    const outPath = path.join(dir, "out.mp3");
    await writeFile(inPath, buffer);
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", [
        "-y",
        "-loglevel", "error",
        "-i", inPath,
        "-af",
        // SOLO cola. El start-trim se eliminó: pruebas offline mostraron
        // que CUALQUIER `silenceremove` al inicio recorta ~150-200 ms sin
        // importar el umbral (-45dB/-50dB/-60dB/-65dB peak), porque su
        // ventana RMS arrastra el onset suave (fricativas "Sch-/S-/F-",
        // vocales abiertas) por debajo del umbral → se comía la primera
        // palabra de cada turno. Sin start-trim el onset queda intacto; el
        // pequeño silencio inicial que a veces añade ElevenLabs es inocuo
        // (y la pausa de 0.45s entre turnos ya da el espaciado). La cola
        // (stop, -45dB) + el end-trim duro siguen matando breaths y la
        // phantom syllable final.
        "silenceremove=" +
          "stop_periods=-1:stop_duration=0.05:stop_threshold=-45dB," +
          // Pasada 2: end-trim duro de 60 ms vía reverse-trim-reverse.
          "areverse,atrim=start=0.06,asetpts=PTS-STARTPTS,areverse",
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        outPath,
      ]);
      let stderr = "";
      proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg trim exit ${code}: ${stderr.slice(0, 400)}`));
      });
    });
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function ttsSegment(args: {
  text: string;
  voiceId: string;
  apiKey: string;
  /** Texto del segmento previo (mismo voiceId o no). Le da al modelo
   *  contexto histórico para que la prosodia inicial encaje con lo
   *  ya dicho. Limit ~500 chars; sino el modelo se distrae.
   *  IGNORADO en eleven_v3 (no soporta request stitching). */
  previousText?: string;
  /** Texto del próximo segmento. Le indica al modelo dónde termina
   *  exactamente el segmento actual; sin esto, eleven_multilingual_v2
   *  a veces genera 1-2 fonemas del siguiente token (la "phantom
   *  syllable" reportada). Pasar incluso un espacio o "." ayuda.
   *  IGNORADO en eleven_v3 (no soporta request stitching). */
  nextText?: string;
  /** Idioma del segmento (para el aeneas align). Si no se pasa, el
   *  align trim se salta y el segmento sale solo con el silenceremove
   *  + end-trim heurístico viejo. */
  language?: string;
  /** Modelo de TTS. Default v2 (legacy compat). v3 habilita audio tags
   *  inline en el texto, pero omite previous_text/next_text porque el
   *  endpoint no los soporta. */
  model?: ElevenLabsModel;
  /** Per-voice settings override. Default: DEFAULT_VOICE_SETTINGS (v2) /
   *  DEFAULT_VOICE_SETTINGS_V3 (v3). Va en el cache key. */
  voiceSettings?: VoiceSettings;
  /** Apaga previous_text en v2 (driver de la inhalación de costura) y fija
   *  next_text=" " (boundary que suprime el respiro de cola). Para diálogo
   *  multi-voz donde cada turno es otro hablante. Va en el cache key
   *  (`-noprev`). */
  disableStitching?: boolean;
}): Promise<Buffer | null> {
  const model = args.model ?? ELEVENLABS_MODEL_V2;
  const softened = softenPunctuationForTts(args.text);

  // Cache lookup: same voice + same model + same text (after softening) +
  // same voice settings → reuse the previously generated MP3 from R2
  // instead of paying ElevenLabs again.
  // Nota: previousText/nextText NO van en la cache key. Cambiarlos
  // produciría un audio ligeramente distinto pero no significativamente
  //; y meterlos rompería la propiedad "regenero solo lo que cambió".
  const cacheKey = multivoiceSegmentCacheKey(args.voiceId, softened, model, args.voiceSettings, args.disableStitching);
  const cacheUrl = getPublicObjectUrl(cacheKey);
  if (cacheUrl) {
    try {
      const head = await fetch(cacheUrl, { method: "HEAD" });
      if (head.ok) {
        const get = await fetch(cacheUrl);
        if (get.ok) {
          console.log(`[elevenlabs] segment cache hit ${cacheKey}`);
          return Buffer.from(await get.arrayBuffer());
        }
      }
    } catch {
      // Cache lookup failed (network, etc.). Fall through to fresh generation.
    }
  }

  const voiceSettings =
    args.voiceSettings ??
    (model === ELEVENLABS_MODEL_V3 ? DEFAULT_VOICE_SETTINGS_V3 : DEFAULT_VOICE_SETTINGS);
  const requestBody: Record<string, unknown> = {
    text: softened,
    model_id: model,
    voice_settings: voiceSettings,
  };
  if (model !== ELEVENLABS_MODEL_V3) {
    // Deletrea números/fechas en el idioma en vez de "auto". Scoped a no-v3
    // (v2/turbo/flash) para no arriesgar en v3.
    requestBody.apply_text_normalization = "on";
    // v2: previous_text/next_text dan al modelo contexto de los turnos
    // vecinos. Los dos efectos son OPUESTOS y hay que tratarlos por separado
    // (aprendido a oído el 2026-06-11):
    //
    //  · previous_text (turno anterior real) → el modelo sintetiza el
    //    segmento como si VINIERA hablando, y mete una INHALACIÓN audible
    //    al arranque/costura. Es el "aire" reportado. `disableStitching`
    //    lo APAGA. En diálogo multi-voz el turno anterior es otro hablante,
    //    así que ese contexto ni siquiera es prosódicamente correcto.
    //
    //  · next_text → boundary signal. Si vale " " (boundary mínimo) SUPRIME
    //    el respiro/phantom de COLA. Si vale el próximo turno real, el modelo
    //    "se prepara para seguir" y deja una exhalación. Por eso lo fijamos
    //    SIEMPRE a " " cuando hay disableStitching: corta la cola sin reñir
    //    con el inicio. (Apagar next_text del todo reintroduce el respiro de
    //    cola; visto en la línea "¿...lleva un mole?").
    if (!args.disableStitching) {
      const prev = args.previousText?.trim();
      if (prev) requestBody.previous_text = prev.slice(-500);
    }
    requestBody.next_text = args.disableStitching
      ? " "
      : args.nextText?.trim()
        ? args.nextText.trim().slice(0, 500)
        : " ";
  }
  // v3: no previous_text/next_text (request stitching disabled). En su
  // lugar el caller pre-prepends audio tags ("[firm]", "[gentle]") en
  // `text` para dirigir la prosodia explícitamente.

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${args.voiceId}`,
    {
      method: "POST",
      headers: { "xi-api-key": args.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );
  if (!response.ok) {
    const err = await response.text();
    console.error(`[elevenlabs] segment TTS failed for voice ${args.voiceId}: ${response.status} ${err.slice(0, 200)}`);
    return null;
  }
  const rawBuffer = Buffer.from(await response.arrayBuffer());

  // Trim por alineación forzada: cortar al final de la última palabra
  // alineada por aeneas, no en N ms ciegos. Es content-aware y
  // engine-agnostic. Si Modal align falla (no hay STUDIO_AUDIO_TOKEN,
  // endpoint caído, segmento muy corto sin tokens, etc.) caemos al
  // pipeline heurístico viejo (silenceremove + end-trim 60 ms).
  let finalBuffer: Buffer | null = null;
  if (args.language) {
    finalBuffer = await alignTrimSegment({
      rawBuffer,
      plainText: softened,
      language: args.language,
      cacheKey,
    });
  }
  if (!finalBuffer) {
    // Fallback heurístico: silenceremove + end-trim duro 60 ms.
    const cleanedBuffer = await trimSegmentArtifacts(rawBuffer).catch((err) => {
      console.warn(
        `[elevenlabs] segment trim failed, using raw buffer: ${err instanceof Error ? err.message : err}`
      );
      return rawBuffer;
    });
    // Cache write para el fallback (alignTrimSegment ya escribió en
    // el caso happy-path).
    try {
      await uploadPublicObject({
        key: cacheKey,
        body: cleanedBuffer,
        contentType: "audio/mpeg",
      });
    } catch (err) {
      console.warn(`[elevenlabs] segment cache write failed: ${err instanceof Error ? err.message : err}`);
    }
    return cleanedBuffer;
  }

  return finalBuffer;
}

// Each ElevenLabs MP3 starts with a Xing/Info frame announcing the per-segment
// duration. A naive Buffer.concat leaves multiple Xing frames inside the file,
// which makes ffprobe (and some seekbars) report wrong durations and emit
// "invalid concatenated file detected" warnings. Running the segments through
// ffmpeg's concat demuxer produces a single clean MP3 with one Xing frame.
// `gapSec` inserts a short silence between consecutive segments so multi-voice
// dialogue doesn't sound rushed; without it every turn butts straight into the
// next with zero breath, which reads as robotic. The silence is generated to
// match the segments' own sample rate + channel layout (probed from segment 0)
// so the `-c copy` concat stays glitch-free.
async function concatMp3Buffers(buffers: Buffer[], gapSec = 0): Promise<Buffer> {
  if (buffers.length <= 1) return Buffer.concat(buffers);
  const { writeFile, mkdtemp, rm } = await import("fs/promises");
  const { tmpdir } = await import("os");
  const path = await import("path");
  const { spawn } = await import("child_process");

  const run = (cmd: string, args: string[]): Promise<string> =>
    new Promise((resolve, reject) => {
      const proc = spawn(cmd, args);
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (c) => { stdout += c.toString(); });
      proc.stderr.on("data", (c) => { stderr += c.toString(); });
      proc.on("error", reject);
      proc.on("close", (code) => (code === 0 ? resolve(stdout) : reject(new Error(`${cmd} exit ${code}: ${stderr.slice(0, 500)}`))));
    });

  const dir = await mkdtemp(path.join(tmpdir(), "mvtts-"));
  try {
    const segPaths: string[] = [];
    for (let i = 0; i < buffers.length; i += 1) {
      const p = path.join(dir, `seg-${String(i).padStart(3, "0")}.mp3`);
      await writeFile(p, buffers[i]);
      segPaths.push(p);
    }

    // Build the concat order, interleaving a generated silence between segments.
    let orderedPaths = segPaths;
    if (gapSec > 0) {
      let sampleRate = 44100;
      let channels = 1;
      try {
        const probe = await run("ffprobe", [
          "-v", "error", "-select_streams", "a:0",
          "-show_entries", "stream=sample_rate,channels",
          "-of", "default=nw=1:nk=1", segPaths[0],
        ]);
        const nums = probe.split(/\s+/).map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n));
        if (nums[0]) sampleRate = nums[0];
        if (nums[1]) channels = nums[1];
      } catch { /* fall back to 44100 mono */ }
      const silPath = path.join(dir, "silence.mp3");
      await run("ffmpeg", [
        "-y", "-loglevel", "error",
        "-f", "lavfi", "-i", `anullsrc=r=${sampleRate}:cl=${channels >= 2 ? "stereo" : "mono"}`,
        "-t", String(gapSec), "-c:a", "libmp3lame", "-b:a", "128k", silPath,
      ]);
      orderedPaths = [];
      for (let i = 0; i < segPaths.length; i += 1) {
        orderedPaths.push(segPaths[i]);
        if (i < segPaths.length - 1) orderedPaths.push(silPath);
      }
    }

    const listPath = path.join(dir, "list.txt");
    await writeFile(listPath, orderedPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
    const outPath = path.join(dir, "out.mp3");

    await new Promise<void>((resolve, reject) => {
      const proc = spawn("ffmpeg", [
        "-y",
        "-loglevel", "error",
        "-f", "concat",
        "-safe", "0",
        "-i", listPath,
        "-c", "copy",
        outPath,
      ]);
      let stderr = "";
      proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 500)}`));
      });
    });

    const { readFile } = await import("fs/promises");
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Breath between turns so dialogue doesn't sound rushed/robotic. Module
// constant so the section-rebuild path reproduces the exact same gaps as
// the original generation.
export const DIALOGUE_GAP_SEC = 0.45;

/**
 * Rebuild the merged master from an ordered list of section buffers,
 * reproducing the original generation's concat + loudnorm. Used by the
 * audio editor to replace a single section (swap its buffer, rebuild)
 * without time-splicing; the sections are the ground truth, so there is
 * no offset/alignment drift. Returns the new master mp3 buffer.
 */
export async function rebuildMasterFromSections(sectionBuffers: Buffer[]): Promise<Buffer> {
  const concat = await concatMp3Buffers(sectionBuffers, DIALOGUE_GAP_SEC);
  return normalizeLoudness(concat);
}

// Mix a looped ambient track underneath an already-synthesized dialogue
// buffer. Volume defaults to 0.15 (15%) so voices stay clearly on top.
// Returns the original buffer if ffmpeg or the ambient file isn't available.
// Probe an mp3 buffer's duration in seconds via ffprobe (temp file).
// Returns 0 on failure so callers degrade gracefully.
async function probeMp3DurationSec(buf: Buffer): Promise<number> {
  try {
    const { writeFile, mkdtemp, rm } = await import("fs/promises");
    const { tmpdir } = await import("os");
    const path = await import("path");
    const { spawn } = await import("child_process");
    const dir = await mkdtemp(path.join(tmpdir(), "dur-"));
    const p = path.join(dir, "a.mp3");
    try {
      await writeFile(p, buf);
      const out = await new Promise<string>((resolve, reject) => {
        const proc = spawn("ffprobe", [
          "-v", "error", "-show_entries", "format=duration",
          "-of", "default=nw=1:nk=1", p,
        ]);
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (c) => { stdout += c.toString(); });
        proc.stderr.on("data", (c) => { stderr += c.toString(); });
        proc.on("error", reject);
        proc.on("close", (code) => (code === 0 ? resolve(stdout) : reject(new Error(stderr.slice(0, 200)))));
      });
      const n = parseFloat(out.trim());
      return Number.isFinite(n) ? n : 0;
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  } catch {
    return 0;
  }
}

async function mixAmbient(
  dialogue: Buffer,
  ambientPath: string,
  volume = 0.15,
  // Narrator (out-of-scene VO) ranges in seconds within `dialogue`. When given,
  // the bed is silenced there; it belongs to the characters' scene, never the
  // narrator (memory: feedback_ambient_not_under_narrator).
  narratorOffIntervals: [number, number][] = []
): Promise<Buffer> {
  try {
    const { writeFile, mkdtemp, rm, readFile, access } = await import("fs/promises");
    const { tmpdir } = await import("os");
    const path = await import("path");
    const { spawn } = await import("child_process");

    await access(ambientPath); // throws if missing
    const dir = await mkdtemp(path.join(tmpdir(), "ambient-"));
    try {
      const inPath = path.join(dir, "in.mp3");
      const outPath = path.join(dir, "out.mp3");
      await writeFile(inPath, dialogue);
      await new Promise<void>((resolve, reject) => {
        const ambientStage =
          narratorOffIntervals.length > 0
            ? `[1:a]volume='${volume}*(1-min(1,${narratorOffIntervals
                .map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`)
                .join("+")}))':eval=frame[a1]`
            : `[1:a]volume=${volume},afade=t=in:st=0:d=1[a1]`;
        const filter =
          `${ambientStage};` +
          `[0:a][a1]amix=inputs=2:duration=first:dropout_transition=2[mix];` +
          `[mix]loudnorm=I=-16:LRA=11:TP=-1.5`;
        const proc = spawn("ffmpeg", [
          "-y", "-loglevel", "error",
          "-i", inPath,
          "-stream_loop", "-1", "-i", ambientPath,
          "-filter_complex", filter,
          "-codec:a", "libmp3lame", "-b:a", "128k",
          outPath,
        ]);
        let stderr = "";
        proc.stderr.on("data", (c) => { stderr += c.toString(); });
        proc.on("error", reject);
        proc.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 300)}`));
        });
      });
      return await readFile(outPath);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (err) {
    console.warn("[elevenlabs] ambient mix skipped:", err instanceof Error ? err.message : err);
    return dialogue;
  }
}

/**
 * Generate audio for a multi-character dialogue story by synthesizing each
 * speaker's segment with a distinct voice and stitching the resulting MP3s.
 * The title is prepended (narrated by the narrator voice) followed by a
 * sentence-end pause from punctuation; no speaker labels are spoken aloud.
 *
 * Optionally mixes a looped ambient track (cafeteria, mercado, etc.)
 * underneath the dialogue at low volume.
 */
/** Exact offset of one synthesized fragment within the merged master.
 *  Synthesis order: index 0 = title (when present), then dialogue turns. */
export type AudioFragmentOffset = {
  index: number;
  speaker: string;
  voiceId: string;
  startSec: number;
  endSec: number;
  /** R2 URL of THIS section's standalone audio (the individual TTS take,
   *  pre-concat). This is the ground truth: the editor plays/replaces the
   *  section file directly; no offsets, no alignment, no drift. */
  url: string | null;
  /** The exact text synthesized for this section (so it can be re-rendered). */
  text: string;
};

export async function generateAndUploadMultiVoiceAudio(args: {
  storyText: string;
  title: string;
  voiceMap: Record<string, string>; // speaker name (lowercased) → voice ID; "narrator" key required
  ambientPath?: string | null;       // absolute path to a looped ambient MP3
  ambientVolume?: number;            // 0.0-1.0, default 0.15
  /** Idioma de la historia ("german", "spanish", …). Requerido para
   *  el aeneas align trim por segmento. Si no se pasa, los segmentos
   *  caen al trim heurístico viejo (silenceremove + 60 ms). */
  language?: string;
  /** Modelo de TTS fallback. Default `eleven_multilingual_v2` (v2 es el
   *  safe default desde 2026-05-29: v3 introduce s-aspiration en algunas
   *  voces, y la regla de escritura "no imperativos breves aislados" mata
   *  el uptalk a nivel de texto, eliminando la justificación principal
   *  de v3). v3 entra solo por whitelist explícito de voces auditadas. */
  model?: ElevenLabsModel;
  /** Override de voice_settings por voiceId. Las voces no presentes usan
   *  el default global. Útil para subir stability solo a las voces que
   *  respiran de más a baja estabilidad, sin aplanar al resto. */
  voiceSettingsMap?: Record<string, VoiceSettings>;
  /** Normaliza CADA segmento a −16 LUFS antes de concatenar. Sin esto, voces
   *  del shared library con loudness crudo dispar (p.ej. una ~10 dB más baja)
   *  quedan desparejas, porque el loudnorm del concat entero no corrige
   *  diferencias ENTRE voces. Opt-in (default off → no cambia prod). */
  normalizePerSegment?: boolean;
  /** Apaga previous_text (inhalación de costura) y fija next_text=" "
   *  (suprime respiro de cola) en todos los segmentos v2. Recomendado para
   *  diálogo multi-voz: cada turno es otro hablante, el contexto del vecino
   *  no aplica y la pausa de 0.45 s ya da el boundary. Va en el cache key. */
  disableStitching?: boolean;
}): Promise<{
  url: string;
  filename: string;
  /** R2 URL to the post-loudnorm, pre-ambient buffer. Callers should
   *  persist this in `voiceProvenance.dryUrl` so the audio editor can
   *  splice into the dry stem and re-render ambient continuously,
   *  avoiding the "shimmer at the seam" inherent to splicing mixed
   *  audio. Null when no ambient mix happened (then `url` === dry). */
  dryUrl: string | null;
  dryFilename: string | null;
  audioSegments: AudioSegment[];
  audioQa: AudioQaResult;
  speakerVoiceMap: Record<string, string>;
  /** GROUND-TRUTH per-fragment offsets in the final master timeline,
   *  in synthesis order: index 0 is the title fragment (when a title was
   *  narrated), then one per dialogue turn. Each segment is synthesized
   *  independently and concatenated with a fixed gap, so these offsets
   *  are exact; the audio editor uses them for block boundaries instead
   *  of reconstructing them from (drift-prone) aeneas word timings. */
  fragments: AudioFragmentOffset[];
} | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("[elevenlabs] ❌ Missing ELEVENLABS_API_KEY");
    return null;
  }

  const segments = parseDialogueSegments(args.storyText);
  if (segments.length === 0) {
    console.error("[elevenlabs] no segments parsed from story text");
    return null;
  }

  const lowerVoiceMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(args.voiceMap)) lowerVoiceMap[k.toLowerCase()] = v;
  const narratorVoice = lowerVoiceMap.narrator;
  if (!narratorVoice) {
    console.error("[elevenlabs] voiceMap is missing the required 'narrator' key");
    return null;
  }

  // Title narration first (no speaker label), then each segment.
  const titleClean = args.title.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const titleText = titleClean
    ? /[.!?…:]$/.test(titleClean)
      ? titleClean
      : `${titleClean}.`
    : "";

  const defaultModel = args.model ?? ELEVENLABS_MODEL_V2;

  const audioBuffers: Buffer[] = [];
  // Construimos la lista completa de "fragments-a-sintetizar" (title +
  // segmentos en orden). El modelo se decide por VOZ (no por historia)
  // vía `pickModelForVoice`: voces narrator-tuned como Angela usan v2;
  // voces conversacionales usan v3 con audio tags. Mezclar modelos en una
  // misma historia es seguro porque cada segmento se rendea aparte y se
  // cose con ffmpeg + loudnorm.
  type Frag = { text: string; voiceId: string; speaker: string };
  const fragments: Frag[] = [];
  if (titleText) fragments.push({ text: titleText, voiceId: narratorVoice, speaker: "narrator" });
  for (const seg of segments) {
    const voiceId = lowerVoiceMap[seg.speaker.toLowerCase()] ?? narratorVoice;
    fragments.push({ text: seg.text, voiceId, speaker: seg.speaker });
  }
  for (let i = 0; i < fragments.length; i += 1) {
    const frag = fragments[i];
    const previousText = i > 0 ? fragments[i - 1].text : undefined;
    const nextText = i + 1 < fragments.length ? fragments[i + 1].text : " ";

    const fragModel = pickModelForVoice(frag.voiceId, defaultModel);

    // For v3 only: pre-pend audio tag based on segment classification.
    // The title fragment (i=0, speaker=narrator) always classifies as
    // narrator → no tag. Character lines may get [firm] / [gentle].
    // The tag becomes part of `text` sent to ElevenLabs, so it counts
    // toward the character credit cost (small: ~7-9 chars per tag).
    let textForTts = frag.text;
    if (fragModel === ELEVENLABS_MODEL_V3) {
      const tag = classifyAudioTag(
        { speaker: frag.speaker, text: frag.text },
        args.language,
      );
      if (tag) textForTts = `${tag} ${frag.text}`;
    }

    const buf = await ttsSegment({
      text: textForTts,
      voiceId: frag.voiceId,
      apiKey,
      previousText: args.disableStitching ? undefined : previousText,
      nextText: args.disableStitching ? undefined : nextText,
      language: args.language,
      model: fragModel,
      voiceSettings: args.voiceSettingsMap?.[frag.voiceId],
      disableStitching: args.disableStitching,
    });
    if (!buf) return null;
    audioBuffers.push(args.normalizePerSegment ? await normalizeLoudness(buf) : buf);
  }

  const concatBuffer = await concatMp3Buffers(audioBuffers, DIALOGUE_GAP_SEC);
  const normalized = await normalizeLoudness(concatBuffer);

  // Ground-truth per-fragment offsets in the merged timeline. Computed
  // ALWAYS (not just for ambient) from each fragment's real duration +
  // the fixed inter-turn gap. These are exact because we synthesized each
  // fragment ourselves; the audio editor uses them as block boundaries
  // instead of reconstructing them from drift-prone aeneas timings.
  // loudnorm (amplitude) and amix(duration=first) don't change length,
  // so they stay valid for the final master.
  const sectionBase = filenameFromTitle(args.title);
  const sectionTs = Date.now();
  const fragmentOffsets: AudioFragmentOffset[] = [];
  {
    let cursor = 0;
    for (let i = 0; i < fragments.length; i += 1) {
      const dur = await probeMp3DurationSec(audioBuffers[i]);
      // Persist the INDIVIDUAL section take; this is the ground truth the
      // editor uses to play/replace a section without touching the rest.
      const secName = `${sectionBase}_sec${String(i).padStart(2, "0")}_${sectionTs}.mp3`;
      let secUrl: string | null = null;
      try {
        const up = await uploadPublicObject({
          key: `media/generated/audio/sections/${secName}`,
          body: audioBuffers[i],
          contentType: "audio/mpeg",
        });
        secUrl = up?.url ?? null;
      } catch (err) {
        console.warn(`[elevenlabs] section ${i} upload failed:`, err instanceof Error ? err.message : err);
      }
      fragmentOffsets.push({
        index: i,
        speaker: fragments[i].speaker,
        voiceId: fragments[i].voiceId,
        startSec: Number(cursor.toFixed(3)),
        endSec: Number((cursor + dur).toFixed(3)),
        url: secUrl,
        text: fragments[i].text,
      });
      cursor += dur;
      if (i < fragments.length - 1) cursor += DIALOGUE_GAP_SEC;
    }
  }
  // ffprobe-derived durations: if ffprobe is unavailable (e.g. Vercel
  // runtime), probeMp3DurationSec returns 0 and every offset collapses.
  // Only trust the offsets when every fragment has a positive duration;
  // otherwise hand back an empty list so the editor falls back to aeneas
  // instead of using garbage (all-zero) boundaries.
  const fragmentsValid = fragmentOffsets.length > 0 && fragmentOffsets.every((f) => f.endSec > f.startSec);
  if (!fragmentsValid) {
    console.warn("[elevenlabs] fragment offsets invalid (ffprobe unavailable?); not persisting them");
  }

  // Narrator (out-of-scene VO) time ranges, so the ambient bed can be
  // silenced there; it belongs to the characters' scene, never the
  // narrator (memory: feedback_ambient_not_under_narrator). Derived from
  // the same offsets.
  const narratorOffIntervals: [number, number][] = [];
  if (args.ambientPath) {
    for (const f of fragmentOffsets) {
      if (f.speaker.toLowerCase() !== "narrator") continue;
      const last = narratorOffIntervals[narratorOffIntervals.length - 1];
      if (last && f.startSec - last[1] <= 0.5) last[1] = f.endSec;
      else narratorOffIntervals.push([f.startSec, f.endSec]);
    }
  }

  // Upload the dry stem (voices-only, post-loudnorm, pre-ambient mix)
  // BEFORE merging ambient. The dry stem enables seam-less splices in
  // the audio editor: the editor splices voice-on-voice, then re-renders
  // ambient continuously over the spliced output. Without this stem,
  // editor splices must re-mix ambient locally in the new tramo, which
  // produces an audible phase shift at the seam (ambient loop starts
  // from sample 0 instead of continuing the master's phase).
  const baseFilename = filenameFromTitle(args.title);
  const ts = Date.now();
  let dryUrl: string | null = null;
  let dryFilename: string | null = null;
  if (args.ambientPath) {
    dryFilename = `${baseFilename}_multivoice_dry_${ts}.mp3`;
    try {
      const dryUpload = await uploadPublicObject({
        key: `media/generated/audio/${dryFilename}`,
        body: normalized,
        contentType: "audio/mpeg",
      });
      dryUrl = dryUpload?.url ?? null;
      if (!dryUrl) {
        console.warn("[elevenlabs] dry-stem upload returned no url; continuing without dry");
      }
    } catch (err) {
      console.warn(
        "[elevenlabs] dry-stem upload failed (continuing without dry):",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const combined = args.ambientPath
    ? await mixAmbient(normalized, args.ambientPath, args.ambientVolume ?? DEFAULT_AMBIENT_VOLUME, narratorOffIntervals)
    : normalized;
  const filename = `${baseFilename}_multivoice_${ts}.mp3`;

  const transcription = await transcribeAudioSegments(combined, filename, [titleText, ...segments.map((s) => s.text)].join(" "));
  const audioQa = analyzeTranscriptQuality(
    [titleText, ...segments.map((s) => s.text)].join(" "),
    transcription.transcriptText
  );

  console.log("[elevenlabs] ⬆ Uploading multi-voice audio...");
  const uploaded = await uploadPublicObject({
    key: `media/generated/audio/${filename}`,
    body: combined,
    contentType: "audio/mpeg",
  });
  if (!uploaded?.url) {
    console.error("[elevenlabs] upload failed");
    return null;
  }

  const speakerVoiceMap: Record<string, string> = {};
  for (const seg of segments) {
    const key = seg.speaker.toLowerCase();
    speakerVoiceMap[seg.speaker] = lowerVoiceMap[key] ?? narratorVoice;
  }

  return {
    url: uploaded.url,
    filename,
    dryUrl,
    dryFilename,
    audioSegments: transcription.audioSegments,
    audioQa,
    speakerVoiceMap,
    fragments: fragmentsValid ? fragmentOffsets : [],
  };
}

export async function analyzeExistingAudio(
  audioBuffer: Buffer,
  expectedText: string,
  title: string
): Promise<AudioQaResult> {
  const filename = `${filenameFromTitle(title || "audio_qa")}_qa.mp3`;
  const transcription = await transcribeAudioSegments(audioBuffer, filename, expectedText);
  return analyzeTranscriptQuality(expectedText, transcription.transcriptText);
}

export async function analyzeExistingAudioDelivery(
  audioBuffer: Buffer,
  expectedText: string,
  title: string
): Promise<AudioQaResult> {
  const filename = `${filenameFromTitle(title || "audio_delivery_qa")}_delivery.mp3`;
  const transcription = await transcribeAudioSegments(audioBuffer, filename, expectedText);
  return analyzeDeliveryQuality(expectedText, transcription.audioSegments);
}

function filenameFromTitle(title: string): string {
  return title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
}

async function transcribeAudioSegments(
  buffer: Buffer,
  filename: string,
  narrationText: string
): Promise<{ audioSegments: AudioSegment[]; transcriptText: string | null }> {
  if (!openai) {
    console.warn("[audio-segments] Missing OPENAI_API_KEY, skipping segment generation");
    return { audioSegments: [], transcriptText: null };
  }

  try {
    const fileBytes = new Uint8Array(buffer);
    const file = new File([fileBytes], filename, { type: "audio/mpeg" });
    const transcript = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "verbose_json",
      prompt: narrationText,
    });

    const rawSegments =
      "segments" in transcript && Array.isArray(transcript.segments)
        ? (transcript.segments as TranscriptSegment[])
        : [];

    return {
      audioSegments: buildAudioSegmentsFromTranscript(rawSegments),
      transcriptText: typeof transcript.text === "string" ? transcript.text : null,
    };
  } catch (error) {
    console.error("[audio-segments] Failed to build segments from transcription:", error);
    return { audioSegments: [], transcriptText: null };
  }
}
