/** Voice catalog: shared between Studio UI and the local TTS endpoint.
 *
 * voiceId convention: "<engine>/<voiceName>" — e.g. "piper/es_ES-sharvard-medium".
 *
 * Each entry has a `status`:
 *  - "approved": validated by the user, available in the story dropdowns.
 *  - "candidate": added for testing; visible only in the gallery, NOT selectable
 *    for story generation until promoted.
 *  - "discarded": rejected by the user. Kept in the catalog so the gallery can
 *    show why (the `reason` field) and prevent re-adding the same voice
 *    later. Filtered out of every dropdown.
 *
 * Each entry also carries license metadata so the Studio gallery is auditable:
 *  - `license`: short SPDX-style code shown as a colored pill on the card.
 *  - `licenseSource`: where the license claim was verified (URL or short note,
 *    shown as tooltip on the pill).
 *  - `attribution`: required attribution text (rendered in the credits page
 *    when at least one approved voice mandates it). Empty string = no
 *    attribution required.
 *
 * Quality gate (mandatory before any voice gets added):
 *   1. Whisper WER ≤ 40% on a standard sentence (intelligibility).
 *   2. UTMOS ≥ 3.0 (predicted MOS, naturalness — calibrated against
 *      user-approved voices: Sharvard 3.11, Paola 3.55, Cadu 4.03).
 *   3. Audio metrics in range (RMS, silence ratio).
 */

export type Engine = "kokoro" | "piper" | "f5" | "coqui" | "bark" | "elevenlabs" | "chatterbox" | "qwen";
export type VoiceStatus = "approved" | "candidate" | "discarded";

/**
 * Pros and cons of each TTS engine, surfaced in the Studio gallery so future
 * casting decisions can be made at a glance. Updated as we learn more.
 *
 * Source of truth for the trade-offs we discovered while building the
 * audio pipeline. See chat history + `feedback_*` memories for context.
 */
export type EngineInfo = {
  /** Short human-friendly engine label. */
  label: string;
  /** Architecture: "non-AR" (deterministic, no phantoms) vs "AR" (autoregressive, phantom risk). */
  architecture: "non-AR" | "AR";
  /** What this engine is good at. */
  pros: string[];
  /** Trade-offs / limitations. */
  cons: string[];
};

