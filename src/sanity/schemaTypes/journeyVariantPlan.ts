import { defineArrayMember, defineField, defineType } from "sanity";

export const journeyVariantPlan = defineType({
  name: "journeyVariantPlan",
  title: "Journey Variant Plan",
  type: "document",
  fields: [
    defineField({
      name: "language",
      title: "Language",
      type: "string",
      validation: (Rule) => Rule.required(),
      options: {
        list: [
          { title: "Spanish", value: "Spanish" },
          { title: "English", value: "English" },
          { title: "Portuguese", value: "Portuguese" },
          { title: "French", value: "French" },
          { title: "Italian", value: "Italian" },
          { title: "German", value: "German" },
        ],
      },
    }),
    defineField({
      name: "variantId",
      title: "Variant ID",
      type: "string",
      validation: (Rule) => Rule.required(),
      description: "Must match the runtime variant id, for example latam or spain.",
    }),
    defineField({
      name: "levels",
      title: "Levels",
      type: "array",
      validation: (Rule) => Rule.required().min(1),
      of: [
        defineArrayMember({
          type: "object",
          name: "journeyLevelPlan",
          fields: [
            defineField({
              name: "id",
              title: "Level ID",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "title",
              title: "Title",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "subtitle",
              title: "Subtitle",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "topicTarget",
              title: "Topic target",
              type: "number",
              validation: (Rule) => Rule.required().integer().min(1),
            }),
            defineField({
              name: "storyTargetPerTopic",
              title: "Story target per topic",
              type: "number",
              validation: (Rule) => Rule.required().integer().min(1),
            }),
            defineField({
              name: "topics",
              title: "Topics",
              type: "array",
              validation: (Rule) => Rule.required().min(1),
              of: [
                defineArrayMember({
                  type: "object",
                  name: "journeyTopicPlan",
                  fields: [
                    defineField({
                      name: "slug",
                      title: "Slug",
                      type: "string",
                      validation: (Rule) => Rule.required(),
                    }),
                    defineField({
                      name: "label",
                      title: "Label",
                      type: "string",
                      validation: (Rule) => Rule.required(),
                    }),
                    defineField({
                      name: "storyTarget",
                      title: "Story target",
                      type: "number",
                      validation: (Rule) => Rule.required().integer().min(1),
                    }),
                  ],
                  preview: {
                    select: {
                      title: "label",
                      subtitle: "slug",
                    },
                  },
                }),
              ],
            }),
          ],
          preview: {
            select: {
              title: "title",
              subtitle: "subtitle",
            },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: {
      title: "variantId",
      subtitle: "language",
    },
    prepare(selection) {
      return {
        title: selection.title ? `Journey: ${selection.title}` : "Journey Variant Plan",
        subtitle: selection.subtitle ?? "No language",
      };
    },
  },
});
