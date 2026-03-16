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
import JourneyTopicInput from "../components/JourneyTopicInput";
import VisitStoryPageInput from "../components/VisitStoryPageInput";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getLanguage(doc: unknown): string | null {
  if (!isRecord(doc)) return null;
  const language = doc.language;
  return typeof language === "string" && language.length > 0 ? language : null;
}

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

export const standaloneStory = defineType({
  name: "standaloneStory",
  title: "Standalone Story",
  type: "document",
  fieldsets: [
    { name: "metadata", title: "Metadata", options: { columns: 3 } },
    { name: "journey", title: "Journey", options: { columns: 2 } },
    { name: "generation", title: "Generation", options: { columns: 2 } },
    { name: "content", title: "Content", options: { columns: 1 } },
    { name: "vocab", title: "Vocabulary", options: { columns: 2 } },
    { name: "media", title: "Cover & Audio", options: { columns: 1 } },
    { name: "qa", title: "QA Reports", options: { columns: 2 } },
    { name: "publishing", title: "Publishing", options: { columns: 2 } },
  ],
  fields: [
    defineField({
      name: "sourceType",
      title: "Source type",
      type: "string",
      hidden: true,
      initialValue: "sanity",
      options: {
        list: [
          { title: "Sanity", value: "sanity" },
          { title: "Create", value: "create" },
        ],
      },
    }),
    defineField({
      name: "createStoryId",
      title: "Create story id",
      type: "string",
      hidden: true,
      readOnly: true,
    }),
    defineField({
      name: "createStoryUserId",
      title: "Create story user id",
      type: "string",
      hidden: true,
      readOnly: true,
    }),
    defineField({
      name: "language",
      title: "Language",
      type: "string",
      fieldset: "metadata",
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
      fieldset: "metadata",
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
    }),

    defineField({
      name: "region_es",
      title: "Region",
      type: "string",
      fieldset: "metadata",
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
    }),
    defineField({
      name: "region_en",
      title: "Region",
      type: "string",
      fieldset: "metadata",
      hidden: ({ document }) => getLanguage(document) !== "english",
      options: {
        list: [
          { title: "United States", value: "usa" },
          { title: "United Kingdom", value: "uk" },
          { title: "Australia", value: "australia" },
          { title: "Canada", value: "canada" },
        ],
      },
    }),
    defineField({
      name: "region_de",
      title: "Region",
      type: "string",
      fieldset: "metadata",
      hidden: ({ document }) => getLanguage(document) !== "german",
      options: { list: [{ title: "Germany", value: "germany" }] },
    }),
    defineField({
      name: "region_fr",
      title: "Region",
      type: "string",
      fieldset: "metadata",
      hidden: ({ document }) => getLanguage(document) !== "french",
      options: { list: [{ title: "France", value: "france" }] },
    }),
    defineField({
      name: "region_it",
      title: "Region",
      type: "string",
      fieldset: "metadata",
      hidden: ({ document }) => getLanguage(document) !== "italian",
      options: { list: [{ title: "Italy", value: "italy" }] },
    }),
    defineField({
      name: "region_pt",
      title: "Region",
      type: "string",
      fieldset: "metadata",
      hidden: ({ document }) => getLanguage(document) !== "portuguese",
      options: { list: [{ title: "Brazil", value: "brazil" }] },
    }),

    defineField({
      name: "level",
      title: "Broad level",
      type: "string",
      fieldset: "metadata",
      hidden: true,
      options: {
        list: [
          { title: "Beginner", value: "beginner" },
          { title: "Intermediate", value: "intermediate" },
          { title: "Advanced", value: "advanced" },
        ],
      },
    }),

    defineField({
      name: "cefrLevel",
      title: "CEFR level",
      type: "string",
      fieldset: "metadata",
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
    }),

    defineField({
      name: "focus",
      title: "Focus",
      type: "string",
      fieldset: "metadata",
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
      fieldset: "metadata",
    }),

    defineField({
      name: "journeyEligible",
      title: "Show in Journey",
      type: "boolean",
      fieldset: "journey",
      initialValue: false,
    }),

    defineField({
      name: "journeyTopic",
      title: "Journey topic",
      type: "string",
      fieldset: "journey",
      hidden: ({ document }) => !Boolean((document as { journeyEligible?: boolean } | undefined)?.journeyEligible),
      components: {
        input: JourneyTopicInput,
      },
    }),

    defineField({
      name: "journeyOrder",
      title: "Journey order",
      type: "number",
      fieldset: "journey",
      hidden: ({ document }) => !Boolean((document as { journeyEligible?: boolean } | undefined)?.journeyEligible),
      validation: (Rule) => Rule.integer().min(1),
    }),

    defineField({
      name: "title",
      title: "Title",
      type: "string",
      fieldset: "content",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      fieldset: "content",
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
      fieldset: "content",
      rows: 4,
    }),

    defineField({
      name: "generate",
      title: "🪄 Generate Story",
      type: "string",
      fieldset: "generation",
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
      fieldset: "content",
      components: {
        input: (props: InputProps) => React.createElement(StoryTextInput, props),
      },
      validation: (Rule) =>
        Rule.required().custom((value) => {
          if (typeof value !== "string" || value.trim() === "") {
            return "Main Text is required.";
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
      fieldset: "vocab",
      readOnly: true,
      components: {
        input: () => React.createElement(StoryVocabQualityInput),
      },
    }),
    defineField({
      name: "storyVocabQualityRaw",
      title: "Story vocabulary quality report",
      type: "text",
      fieldset: "qa",
      rows: 8,
      readOnly: true,
    }),
    defineField({
      name: "generateVocab",
      title: "🧠 Generate Vocabulary",
      type: "string",
      fieldset: "vocab",
      readOnly: true,
      components: {
        input: () => React.createElement(VocabGeneratorInput),
      },
    }),
    defineField({
      name: "validateVocab",
      title: "✅ Validate & Fix Vocabulary",
      type: "string",
      fieldset: "vocab",
      readOnly: true,
      components: {
        input: () => React.createElement(VocabValidatorInput),
      },
    }),
    defineField({
      name: "vocabRaw",
      title: "Vocabulary (raw JSON or text)",
      type: "text",
      fieldset: "vocab",
      rows: 10,
      validation: (Rule) => Rule.custom((value) => validateVocabRaw(value)),
    }),
    defineField({
      name: "vocabValidationRaw",
      title: "Vocabulary validation report",
      type: "text",
      fieldset: "qa",
      rows: 8,
      readOnly: true,
    }),
    defineField({
      name: "generateCover",
      title: "🖼️ Generate Cover",
      type: "string",
      fieldset: "media",
      readOnly: true,
      components: {
        input: () => React.createElement(CoverGeneratorInput),
      },
    }),
    defineField({
      name: "cover",
      title: "Cover Image",
      type: "image",
      fieldset: "media",
      options: { hotspot: true },
    }),
    defineField({
      name: "generateAudio",
      title: "🎙️ Generate Audio",
      type: "string",
      fieldset: "media",
      readOnly: true,
      components: {
        input: () => React.createElement(AudioGeneratorInput),
      },
    }),
    defineField({
      name: "audio",
      title: "Audio File",
      type: "file",
      fieldset: "media",
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
      fieldset: "qa",
      readOnly: true,
      options: {
        list: [
          { title: "Pass", value: "pass" },
          { title: "Warning", value: "warning" },
          { title: "Fail", value: "fail" },
          { title: "Unavailable", value: "unavailable" },
        ],
      },
    }),
    defineField({
      name: "audioQaScore",
      title: "Audio QA score",
      type: "number",
      fieldset: "qa",
      readOnly: true,
    }),
    defineField({
      name: "audioQaNotes",
      title: "Audio QA notes",
      type: "text",
      fieldset: "qa",
      rows: 6,
      readOnly: true,
    }),
    defineField({
      name: "audioQaTranscript",
      title: "Audio QA transcript",
      type: "text",
      fieldset: "qa",
      rows: 8,
      readOnly: true,
    }),
    defineField({
      name: "audioQaCheckedAt",
      title: "Audio QA checked at",
      type: "datetime",
      fieldset: "qa",
      readOnly: true,
    }),
    defineField({
      name: "audioDeliveryQaStatus",
      title: "Audio delivery QA status",
      type: "string",
      fieldset: "qa",
      readOnly: true,
      options: {
        list: [
          { title: "Pass", value: "pass" },
          { title: "Warning", value: "warning" },
          { title: "Fail", value: "fail" },
          { title: "Unavailable", value: "unavailable" },
        ],
      },
    }),
    defineField({
      name: "audioDeliveryQaScore",
      title: "Audio delivery QA score",
      type: "number",
      fieldset: "qa",
      readOnly: true,
    }),
    defineField({
      name: "audioDeliveryQaNotes",
      title: "Audio delivery QA notes",
      type: "text",
      fieldset: "qa",
      rows: 6,
      readOnly: true,
    }),
    defineField({
      name: "audioDeliveryQaCheckedAt",
      title: "Audio delivery QA checked at",
      type: "datetime",
      fieldset: "qa",
      readOnly: true,
    }),

    defineField({
      name: "published",
      title: "Published",
      type: "boolean",
      fieldset: "publishing",
      initialValue: false,
    }),
    defineField({
      name: "visitStoryPage",
      title: "Visit Story Page",
      type: "string",
      fieldset: "publishing",
      readOnly: true,
      components: {
        input: VisitStoryPageInput,
      },
    }),
  ],

  preview: {
    select: { title: "title", cefrLevel: "cefrLevel", level: "level", media: "cover", sourceType: "sourceType" },
    prepare({ title, cefrLevel, level, media, sourceType }) {
      const sourceLabel = sourceType === "create" ? "Create" : "Standalone";
      const subtitle =
        typeof cefrLevel === "string" && cefrLevel
          ? `${sourceLabel} • CEFR ${cefrLevel.toUpperCase()}`
          : level
            ? `${sourceLabel} • Level: ${level}`
            : `${sourceLabel} story`;
      return {
        title: title || "Untitled Story",
        subtitle,
        media,
      };
    },
  },
});