export const ENGINE_INFO: Record<Engine, EngineInfo> = {
  kokoro: {
    label: "Kokoro (StyleTTS2-based, hexgrad)",
    architecture: "non-AR",
    pros: [
      "Cero phantoms: arquitectura non-AR genera audio determinístico en una pasada.",
      "Apache 2.0 puro (modelo + pesos); outputs son tuyos sin restricciones.",
      "Rápido en CPU (~real-time).",
      "82M params, footprint pequeño (~316 MB).",
    ],
    cons: [
      "Expresividad baja: prosodia plana, NO entona preguntas, NO transmite emoción.",
      "Sin voice cloning: solo 3 voces fijas español (Dora F LATAM, Alex M, Santa M ES kids).",
      "Pronunciación falla en nombres propios y palabras extranjeras (phonemizer rule-based).",
      "No soporta SSML ni control fino.",
    ],
  },
  piper: {
    label: "Piper (Rhasspy)",
    architecture: "non-AR",
    pros: [
      "Cero phantoms (non-AR).",
      "MIT (varía por voz; revisar MODEL_CARD individual).",
      "Modelos chiquitos (~50 MB), muy rápidos.",
      "30+ idiomas.",
    ],
    cons: [
      "Calidad inferior a Kokoro para español (timbral metálico ocasional).",
      "Sin voice cloning.",
      "Algunas voces requieren atribución (CC-BY 3.0 como Sharvard).",
      "Expresividad mínima.",
    ],
  },
  f5: {
    label: "F5-TTS",
    architecture: "AR",
    pros: [
      "Voice cloning bilingüe (EN+ZH) con ~10 seg de ref.",
      "Apache 2.0.",
    ],
    cons: [
      "Cross-lingual (ej. ref EN → output ES) suena artificial.",
      "Phantoms autoregresivos.",
      "Modelo pesado (~1.3 GB).",
    ],
  },
  coqui: {
    label: "Coqui (XTTS-v2 y derivados)",
    architecture: "AR",
    pros: [
      "Voice cloning multilingüe maduro (17 idiomas).",
      "Calidad alta para cloning.",
    ],
    cons: [
      "CPML: modelo + pesos NO son comerciales sin license deal con Coqui (que cerró). Bloqueante para apps monetizadas.",
      "Phantoms autoregresivos.",
    ],
  },
  bark: {
    label: "Bark (Suno)",
    architecture: "AR",
    pros: [
      "MIT puro.",
      "Genera vocalizaciones (risas, suspiros, ruidos) además de speech.",
      "Multilingüe sin cloning (10+ speakers preset por idioma).",
    ],
    cons: [
      "Lento incluso en GPU.",
      "Lottery: misma seed produce calidad inconsistente segmento a segmento.",
      "Phantoms y truncamientos frecuentes.",
      "Tendencia a prosodia monótona ('deprimente') en muchos speakers.",
    ],
  },
  elevenlabs: {
    label: "ElevenLabs",
    architecture: "AR",
    pros: [
      "Top calidad y top expresividad del mercado.",
      "Diccionario de pronunciación manual (palabras raras).",
      "Tags emocionales explícitos en v3 ([laugh], [sigh], [whisper]).",
      "Cloning con ~1 min de audio.",
      "30+ idiomas con calidad nativa.",
    ],
    cons: [
      "Pago por carácter generado ($0.30 / 1k chars en plan creator).",
      "Términos de servicio: voces 'professional shared' caducan con 730 días notice del dueño.",
      "Vendor lock-in: si ElevenLabs cierra o cambia precios, tu pipeline queda atado.",
    ],
  },
  chatterbox: {
    label: "Chatterbox MTL (Resemble AI)",
    architecture: "AR",
    pros: [
      "MIT puro (modelo + pesos).",
      "Voice cloning multilingüe (23 idiomas) con ~10 seg de ref.",
      "Calidad alta, bench cerca de ElevenLabs en algunos idiomas.",
      "Watermark Perth detecta AI-generated (transparencia).",
    ],
    cons: [
      "Phantoms autoregresivos frecuentes (alignment_repetition trigger común).",
      "Lento en CPU sin flash-attn.",
      "Modelo grande (~3 GB).",
    ],
  },
  qwen: {
    label: "Qwen3-TTS (Alibaba)",
    architecture: "AR",
    pros: [
      "Apache 2.0 puro (modelo + pesos).",
      "Multilingüe nativo (10 idiomas), incluye español LATAM por defecto.",
      "0.6B-CustomVoice tiene 9 speakers built-in reproducibles entre llamadas.",
      "1.7B-VoiceDesign genera personajes desde descripción libre.",
    ],
    cons: [
      "Phantoms autoregresivos similares a Chatterbox.",
      "Speakers built-in no son nativos español: pueden sonar acentuados (Aiden funciona, Dylan/Uncle Fu requirieron role-prompts específicos).",
      "1.7B requiere ~3 GB en disco; no determinístico al re-generar (cada call es voz nueva en VoiceDesign).",
    ],
  },
};

/**
 * Accent / dialect tags. Más granulares que `region` (que sólo
 * distingue LATAM/ES/BR/etc.) y permiten castear voces que matcheen
 * realmente la ambientación de la historia. Una voz puede llevar
 * varios — ej: una voz colombiana neutra puede ir tagueada como
 * `["colombian", "neutral-latam"]` para que sirva de fallback en
 * historias LATAM no-colombianas.
 *
 * `unverified` es el sentinel para voces nuevas o clones que aún no
 * se han auditado. El sistema de casting nunca debe sugerir o auto-
 * picar una voz `unverified`; sólo aparece en el gallery con flag.
 */
export type AccentTag =
  // Spanish
  | "mexican"
  | "argentine"
  | "colombian"
  | "chilean"
  | "peruvian"
  | "caribbean"
  | "peninsular-castilian"
  | "peninsular-andalusian"
  | "peninsular-northern"
  | "neutral-latam"
  // Portuguese
  | "brazilian-paulista"
  | "brazilian-carioca"
  | "brazilian-ne"
  | "portuguese-lisbon"
  | "portuguese-porto"
  // Italian
  | "italian-roman"
  | "italian-milanese"
  | "italian-neapolitan"
  | "italian-florentine"
  | "italian-bolognese"
  | "italian-neutral"
  // German
  | "german-hochdeutsch"
  | "german-austrian"
  | "german-swiss"
  // English
  | "english-gen-am"
  | "english-rp"
  | "english-southern-us"
  | "english-australian"
  // sentinel for new/clone voices not yet audited
  | "unverified";

/** Short licence codes used across the catalog. Keep in sync with
 * LICENSE_KIND in StudioAudioClient (color/tier mapping for the badge). */
export type LicenseCode =
  | "Apache-2.0"
  | "MIT"
  | "CC0"
  | "CC-BY-3.0"
  | "CC-BY-4.0"
  | "CC-BY-SA-4.0"
  | "ElevenLabs-Premade"   // perpetual, no expiration
  | "ElevenLabs-Pro-2yr"   // 730-day notice from voice owner
  | "Public-Domain"        // LibriVox-derived, no formal license
  | "Unverified";          // license claim not yet checked

