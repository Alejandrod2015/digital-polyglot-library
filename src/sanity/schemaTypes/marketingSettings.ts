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
        "Selecciona manualmente las historias que estarán disponibles gratuitamente para usuarios free. Solo la primera será la 'Story of the Week'. Si está vacío, el sistema elegirá una automáticamente.",
    }),
    defineField({
      name: "usedStories",
      title: "Historias ya usadas (automático)",
      type: "array",
      of: [{ type: "string" }],
      readOnly: true,
      hidden: true,
      description:
        "Registro interno de historias ya elegidas automáticamente para no repetirlas hasta agotar todas.",
    }),
  ],
  preview: {
    prepare() {
      return { title: "Configuración de marketing" };
    },
  },
});
