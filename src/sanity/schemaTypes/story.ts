// /src/sanity/schemaTypes/story.ts
import { defineField, defineType } from "sanity";
import type { InputProps } from "sanity";
import React from "react";
import StoryGeneratorInput from "../components/StoryGeneratorInput";
import CoverGeneratorInput from "../components/CoverGeneratorInput";
import VocabGeneratorInput from "../components/VocabGeneratorInput";
import VocabValidatorInput from "../components/VocabValidatorInput";
import AudioGeneratorInput from "../components/AudioGeneratorInput";
import StoryTextInput from "../components/StoryTextInput";
import AutoSlugInput from "../components/AutoSlugInput";
import StoryVocabQualityInput from "../components/StoryVocabQualityInput";

type SetPatch = {
  type: "set";
  path: (string | number)[];
  value: unknown;
};

type SyncInputProps = {
  document?: unknown;
  onChange: (patch: SetPatch) => void;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getBookRefId(doc: unknown): string | null {
  if (!isRecord(doc)) return null;
  const book = doc.book;
  if (!isRecord(book)) return null;
  const ref = book._ref;
  return typeof ref === "string" && ref.length > 0 ? ref : null;
}

function getLanguage(doc: unknown): string | null {
  if (!isRecord(doc)) return null;
  const language = doc.language;
  return typeof language === "string" && language.length > 0 ? language : null;
}

const MAX_TEXT_CHARS = 3800;
const MIN_TEXT_WORDS = 260;
const MAX_TEXT_WORDS = 500;
const MAX_VOCAB_ITEMS = 40;
const MAX_VOCAB_WORD_LENGTH = 48;
const MAX_VOCAB_WORD_TOKENS = 4;

function parseVocabRaw(value: unknown): unknown[] | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function validateVocabRaw(value: unknown): true | string {
  if (typeof value !== "string" || value.trim() === "") return true;
  const rows = parseVocabRaw(value);
  if (!rows) return "Vocabulary must be a valid JSON array.";
  if (rows.length > MAX_VOCAB_ITEMS) return `Vocabulary must contain at most ${MAX_VOCAB_ITEMS} items.`;

  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!isRecord(row)) return `Item ${i + 1} must be an object.`;
    const word = typeof row.word === "string" ? row.word.trim() : "";
    const definition = typeof row.definition === "string" ? row.definition.trim() : "";
    if (!word) return `Item ${i + 1} is missing "word".`;
    if (!definition) return `Item ${i + 1} is missing "definition".`;
    if (word.length > MAX_VOCAB_WORD_LENGTH) {
      return `Word "${word}" is too long (max ${MAX_VOCAB_WORD_LENGTH} chars).`;
    }
    if (/[<>[\]{}]/.test(word)) return `Word "${word}" contains unsupported characters.`;
    const tokenCount = word.split(/\s+/).filter(Boolean).length;
    if (tokenCount > MAX_VOCAB_WORD_TOKENS) {
      return `Word "${word}" has too many tokens (max ${MAX_VOCAB_WORD_TOKENS}).`;
    }
    const key = word.toLowerCase();
    if (seen.has(key)) return `Duplicate word "${word}" in vocabulary.`;
    seen.add(key);
  }

  return true;
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export const story = defineType({
  name: "story",
  title: "Story",
  type: "document",

  fields: [
    //
    // 📘 RELACIÓN CON LIBRO — aparece primero
    //
    defineField({
      name: "book",
      title: "Related Book",
      type: "reference",
      to: [{ type: "book" }],
      validation: (Rule) => Rule.required(),
      description: "Select the book this story belongs to (required).",
    }),

    //
    // 🔄 AUTO-HERENCIA DE METADATOS DEL LIBRO
    //
    defineField({
      name: "syncBookMetadata",
      title: "Sync Book Metadata",
      type: "string",
      hidden: true,
      components: {
        input: function SyncBookMetadataComponent(props: unknown) {
          const { document, onChange } = props as SyncInputProps;

          // eslint-disable-next-line react-hooks/rules-of-hooks
          React.useEffect(() => {
            const run = async () => {
              const bookRef = getBookRefId(document);
              if (!bookRef) return;

              try {
                const query = `*[_type == "book" && _id == $id][0]{
                  language, variant, region, level, cefrLevel, topic
                }`;

                const response = await fetch("/api/sanity-query", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ query, params: { id: bookRef } }),
                });

                const json: unknown = await response.json();
                if (!isRecord(json)) return;

                const result = json.result;
                if (!isRecord(result)) return;

                const b = result;

                const regionFieldMap: Record<string, string> = {
                  spanish: "region_es",
                  english: "region_en",
                  german: "region_de",
                  french: "region_fr",
                  italian: "region_it",
                  portuguese: "region_pt",
                };

                const lang = typeof b.language === "string" ? b.language : null;
                const regionField = lang ? regionFieldMap[lang] : undefined;

                const patch: SetPatch[] = [];

                if (typeof b.language === "string") {
                  patch.push({ type: "set", path: ["language"], value: b.language });
                }
                if (typeof b.variant === "string") {
                  patch.push({ type: "set", path: ["variant"], value: b.variant });
                }
                if (typeof b.level === "string") {
                  patch.push({ type: "set", path: ["level"], value: b.level });
                }
                if (typeof b.cefrLevel === "string") {
                  patch.push({ type: "set", path: ["cefrLevel"], value: b.cefrLevel });
                }
                if (typeof b.topic === "string") {
                  patch.push({ type: "set", path: ["topic"], value: b.topic });
                }
                if (regionField && typeof b.region === "string") {
                  patch.push({ type: "set", path: [regionField], value: b.region });
                }

                patch.forEach((p) => onChange(p));
              } catch (err) {
                console.error("Error syncing book metadata:", err);
              }
            };

            void run();
          }, [document, onChange]);

          return null;
        },
      },
    }),

    //
    // 🧭 INPUT SECTION — configuración previa a la generación
    //
    defineField({
      name: "language",
      title: "Language",
      type: "string",
      options: {
        list: [
          { title: "Spanish", value: "spanish" },
          { title: "English", value: "english" },
          { title: "Portuguese", value: "portuguese" },
          { title: "French", value: "french" },
          { title: "Italian", value: "italian" },
          { title: "German", value: "german" },
        ],
      },
    }),

    defineField({
      name: "variant",
      title: "Variant",
      type: "string",
      options: {
        list: [
          { title: "LATAM", value: "latam" },
          { title: "Spain", value: "spain" },
          { title: "US", value: "us" },
          { title: "UK", value: "uk" },
          { title: "Brazil", value: "brazil" },
          { title: "Portugal", value: "portugal" },
          { title: "Germany", value: "germany" },
          { title: "Austria", value: "austria" },
          { title: "France", value: "france" },
          { title: "Canada (French)", value: "canada-fr" },
          { title: "Italy", value: "italy" },
        ],
      },
      description: "Pedagogical track used for curriculum and Journey. Keep region for the exact local context.",
    }),

    defineField({
      name: "region_es",
      title: "Region",
      type: "string",
      hidden: ({ document }) => getLanguage(document) !== "spanish",
      options: {
        list: [
          { title: "Spain", value: "spain" },
          { title: "Colombia", value: "colombia" },
          { title: "Mexico", value: "mexico" },
          { title: "Argentina", value: "argentina" },
          { title: "Chile", value: "chile" },
          { title: "Peru", value: "peru" },
        ],
      },
      description: "Optional.",
    }),

    defineField({
      name: "region_en",
      title: "Region",
      type: "string",
      hidden: ({ document }) => getLanguage(document) !== "english",
      options: {
        list: [
          { title: "United States", value: "usa" },
          { title: "United Kingdom", value: "uk" },
          { title: "Australia", value: "australia" },
          { title: "Canada", value: "canada" },
        ],
      },
      description: "Optional.",
    }),

    defineField({
      name: "region_de",
      title: "Region",
      type: "string",
      hidden: ({ document }) => getLanguage(document) !== "german",
      options: { list: [{ title: "Germany", value: "germany" }] },
      description: "Optional.",
    }),

    defineField({
      name: "region_fr",
      title: "Region",
      type: "string",
      hidden: ({ document }) => getLanguage(document) !== "french",
      options: { list: [{ title: "France", value: "france" }] },
      description: "Optional.",
    }),

    defineField({
      name: "region_it",
      title: "Region",
      type: "string",
      hidden: ({ document }) => getLanguage(document) !== "italian",
      options: { list: [{ title: "Italy", value: "italy" }] },
      description: "Optional.",
    }),

    defineField({
      name: "region_pt",
      title: "Region",
      type: "string",
      hidden: ({ document }) => getLanguage(document) !== "portuguese",
      options: { list: [{ title: "Brazil", value: "brazil" }] },
      description: "Optional.",
    }),

    defineField({
      name: "level",
      title: "Broad level",
      type: "string",
      hidden: true,
      options: {
        list: [
          { title: "Beginner", value: "beginner" },
          { title: "Intermediate", value: "intermediate" },
          { title: "Advanced", value: "advanced" },
        ],
      },
      description: "Legacy broad difficulty bucket. Prefer CEFR level for precise progression.",
    }),

    defineField({
      name: "cefrLevel",
      title: "CEFR level",
      type: "string",
      options: {
        list: [
          { title: "A1", value: "a1" },
          { title: "A2", value: "a2" },
          { title: "B1", value: "b1" },
          { title: "B2", value: "b2" },
          { title: "C1", value: "c1" },
          { title: "C2", value: "c2" },
        ],
      },
      description: "Precise CEFR level for Journey and learner progression.",
    }),

    defineField({
      name: "focus",
      title: "Focus",
      type: "string",
      options: {
        list: [
          { title: "Adjectives", value: "adjectives" },
          { title: "Verbs", value: "verbs" },
          { title: "Nouns", value: "nouns" },
          { title: "Expressions", value: "expressions" },
          { title: "Mixed", value: "mixed" },
        ],
      },
    }),

    defineField({
      name: "topic",
      title: "Prompt topic",
      type: "string",
      description: "Optional free-text topic to guide generation. This does not place the story inside Journey.",
    }),

    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "title",
        maxLength: 96,
      },
      components: {
        input: (props: InputProps) => React.createElement(AutoSlugInput, props),
      },
    }),

    defineField({
      name: "synopsis",
      title: "Synopsis",
      type: "text",
      rows: 4,
      description:
        "Short synopsis used to generate the cover image. If empty, the story text will be used.",
    }),

    //
    // 🪄 GENERADOR CON CHATGPT — separado y sin sincronización
    //
    defineField({
      name: "generate",
      title: "🪄 Generate Story",
      type: "string",
      readOnly: true,
      components: {
        input: (props: InputProps) => {
          void props;
          return React.createElement(StoryGeneratorInput);
        },
      },
    }),

    //
    // 🖼️ COVER — editable desde Sanity (para historias de libros)
    //
    defineField({
      name: "text",
      title: "Main Text",
      type: "text",
      description:
        "Target length: about 2-3 minutes of audio (roughly 260-500 words). Keep it concise and dynamic.",
      components: {
        input: (props: InputProps) => React.createElement(StoryTextInput, props),
      },
      validation: (Rule) =>
        Rule.required().custom((value) => {
          if (typeof value !== "string" || value.trim() === "") {
            return "Main Text is required.";
          }
          if (countWords(value) < MIN_TEXT_WORDS) {
            return `Main Text is too short for ~2 minutes of audio (min ${MIN_TEXT_WORDS} words).`;
          }
          if (countWords(value) > MAX_TEXT_WORDS) {
            return `Main Text is too long for ~3 minutes of audio (max ${MAX_TEXT_WORDS} words).`;
          }
          if (/<\s*script\b/i.test(value)) {
            return "Main Text cannot contain <script> tags.";
          }
          return true;
        }),
    }),

    defineField({
      name: "checkStoryVocabQuality",
      title: "🔎 Check Story Vocabulary Quality",
      type: "string",
      readOnly: true,
      components: {
        input: () => React.createElement(StoryVocabQualityInput),
      },
    }),

    defineField({
      name: "storyVocabQualityRaw",
      title: "Story vocabulary quality report",
      type: "text",
      description: "Auto-generated lexical quality check for the story text.",
      rows: 8,
      readOnly: true,
    }),

    defineField({
      name: "generateVocab",
      title: "🧠 Generate Vocabulary",
      type: "string",
      readOnly: true,
      components: {
        input: () => React.createElement(VocabGeneratorInput),
      },
    }),

    defineField({
      name: "validateVocab",
      title: "✅ Validate & Fix Vocabulary",
      type: "string",
      readOnly: true,
      components: {
        input: () => React.createElement(VocabValidatorInput),
      },
    }),

    defineField({
      name: "vocabRaw",
      title: "Vocabulary (raw JSON or text)",
      type: "text",
      description:
        "This field stores the vocabulary list generated by ChatGPT. The system will parse it automatically.",
      rows: 10,
      validation: (Rule) => Rule.custom((value) => validateVocabRaw(value)),
    }),

    defineField({
      name: "vocabValidationRaw",
      title: "Vocabulary validation report",
      type: "text",
      description: "Auto-generated validation summary for the current vocabulary list.",
      rows: 8,
      readOnly: true,
    }),

    defineField({
      name: "generateCover",
      title: "🖼️ Generate Cover",
      type: "string",
      readOnly: true,
      components: {
        input: () => React.createElement(CoverGeneratorInput),
      },
    }),

    defineField({
      name: "cover",
      title: "Cover Image",
      type: "image",
      options: { hotspot: true },
    }),

    defineField({
      name: "generateAudio",
      title: "🎙️ Generate Audio",
      type: "string",
      readOnly: true,
      components: {
        input: () => React.createElement(AudioGeneratorInput),
      },
    }),

    defineField({
      name: "audio",
      title: "Audio File",
      type: "file",
      options: {
        storeOriginalFilename: true,
      },
      fields: [
        {
          name: "caption",
          type: "string",
          title: "Caption",
        },
      ],
    }),
    defineField({
      name: "audioQaStatus",
      title: "Audio QA status",
      type: "string",
      readOnly: true,
      options: {
        list: [
          { title: "Pass", value: "pass" },
          { title: "Warning", value: "warning" },
          { title: "Fail", value: "fail" },
          { title: "Unavailable", value: "unavailable" },
        ],
      },
      description: "Automatic QA result based on transcript similarity.",
    }),
    defineField({
      name: "audioQaScore",
      title: "Audio QA score",
      type: "number",
      readOnly: true,
      description: "Similarity score between expected narration and transcript (0 to 1).",
    }),
    defineField({
      name: "audioQaNotes",
      title: "Audio QA notes",
      type: "text",
      rows: 6,
      readOnly: true,
      description: "Automatic notes for the audio review team.",
    }),
    defineField({
      name: "audioQaTranscript",
      title: "Audio QA transcript",
      type: "text",
      rows: 8,
      readOnly: true,
      description: "Transcript used to compare the generated audio with the expected text.",
    }),
    defineField({
      name: "audioQaCheckedAt",
      title: "Audio QA checked at",
      type: "datetime",
      readOnly: true,
    }),
    defineField({
      name: "audioDeliveryQaStatus",
      title: "Audio delivery QA status",
      type: "string",
      readOnly: true,
      options: {
        list: [
          { title: "Pass", value: "pass" },
          { title: "Warning", value: "warning" },
          { title: "Fail", value: "fail" },
          { title: "Unavailable", value: "unavailable" },
        ],
      },
      description: "Automatic delivery QA result based on sentence pauses.",
    }),
    defineField({
      name: "audioDeliveryQaScore",
      title: "Audio delivery QA score",
      type: "number",
      readOnly: true,
      description: "Delivery score based on sentence pause timing (0 to 1).",
    }),
    defineField({
      name: "audioDeliveryQaNotes",
      title: "Audio delivery QA notes",
      type: "text",
      rows: 6,
      readOnly: true,
      description: "Automatic notes about pauses and possible unfinished sentence endings.",
    }),
    defineField({
      name: "audioDeliveryQaCheckedAt",
      title: "Audio delivery QA checked at",
      type: "datetime",
      readOnly: true,
    }),

    defineField({
      name: "published",
      title: "Published",
      type: "boolean",
      initialValue: false,
    }),
  ],

  preview: {
    select: { title: "title", cefrLevel: "cefrLevel", level: "level", media: "cover" },
    prepare({ title, cefrLevel, level, media }) {
      const subtitle =
        typeof cefrLevel === "string" && cefrLevel
          ? `CEFR ${cefrLevel.toUpperCase()}`
          : level
            ? `Level: ${level}`
            : null;
      return {
        title: title || "Untitled Story",
        subtitle: subtitle || "No level assigned",
        media,
      };
    },
  },
});
