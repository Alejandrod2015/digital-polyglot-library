// /src/sanity/schemaTypes/marketingSettings.ts

import { defineType, defineField } from 'sanity';

export const marketingSettings = defineType({
  name: 'marketingSettings',
  title: 'Marketing Settings',
  type: 'document',
  fields: [
    defineField({
      name: 'promotionalStories',
      title: 'Historias promocionales',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'story' }] }],
      description:
        'Selecciona las historias que estarán disponibles gratuitamente para usuarios free.',
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Configuración de marketing' };
    },
  },
});
