// DESPUÉS — /src/sanity/schemaTypes/book.ts
import { defineField, defineType } from "sanity";

export const book = defineType({
  name: "book",
  title: "Book",
  type: "document",
  fields: [
    // 📘 Información general
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
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "id",
      title: "Book ID",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "text",
    }),
    defineField({
      name: "cover",
      title: "Cover Image",
      type: "image",
    }),
    defineField({
      name: "audioFolder",
      title: "Audio Folder",
      type: "string",
    }),

    // 🛒 Enlace al libro físico en tienda
    defineField({
      name: "storeUrl",
      title: "Physical Book URL",
      type: "url",
      description:
        "Optional: link to the physical version of this book in the online store.",
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
      name: "region",
      title: "Region",
      type: "string",
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
      description: "Optional: region variant or accent used in the book.",
    }),

    defineField({
      name: "level",
      title: "Level",
      type: "string",
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
      name: "topic",
      title: "Topic",
      type: "string",
      description: "Main subject or theme of the book (e.g., Travel, Food).",
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
    }),

    defineField({
      name: "published",
      title: "Published",
      type: "boolean",
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