export type VoiceEntry = {
  id: string;
  engine: Engine;
  language: string;
  region?: string;
  /**
   * Lista de accent/dialect tags. Aditivo respecto a `region` (que se
   * mantiene por compatibilidad con filtros LATAM/ES existentes).
   * Reglas:
   *  - Una voz puede tener varios tags (`["colombian", "neutral-latam"]`)
   *    si sirve bien en más de un contexto.
   *  - Una voz sin auditar usa `["unverified"]` y queda excluida del
   *    auto-suggest de casting hasta que alguien escuche y confirme.
   *  - Vacío o ausente = legacy (todavía no auditada). El audit script
   *    los lista para forzar tageo progresivo.
   */
  accentTags?: AccentTag[];
  gender: "f" | "m";
  label: string;
  status: VoiceStatus;
  /** Only set on `discarded` entries: short user-facing reason for the rejection. */
  reason?: string;
  /** SPDX-ish license code. Required for every entry so the gallery is auditable. */
  license: LicenseCode;
  /** URL or short note where the license claim was verified. */
  licenseSource?: string;
  /** Required attribution text (rendered on the credits page when set). */
  attribution?: string;
};

export const VOICE_CATALOG: VoiceEntry[] = [
  // ── Internal (local TTS, free) ────────────────────────────────────────────
  {
    id: "piper/es_ES-sharvard-medium", engine: "piper", language: "spanish", region: "ES", gender: "m",
    label: "Sharvard (España, masculina)", status: "discarded",
    reason: "CC-BY 3.0 requiere atribución; objetivo de la app: 100% gratis sin responsabilidades.",
    license: "CC-BY-3.0",
    licenseSource: "https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/sharvard/medium/MODEL_CARD",
    attribution: "Sharvard voice from University of Edinburgh datashare (https://datashare.ed.ac.uk/handle/10283/574), licensed under CC-BY 3.0.",
  },
  {
    id: "piper/pt_BR-cadu-medium", engine: "piper", language: "portuguese", region: "BR", gender: "m",
    label: "Cadu (Brasil, masculina)", status: "approved",
    accentTags: ["brazilian-paulista"],
    license: "CC0",
    licenseSource: "https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_BR/cadu/medium/MODEL_CARD",
  },
  {
    id: "piper/it_IT-paola-medium", engine: "piper", language: "italian", region: "IT", gender: "f",
    label: "Paola (Italia, femenina)", status: "approved",
    accentTags: ["italian-neutral"],
    license: "CC0",
    licenseSource: "https://huggingface.co/datasets/paolapersico1/Voice-Dataset-Italian",
  },

  // Spanish LATAM voices (Kokoro = StyleTTS2-based, mucho mejor calidad que Piper para español).
  {
    id: "kokoro/ef_dora", engine: "kokoro", language: "spanish", region: "LATAM", gender: "f",
    label: "Dora (Kokoro, femenina)", status: "approved",
    accentTags: ["neutral-latam"],
    license: "Apache-2.0",
    licenseSource: "https://huggingface.co/hexgrad/Kokoro-82M",
  },
  {
    id: "kokoro/em_alex", engine: "kokoro", language: "spanish", region: "LATAM", gender: "m",
    label: "Alex (Kokoro, masculino)", status: "approved",
    accentTags: ["neutral-latam"],
    license: "Apache-2.0",
    licenseSource: "https://huggingface.co/hexgrad/Kokoro-82M",
  },
  {
    id: "kokoro/em_santa", engine: "kokoro", language: "spanish", region: "ES", gender: "m",
    label: "Santa (Kokoro, España, para niños)", status: "approved",
    accentTags: ["peninsular-castilian"],
    license: "Apache-2.0",
    licenseSource: "https://huggingface.co/hexgrad/Kokoro-82M",
  },

  // Chatterbox Multilingüe (Resemble AI). Modelo + pesos MIT.
  {
    id: "chatterbox/mtl_es-default", engine: "chatterbox", language: "spanish", region: "LATAM", gender: "m",
    label: "Chatterbox MTL ES (default, sin ref)", status: "approved",
    accentTags: ["unverified"],
    license: "MIT",
    licenseSource: "https://github.com/resemble-ai/chatterbox",
  },

  // Qwen3-TTS 0.6B-CustomVoice (Alibaba, Apache 2.0 modelo+pesos). Multilingüe; speakers built-in
  // no son nativos de español. Outputs Apache 2.0 = tuyos.
  { id: "qwen/es-Aiden",    engine: "qwen", language: "spanish", region: "LATAM", gender: "m", label: "Aiden (Qwen3 0.6B)",    status: "approved",  accentTags: ["unverified"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },
  { id: "qwen/es-Dylan-v3",    engine: "qwen", language: "spanish", region: "LATAM", gender: "m", label: "Dylan v3 (role-prompt)",         status: "approved", accentTags: ["unverified"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },
  { id: "qwen/es-Uncle_Fu-v3", engine: "qwen", language: "spanish", region: "ES",    gender: "m", label: "Uncle Fu v3 (role-prompt)",      status: "approved", accentTags: ["peninsular-castilian"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },

  // Qwen3 1.7B-VoiceDesign (Apache 2.0): personajes generados por descripción libre.
  // accentTags: el prompt pidió Madrid pero el region: LATAM original sugiere
  // que la salida no convenció como peninsular; queda `unverified` hasta auditar.
  { id: "qwen17/es-madrid_55m",       engine: "qwen", language: "spanish", region: "LATAM", gender: "m", label: "Madrid 55 (Qwen3 1.7B VD)",     status: "approved",  accentTags: ["unverified"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },

  // Italian via Qwen3 1.7B-VoiceDesign (Apache 2.0)
  { id: "qwen17/it-roma_30f",     engine: "qwen", language: "italian", region: "IT", gender: "f", label: "Roma 30 (Qwen3 1.7B VD)",     status: "approved", accentTags: ["italian-roman"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },
  { id: "qwen17/it-milano_45m",   engine: "qwen", language: "italian", region: "IT", gender: "m", label: "Milano 45 (Qwen3 1.7B VD)",   status: "approved", accentTags: ["italian-milanese"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },
  { id: "qwen17/it-firenze_55f",  engine: "qwen", language: "italian", region: "IT", gender: "f", label: "Firenze 55 (Qwen3 1.7B VD)",  status: "approved", accentTags: ["italian-florentine"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },
  { id: "qwen17/it-bologna_35m",  engine: "qwen", language: "italian", region: "IT", gender: "m", label: "Bologna 35 (Qwen3 1.7B VD)",  status: "approved", accentTags: ["italian-bolognese"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },

  // Brazilian Portuguese via Qwen3 1.7B-VoiceDesign (Apache 2.0)
  { id: "qwen17/pt-salvador_28f",      engine: "qwen", language: "portuguese", region: "BR", gender: "f", label: "Salvador 28 (Qwen3 1.7B VD)",       status: "approved", accentTags: ["brazilian-ne"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },
  { id: "qwen17/pt-belohorizonte_35f", engine: "qwen", language: "portuguese", region: "BR", gender: "f", label: "Belo Horizonte 35 (Qwen3 1.7B VD)", status: "approved", accentTags: ["brazilian-paulista"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },

  // Round 2: ajustes (Barcelona menos soft, Napoli/SãoPaulo más calmos, Salvador-style variación Recife).
  // accentTags `unverified` para las castellano que quedaron tagueadas region: LATAM
  // — el catálogo ya señala que no salieron como Madrid, hay que escuchar para
  // decidir si son neutral-latam u otra cosa.
  { id: "qwen17/es-barcelona_45m-v3", engine: "qwen", language: "spanish",    region: "LATAM", gender: "m", label: "Barcelona 45 v3 (intermedio)",   status: "approved",  accentTags: ["unverified"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },
  // Spain Spanish con prompt fonológico peninsular explícito (distinción c/z=θ vs s).
  { id: "qwen17/es-madrid_38m-castellano",     engine: "qwen", language: "spanish", region: "LATAM", gender: "m", label: "Madrid 38 castellano (Qwen3 1.7B VD)",     status: "approved",  accentTags: ["peninsular-castilian"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },
  { id: "qwen17/es-bilbao_35m-norte-v2",       engine: "qwen", language: "spanish", region: "ES",    gender: "m", label: "Bilbao 35 norte v2 (less energy)",          status: "approved", accentTags: ["peninsular-northern"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },
  { id: "qwen17/es-castile_38f-castellano-v2", engine: "qwen", language: "spanish", region: "LATAM", gender: "f", label: "Castile 38 castellano v2 (alto, L alveolar)", status: "approved", accentTags: ["peninsular-castilian"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },
  { id: "qwen17/it-napoli_28m-v4",             engine: "qwen", language: "italian", region: "IT",    gender: "m", label: "Napoli 28 v4 (intermedio menos)",                  status: "approved", accentTags: ["italian-neapolitan"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },
  { id: "qwen17/pt-saopaulo_30f-v2",  engine: "qwen", language: "portuguese", region: "BR",    gender: "f", label: "São Paulo 30 v2 (volumen bajo)", status: "approved",  accentTags: ["brazilian-paulista"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },
  { id: "qwen17/pt-recife_32f",       engine: "qwen", language: "portuguese", region: "BR",    gender: "f", label: "Recife 32 (variación NE)",       status: "approved",  accentTags: ["brazilian-ne"], license: "Apache-2.0", licenseSource: "https://github.com/QwenLM/Qwen3-TTS" },

  // Voice clones via Chatterbox (modelo MIT) usando refs OpenSLR 72 (CC-BY-SA Google).
  // El output hereda la licencia más restrictiva del input → CC-BY-SA-4.0.
  {
    id: "chatterbox/co_cof_02436", engine: "chatterbox", language: "spanish", region: "CO", gender: "f",
    label: "Colombiana A (Chatterbox clone)", status: "discarded",
    reason: "CC-BY-SA viral (atribución + share-alike); objetivo de la app: 100% gratis sin responsabilidades.",
    license: "CC-BY-SA-4.0",
    licenseSource: "https://www.openslr.org/72/",
    attribution: "Voice cloned from Google Crowdsourced Spanish TTS Dataset (OpenSLR 72, Colombian Spanish), licensed under CC-BY-SA 4.0. Derivative audio is also CC-BY-SA 4.0.",
  },
  {
    id: "chatterbox/co_cof_07508", engine: "chatterbox", language: "spanish", region: "CO", gender: "f",
    label: "Colombiana B (Chatterbox clone)", status: "approved",
    accentTags: ["colombian", "neutral-latam"],
    license: "CC-BY-SA-4.0",
    licenseSource: "https://www.openslr.org/72/",
    attribution: "Voice cloned from Google Crowdsourced Spanish TTS Dataset (OpenSLR 72, Colombian Spanish), licensed under CC-BY-SA 4.0. Derivative audio is also CC-BY-SA 4.0.",
  },
  {
    id: "chatterbox/co_cof_09697", engine: "chatterbox", language: "spanish", region: "CO", gender: "f",
    label: "Colombiana C (Chatterbox clone)", status: "approved",
    accentTags: ["colombian", "neutral-latam"],
    license: "CC-BY-SA-4.0",
    licenseSource: "https://www.openslr.org/72/",
    attribution: "Voice cloned from Google Crowdsourced Spanish TTS Dataset (OpenSLR 72, Colombian Spanish), licensed under CC-BY-SA 4.0. Derivative audio is also CC-BY-SA 4.0.",
  },

  // ── Voice clones encontradas en producción (no agregadas previamente al
  // catálogo). El query `inspectAllProductionVoices.ts` las descubrió en el
  // dialogueSpec de carnitas-en-coyoacan + tinto-en-la-candelaria. Status
  // candidate hasta que se auditen escuchando; accentTags `unverified` para
  // que el sistema de casting NO las recomiende automáticamente.
  // El usuario reportó que la masculina suena argentina aunque el ref es
  // peninsular — el cloning con chatterbox tira hacia atractor rioplatense.
  {
    id: "chatterbox/clone-madrid_55m", engine: "chatterbox", language: "spanish", region: "LATAM", gender: "m",
    label: "Clone Madrid 55m (chatterbox + qwen17 ref)", status: "candidate",
    accentTags: ["unverified"],
    license: "Apache-2.0",
    licenseSource: "Output Apache-2.0 (qwen17 source) + chatterbox MIT pipeline.",
  },
  {
    id: "chatterbox/clone-castile_38f-castellano-v2", engine: "chatterbox", language: "spanish", region: "LATAM", gender: "f",
    label: "Clone Castile 38f castellano v2 (chatterbox + qwen17 ref)", status: "candidate",
    accentTags: ["unverified"],
    license: "Apache-2.0",
    licenseSource: "Output Apache-2.0 (qwen17 source) + chatterbox MIT pipeline.",
  },

  // German internal fallbacks. NO THORSTEN VARIANTS (user-banned, perceptually depressing).
  {
    id: "bark/de_speaker_4", engine: "bark", language: "german", region: "DE", gender: "m",
    label: "Bark Speaker 4 (Alemania, masculina)", status: "approved",
    accentTags: ["german-hochdeutsch"],
    license: "MIT",
    licenseSource: "https://github.com/suno-ai/bark",
  },
  {
    id: "coqui/de_DE-css10-vits-neon", engine: "coqui", language: "german", region: "DE", gender: "f",
    label: "Coqui CSS10 (Alemania, femenina)", status: "discarded",
    reason: "Licencia formal del modelo Coqui no documentada; objetivo de la app: 100% gratis sin responsabilidades.",
    license: "Public-Domain",
    licenseSource: "CSS10 derived from LibriVox (public domain). Coqui model itself lacks formal license; treat as PD-leaning until verified.",
  },

  // ── ElevenLabs (external, paid per character) ─────────────────────────────
  {
    id: "elevenlabs/Ww7Sq9tx9CCOiNOwWgsx", engine: "elevenlabs", language: "german", region: "DE", gender: "m",
    label: "Moritz Morgenstern (narrador, perpetual)", status: "approved",
    accentTags: ["german-hochdeutsch"],
    license: "ElevenLabs-Premade",
    licenseSource: "ElevenLabs API premade voice; perpetual under ElevenLabs Terms of Service.",
  },
  {
    id: "elevenlabs/WHaUUVTDq47Yqc9aDbkH", engine: "elevenlabs", language: "german", region: "DE", gender: "f",
    label: "ENNIAH (femenino mature, perpetual)", status: "approved",
    accentTags: ["german-hochdeutsch"],
    license: "ElevenLabs-Premade",
    licenseSource: "ElevenLabs API premade voice; perpetual under ElevenLabs Terms of Service.",
  },
  {
    id: "elevenlabs/8SdTD5IMgFKT1jp7JbPC", engine: "elevenlabs", language: "german", region: "DE", gender: "f",
    label: "Eleonore (femenino mature, narrator, 2yr)", status: "approved",
    accentTags: ["german-hochdeutsch"],
    license: "ElevenLabs-Pro-2yr",
    licenseSource: "ElevenLabs Professional Shared library; voice owner can give 730-day notice to retire.",
  },
  // Voces canónicas del set GERMAN_DIALOGUE_VOICES (`src/lib/elevenlabs.ts`).
  // Antes vivían solo en ese módulo; faltaban del catálogo y por eso el audit
  // de cobertura no las contaba ni el gallery las podía mostrar. Sincronizadas
  // aquí con tags y license para que el sistema las trate como ciudadanos
  // de primera.
  {
    id: "elevenlabs/cllvQaMvj0ZKxH88HGEn", engine: "elevenlabs", language: "german", region: "DE", gender: "f",
    label: "Gesa Tess (femenino mature, trustworthy host, 2yr)", status: "approved",
    accentTags: ["german-hochdeutsch"],
    license: "ElevenLabs-Pro-2yr",
    licenseSource: "ElevenLabs Professional Shared library; voice owner can give 730-day notice to retire.",
  },
  {
    id: "elevenlabs/mmAbrxFQ9xjByXyBpqrK", engine: "elevenlabs", language: "german", region: "DE", gender: "m",
    label: "Luca (masculino joven, dynamic engaging, 2yr)", status: "approved",
    accentTags: ["german-hochdeutsch"],
    license: "ElevenLabs-Pro-2yr",
    licenseSource: "ElevenLabs Professional Shared library; voice owner can give 730-day notice to retire. Reemplaza a Sebastian (uptalk) per memoria.",
  },

  // ── Discarded (kept here so the gallery can remember why) ─────────────────
  { id: "elevenlabs/qVRpsZJDV29g1CIPzssm", engine: "elevenlabs", language: "german", region: "DE", gender: "m", label: "Sebastian", status: "discarded", reason: "Uptalk: cada frase termina como pregunta. Reemplazado por Luca.", license: "ElevenLabs-Pro-2yr" },
  { id: "elevenlabs/TX3LPaxmHKxFdv7VOQHJ", engine: "elevenlabs", language: "german", region: "US", gender: "m", label: "Liam (premade)", status: "discarded", reason: "Acento gringo se cuela en eleven_multilingual_v2 cuando habla alemán.", license: "ElevenLabs-Premade" },
  { id: "bark/de_speaker_3",               engine: "bark",       language: "german", region: "DE", gender: "m", label: "Bark Speaker 3", status: "discarded", reason: "Voz apagada/monótona; el usuario la describió como deprimente.", license: "MIT" },
  { id: "piper/de_DE-thorsten-medium",     engine: "piper",      language: "german", region: "DE", gender: "m", label: "Thorsten (todas las variantes)", status: "discarded", reason: "Monótona/deprimente en cualquier variante (Piper y Coqui).", license: "Unverified" },
  { id: "elevenlabs/simon-sunday",         engine: "elevenlabs", language: "german", region: "DE", gender: "m", label: "Simon Sunday",                   status: "discarded", reason: "Monótona/deprimente. ID exacto no registrado.", license: "ElevenLabs-Premade" },
  { id: "piper/es_MX-claude-high",         engine: "piper",      language: "spanish", region: "MX", gender: "f", label: "Claude MX (Piper, high)", status: "discarded", reason: "Calidad insuficiente vs Paola; rechazada en testing 2026-05-07.", license: "Unverified" },
  { id: "piper/es_MX-ald-medium",          engine: "piper",      language: "spanish", region: "MX", gender: "m", label: "Ald MX (Piper, medium)",  status: "discarded", reason: "Calidad insuficiente vs Paola; rechazada en testing 2026-05-07.", license: "Unverified" },
  { id: "qwen/es-Vivian",  engine: "qwen", language: "spanish", region: "LATAM", gender: "f", label: "Vivian (Qwen3 0.6B)",  status: "discarded", reason: "Speaker EN/ZH no-nativo; fonemas españoles salen como 'idioma inventado'.", license: "Apache-2.0" },
  { id: "qwen/es-Serena",  engine: "qwen", language: "spanish", region: "LATAM", gender: "f", label: "Serena (Qwen3 0.6B)",  status: "discarded", reason: "Speaker EN/ZH no-nativo; fonemas españoles garbled.", license: "Apache-2.0" },
  { id: "qwen/es-Ryan",    engine: "qwen", language: "spanish", region: "LATAM", gender: "m", label: "Ryan (Qwen3 0.6B)",    status: "discarded", reason: "Repetición/glitch (output 20s vs 10s esperado); fonemas degradados.", license: "Apache-2.0" },
  { id: "qwen/es-Ono_Anna", engine: "qwen", language: "spanish", region: "LATAM", gender: "f", label: "Ono Anna (Qwen3 0.6B)", status: "discarded", reason: "Repetición/glitch (output 22.5s vs 10s); rechazada en testing.", license: "Apache-2.0" },
  { id: "qwen/es-Sohee",    engine: "qwen", language: "spanish", region: "LATAM", gender: "f", label: "Sohee (Qwen3 0.6B)",    status: "discarded", reason: "Calidad/entonación insuficiente; rechazada en testing.", license: "Apache-2.0" },
  { id: "qwen/es-Dylan-v2",    engine: "qwen", language: "spanish", region: "LATAM", gender: "m", label: "Dylan v2 (instruct: conversacional)", status: "discarded", reason: "Instruct conversacional no alcanzó; sigue con tono narrador exagerado.", license: "Apache-2.0" },
  { id: "qwen/es-Uncle_Fu-v2", engine: "qwen", language: "spanish", region: "LATAM", gender: "m", label: "Uncle Fu v2 (instruct: cálido)",     status: "discarded", reason: "Instruct cálido no alcanzó; sigue con tono documental/narrador.", license: "Apache-2.0" },
  { id: "qwen/es-Dylan",       engine: "qwen", language: "spanish", region: "LATAM", gender: "m", label: "Dylan (Qwen3 0.6B, base)",       status: "discarded", reason: "Tono narrador exagerado; superado por v3 con role-prompt.", license: "Apache-2.0" },
  { id: "qwen/es-Uncle_Fu",    engine: "qwen", language: "spanish", region: "ES",    gender: "m", label: "Uncle Fu (Qwen3 0.6B, base)",    status: "discarded", reason: "Tono documental/narrador exagerado; superado por v3 con role-prompt.", license: "Apache-2.0" },
  { id: "qwen/es-Eric",        engine: "qwen", language: "spanish", region: "LATAM", gender: "m", label: "Eric (Qwen3 0.6B, base)",        status: "discarded", reason: "El tramo 'buenos días' suena amanerado; rechazada en testing.", license: "Apache-2.0" },
  { id: "qwen/es-Eric-v3",     engine: "qwen", language: "spanish", region: "LATAM", gender: "m", label: "Eric v3 (role-prompt)",          status: "discarded", reason: "Role-prompt no resolvió la entonación; rechazada en testing.", license: "Apache-2.0" },
  { id: "qwen17/es-madrid_30f",    engine: "qwen", language: "spanish", region: "ES", gender: "f", label: "Madrid 30 (Qwen3 1.7B VD)",     status: "discarded", reason: "Calidad/entonación no convenció en testing.", license: "Apache-2.0" },
  { id: "qwen17/es-sevilla_28f",   engine: "qwen", language: "spanish", region: "ES", gender: "f", label: "Sevilla 28 (Qwen3 1.7B VD)",    status: "discarded", reason: "Calidad/entonación no convenció en testing.", license: "Apache-2.0" },
  { id: "qwen17/es-valencia_35f",  engine: "qwen", language: "spanish", region: "ES", gender: "f", label: "Valencia 35 (Qwen3 1.7B VD)",   status: "discarded", reason: "Calidad/entonación no convenció en testing.", license: "Apache-2.0" },
  { id: "qwen17/pt-rio_45m",         engine: "qwen", language: "portuguese", region: "BR", gender: "m", label: "Rio 45 (Qwen3 1.7B VD)",         status: "discarded", reason: "Rechazada en testing.", license: "Apache-2.0" },
  { id: "qwen17/pt-portoalegre_55m", engine: "qwen", language: "portuguese", region: "BR", gender: "m", label: "Porto Alegre 55 (Qwen3 1.7B VD)", status: "discarded", reason: "Rechazada en testing.", license: "Apache-2.0" },
  { id: "qwen17/it-napoli_28m-v2",            engine: "qwen", language: "italian", region: "IT", gender: "m", label: "Napoli 28 v2 (calmo)",                   status: "discarded", reason: "Demasiado calmo; superado por v3 y siguientes.", license: "Apache-2.0" },
  { id: "qwen17/it-napoli_28m-v3",            engine: "qwen", language: "italian", region: "IT", gender: "m", label: "Napoli 28 v3 (intermedio)",              status: "discarded", reason: "Mejor que v2 pero algo exagerado; reemplazada por v4.", license: "Apache-2.0" },
  { id: "qwen17/es-salamanca_42f-castellano", engine: "qwen", language: "spanish", region: "ES", gender: "f", label: "Salamanca 42 castellano (Qwen3 1.7B VD)", status: "discarded", reason: "L estilo inglés velarizada + pitch demasiado agudo; rechazada en testing.", license: "Apache-2.0" },
  { id: "qwen17/es-bilbao_35m-norte",          engine: "qwen", language: "spanish", region: "ES", gender: "m", label: "Bilbao 35 norte (Qwen3 1.7B VD)",           status: "discarded", reason: "Demasiado exagerado; superado por v2.", license: "Apache-2.0" },
  { id: "qwen17/es-castile_45f-castellano-v3", engine: "qwen", language: "spanish", region: "ES", gender: "f", label: "Castile 45 castellano v3 (contralto, grave)", status: "discarded", reason: "Rechazada en testing.", license: "Apache-2.0" },
];

export const DEFAULT_VOICE_BY_LANGUAGE: Record<string, string> = {
  spanish:    "kokoro/ef_dora",            // Apache 2.0, LATAM neutral, no obligations
  portuguese: "piper/pt_BR-cadu-medium",   // CC0
  italian:    "piper/it_IT-paola-medium",  // CC0
  german:     "bark/de_speaker_4",         // MIT (only free DE option for now)
};

export function findVoice(voiceId: string | null | undefined): VoiceEntry | null {
  if (!voiceId) return null;
  return VOICE_CATALOG.find((v) => v.id === voiceId) ?? null;
}

export function approvedVoices(): VoiceEntry[] {
  return VOICE_CATALOG.filter((v) => v.status === "approved");
}

export function voicesForLanguage(language: string, status: VoiceStatus = "approved"): VoiceEntry[] {
  const lang = language.toLowerCase();
  return VOICE_CATALOG.filter((v) => v.language === lang && v.status === status);
}

/**
 * Voces aprobadas que matchean al menos uno de los `tags` pedidos.
 * Excluye voces tagueadas `unverified` salvo que `unverified` esté en
 * la lista de búsqueda (caso edge: querer auditar las pendientes).
 *
 * Ej: `voicesByAccent(["mexican", "neutral-latam"])` devuelve voces
 * marcadas mexicanas O latam-neutras, descarte automático del resto.
 */
export function voicesByAccent(
  tags: AccentTag[],
  language?: string
): VoiceEntry[] {
  const want = new Set(tags);
  const includeUnverified = want.has("unverified");
  return VOICE_CATALOG.filter((v) => {
    if (v.status !== "approved") return false;
    if (language && v.language !== language.toLowerCase()) return false;
    if (!v.accentTags || v.accentTags.length === 0) return false;
    if (!includeUnverified && v.accentTags.includes("unverified")) return false;
    return v.accentTags.some((t) => want.has(t));
  });
}

/**
 * Reporte de cobertura del catálogo: cuántas voces aprobadas hay por
 * accent tag para un idioma dado. Útil para detectar buckets vacíos
 * (ej: español sin ninguna voz `mexican` aprobada implica que toda
 * historia mexicana se castea con aproximaciones).
 */
export function accentCoverage(language: string): Record<string, number> {
  const lang = language.toLowerCase();
  const counts: Record<string, number> = {};
  for (const v of VOICE_CATALOG) {
    if (v.status !== "approved") continue;
    if (v.language !== lang) continue;
    if (!v.accentTags) continue;
    for (const tag of v.accentTags) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  return counts;
}
