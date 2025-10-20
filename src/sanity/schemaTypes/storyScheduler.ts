// /src/sanity/schemaTypes/storyScheduler.ts
import { defineType, defineField } from "sanity";

export const storyScheduler = defineType({
  name: "storyScheduler",
  title: "📅 Story Scheduler",
  type: "document",

  // @ts-ignore — propiedad interna de Sanity usada para singletons
  __experimental_actions: ["update", "publish"],
  // @ts-ignore
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

    // === ☀️ STORY OF THE DAY (preparado para el futuro) ===
    defineField({
      name: "currentDailyStory",
      title: "Current Story of the Day",
      type: "reference",
      to: [{ type: "story" }],
      description:
        "Historia destacada actualmente (de hoy). Solo visible si el sistema diario está activado.",
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
      initialValue: false,
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
