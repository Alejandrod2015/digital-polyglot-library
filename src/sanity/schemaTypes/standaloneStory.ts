import { defineField, defineType } from "sanity";
import type { InputProps } from "sanity";
import React from "react";
import StoryGeneratorInput from "../components/StoryGeneratorInput";
import CoverGeneratorInput from "../components/CoverGeneratorInput";
import VocabGeneratorInput from "../components/VocabGeneratorInput";
import AudioGeneratorInput from "../components/AudioGeneratorInput";
import StoryTextInput from "../components/StoryTextInput";
import AutoSlugInput from "../components/AutoSlugInput";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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

export const standaloneStory = defineType({
  name: "standaloneStory",
  title: "Standalone Story",
  type: "document",
  fields: [
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
      title: "Level",
      type: "string",
      options: {
        list: [
          { title: "Beginner", value: "beginner" },
          { title: "Intermediate", value: "intermediate" },
          { title: "Advanced", value: "advanced" },
        ],
      },
    }),

    defineField({
      name: "formality",
      title: "Formality",
      type: "string",
      options: {
        list: [
          { title: "Informal", value: "informal" },
          { title: "Neutral", value: "neutral" },
          { title: "Formal", value: "formal" },
        ],
      },
      initialValue: "neutral",
      description: "Use this for the overall register of the story.",
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
          { title: "Slang", value: "slang" },
        ],
      },
    }),

    defineField({
      name: "topic",
      title: "Topic",
      type: "string",
      description: "Free text topic for the story theme.",
    }),

    defineField({
      name: "theme",
      title: "Theme / Topics",
      type: "array",
      of: [{ type: "string" }],
      description: "Cultural or contextual topics covered by the story.",
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
      description: "Short synopsis used to guide the story and cover generation.",
    }),

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
      name: "generateVocab",
      title: "🧠 Generate Vocabulary",
      type: "string",
      readOnly: true,
      components: {
        input: () => React.createElement(VocabGeneratorInput),
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
      name: "published",
      title: "Published",
      type: "boolean",
      initialValue: false,
    }),
  ],

  preview: {
    select: { title: "title", level: "level", media: "cover" },
    prepare({ title, level, media }) {
      const subtitle = level ? `Standalone • Level: ${level}` : "Standalone story";
      return {
        title: title || "Untitled Story",
        subtitle,
        media,
      };
    },
  },
});
