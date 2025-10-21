/* eslint-disable @typescript-eslint/ban-ts-comment */
// /src/sanity/schemaTypes/storyScheduler.ts
import { defineType, defineField } from "sanity";

export const storyScheduler = defineType({
  name: "storyScheduler",
  title: "📅 Story Scheduler",
  type: "document",

  // @ts-ignore — propiedad interna de Sanity usada para singletons
  __experimental_actions: ["update", "publish"],

  // @ts-ignore — opción no documentada pero funcional
  options: { singleton: true },

  fields: [
  // === 🗓️ STORY OF THE WEEK ===
  defineField({
    name: "currentWeeklyStory",
    title: "Current Story of the Week",
    type: "reference",
    to: [{ type: "story" }],
    description:
      "Historia destacada actualmente (de esta semana). Se elige automáticamente cada lunes o puede fijarse manualmente.",
  }),
  defineField({
    name: "nextWeeklyStory",
    title: "Next Week’s Story",
    type: "reference",
    to: [{ type: "story" }],
    description:
      "Historia programada para la próxima semana. Si no se define, el sistema elegirá una automáticamente al llegar el lunes.",
  }),
  defineField({
    name: "autoSelectWeekly",
    title: "Auto-select Weekly Story",
    type: "boolean",
    initialValue: true,
    description:
      "Si está activado, el sistema elegirá automáticamente la historia semanal si no hay una definida.",
  }),
  defineField({
    name: "weeklyUpdatedAt",
    title: "Last Weekly Update",
    type: "datetime",
    readOnly: true,
    description:
      "Fecha en la que se actualizó por última vez la historia semanal automáticamente.",
  }),
  defineField({
    name: "usedWeeklyStories",
    title: "Used Weekly Stories (auto)",
    type: "array",
    of: [{ type: "string" }],
    readOnly: true,
    hidden: true,
    description: "Lista interna de IDs de historias ya usadas para el modo semanal.",
  }),

  // === ☀️ STORY OF THE DAY ===
  defineField({
    name: "currentDailyStory",
    title: "Current Story of the Day",
    type: "reference",
    to: [{ type: "story" }],
    description:
      "Historia destacada actualmente (de hoy). Se elige automáticamente cada medianoche UTC o puede fijarse manualmente.",
  }),
  defineField({
    name: "nextDailyStory",
    title: "Next Day’s Story",
    type: "reference",
    to: [{ type: "story" }],
    description:
      "Historia programada para mañana. Si no se define, el sistema elegirá una automáticamente a medianoche.",
  }),
  defineField({
    name: "autoSelectDaily",
    title: "Auto-select Daily Story",
    type: "boolean",
    initialValue: true,
    description:
      "Si está activado, el sistema elegirá automáticamente la historia diaria si no hay una definida.",
  }),
  defineField({
    name: "dailyUpdatedAt",
    title: "Last Daily Update",
    type: "datetime",
    readOnly: true,
    description:
      "Fecha en la que se actualizó por última vez la historia diaria automáticamente.",
  }),
  defineField({
    name: "usedDailyStories",
    title: "Used Daily Stories (auto)",
    type: "array",
    of: [{ type: "string" }],
    readOnly: true,
    hidden: true,
    description: "Lista interna de IDs de historias ya usadas para el modo diario.",
  }),
],

  preview: {
    prepare() {
      return {
        title: "📅 Story Scheduler (único)",
        subtitle: "Control semanal y diario de historias",
      };
    },
  },
});
