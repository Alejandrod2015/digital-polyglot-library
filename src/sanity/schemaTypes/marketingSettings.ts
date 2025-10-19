// /src/sanity/schemaTypes/marketingSettings.ts
import { defineType, defineField } from "sanity";

export const marketingSettings = defineType({
  name: "marketingSettings",
  title: "Marketing Settings",
  type: "document",
  // @ts-expect-error — propiedad válida usada para singletons
  __experimental_actions: ["update", "publish"],
  fields: [
    defineField({
      name: "promotionalStories",
      title: "Historias promocionales",
      type: "array",
      of: [{ type: "reference", to: [{ type: "story" }] }],
      description:
        "Selecciona las historias que estarán disponibles gratuitamente para usuarios free. Solo la primera será la 'Story of the Week'.",
    }),
  ],
  preview: {
    prepare() {
      return { title: "Configuración de marketing" };
    },
  },
});
