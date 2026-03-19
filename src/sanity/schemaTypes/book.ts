// DESPUÉS — /src/sanity/schemaTypes/book.ts
import { defineField, defineType } from "sanity";
import React from "react";
import { broadLevelFromCefr } from "../../lib/cefr";

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

function getCefrLevel(doc: unknown): string | null {
  if (!isRecord(doc)) return null;
  const cefrLevel = doc.cefrLevel;
  return typeof cefrLevel === "string" && cefrLevel.length > 0 ? cefrLevel : null;
}

export const book = defineType({
  name: "book",
  title: "Book",
  type: "document",
  fieldsets: [
    { name: "basics", title: "Basics", options: { columns: 2 } },
    { name: "commerce", title: "Commerce", options: { columns: 2 } },
    { name: "language", title: "Language & Level", options: { columns: 3 } },
    { name: "publishing", title: "Publishing", options: { columns: 2 } },
  ],
  fields: [
    // 📘 Información general
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      fieldset: "basics",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      fieldset: "basics",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "id",
      title: "Book ID",
      type: "slug",
      fieldset: "basics",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
      fieldset: "basics",
    }),
    defineField({
      name: "cover",
      title: "Cover Image",
      type: "image",
      fieldset: "basics",
    }),
    defineField({
      name: "audioFolder",
      title: "Audio Folder",
      type: "string",
      fieldset: "basics",
    }),

    // 🛒 Enlace al libro físico en tienda
    defineField({
      name: "storeUrl",
      title: "Physical Book URL",
      type: "url",
      fieldset: "commerce",
      validation: (Rule) =>
        Rule.uri({
          allowRelative: false,
          scheme: ["http", "https"],
        }),
    }),

    // 🌍 Metadatos lingüísticos
    defineField({
      name: "language",
      title: "Language",
      type: "string",
      fieldset: "language",
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
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "variant",
      title: "Variant",
      type: "string",
      fieldset: "language",
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
      name: "region",
      title: "Region",
      type: "string",
      fieldset: "language",
      options: {
        list: [
          { title: "Spain", value: "spain" },
          { title: "Mexico", value: "mexico" },
          { title: "Argentina", value: "argentina" },
          { title: "Colombia", value: "colombia" },
          { title: "Chile", value: "chile" },
          { title: "Peru", value: "peru" },
          { title: "USA", value: "usa" },
          { title: "UK", value: "uk" },
          { title: "Canada", value: "canada" },
          { title: "Australia", value: "australia" },
          { title: "France", value: "france" },
          { title: "Germany", value: "germany" },
          { title: "Italy", value: "italy" },
          { title: "Brazil", value: "brazil" },
        ],
      },
    }),

    defineField({
      name: "level",
      title: "Broad level",
      type: "string",
      fieldset: "language",
      hidden: true,
      components: {
        input: function SyncBroadLevelComponent(props: unknown) {
          const { document, onChange } = props as SyncInputProps;

          React.useEffect(() => {
            const cefrLevel = getCefrLevel(document);
            const broadLevel = broadLevelFromCefr(cefrLevel);
            if (!broadLevel) return;
            onChange({ type: "set", path: ["level"], value: broadLevel });
          }, [document, onChange]);

          return null;
        },
      },
      options: {
        list: [
          { title: "Beginner (A1-A2)", value: "beginner" },
          { title: "Intermediate (B1-B2)", value: "intermediate" },
          { title: "Advanced (C1-C2)", value: "advanced" },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "cefrLevel",
      title: "CEFR level",
      type: "string",
      fieldset: "language",
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
      name: "topic",
      title: "Topic",
      type: "string",
      fieldset: "language",
    }),

    defineField({
      name: "published",
      title: "Published",
      type: "boolean",
      fieldset: "publishing",
      initialValue: false,
    }),
  ],

  preview: {
    select: {
      title: "title",
      subtitle: "language",
      media: "cover",
    },
    prepare({ title, subtitle, media }) {
      return {
        title,
        subtitle: subtitle ? `Language: ${subtitle}` : "No language set",
        media,
      };
    },
  },
});
