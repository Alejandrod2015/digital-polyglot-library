// /src/sanity/schemaTypes/story.ts
import { defineField, defineType } from "sanity";
import type { InputProps } from "sanity";
import React from "react";
import StoryGeneratorInput from "../components/StoryGeneratorInput";

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
    input: function SyncBookMetadataComponent(props) {
      const { document, onChange } = props as any;

      // eslint-disable-next-line react-hooks/rules-of-hooks
      React.useEffect(() => {
        const run = async () => {
          const bookRef = document?.book?._ref;
          if (!bookRef) return;

          try {
            const query = `*[_type == "book" && _id == $id][0]{
              language, region, level, topic, formality
            }`;

            const response = await fetch("/api/sanity-query", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ query, params: { id: bookRef } }),
            });

            const { result: bookData } = await response.json();
            if (!bookData) return;

            const b = bookData;
            const regionFieldMap: Record<string, string> = {
              spanish: "region_es",
              english: "region_en",
              german: "region_de",
              french: "region_fr",
              italian: "region_it",
              portuguese: "region_pt",
            };

            const regionField = regionFieldMap[b.language];

            const patch = [
              { type: "set", path: ["language"], value: b.language },
              { type: "set", path: ["level"], value: b.level },
              { type: "set", path: ["topic"], value: b.topic },
              { type: "set", path: ["formality"], value: b.formality },
            ];

            if (regionField)
              patch.push({ type: "set", path: [regionField], value: b.region });

            patch.forEach((p) => onChange(p));
          } catch (err) {
            console.error("Error syncing book metadata:", err);
          }
        };

        run();
      }, [document?.book?._ref, onChange]);

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
      name: "region_es",
      title: "Region",
      type: "string",
      hidden: ({ document }) => document?.language !== "spanish",
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
      hidden: ({ document }) => document?.language !== "english",
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
      hidden: ({ document }) => document?.language !== "german",
      options: { list: [{ title: "Germany", value: "germany" }] },
      description: "Optional.",
    }),

    defineField({
      name: "region_fr",
      title: "Region",
      type: "string",
      hidden: ({ document }) => document?.language !== "french",
      options: { list: [{ title: "France", value: "france" }] },
      description: "Optional.",
    }),

    defineField({
      name: "region_it",
      title: "Region",
      type: "string",
      hidden: ({ document }) => document?.language !== "italian",
      options: { list: [{ title: "Italy", value: "italy" }] },
      description: "Optional.",
    }),

    defineField({
      name: "region_pt",
      title: "Region",
      type: "string",
      hidden: ({ document }) => document?.language !== "portuguese",
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
      description: "Formality level inherited from the book.",
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
    // 🪶 OUTPUT SECTION — resultado generado y metadatos
    //
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
    }),

    defineField({
      name: "text",
      title: "Main Text",
      type: "text",
    }),

    defineField({
      name: "vocabRaw",
      title: "Vocabulary (raw JSON or text)",
      type: "text",
      description:
        "This field stores the vocabulary list generated by ChatGPT. The system will parse it automatically.",
      rows: 10,
    }),

    defineField({
      name: "theme",
      title: "Theme / Topics",
      type: "array",
      of: [{ type: "string" }],
      description: "Cultural or contextual topics covered by the story.",
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
    select: { title: "title", level: "level" },
    prepare({ title, level }) {
      const subtitle = level ? `Level: ${level}` : null;
      return {
        title: title || "Untitled Story",
        subtitle: subtitle || "No level assigned",
      };
    },
  },
});
