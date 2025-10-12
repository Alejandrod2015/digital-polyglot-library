'use client'

import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'

import { schema } from './src/sanity/schemaTypes'
import { structure } from './src/sanity/structure'
import { storyTemplate } from './src/sanity/templates/storyTemplate'

const projectId = '9u7ilulp'
const dataset = 'production'
const apiVersion = '2025-10-05'

// 🧩 Extendemos schema con templates
const extendedSchema = {
  ...schema,
  templates: (prev: any[]) => [...(prev || []), storyTemplate],
}

export default defineConfig({
  name: 'digital-polyglot-studio',
  title: 'Digital Polyglot',
  basePath: '/studio',
  projectId,
  dataset,

  // ✅ Sanity 3+ espera el schema como objeto plano
  schema: extendedSchema,

  // ✅ Orden correcto de plugins
  plugins: [
    structureTool({
      name: 'content-structure',
      title: 'Content Structure',
      structure, // 👈 Aquí pasamos la función del archivo structure.ts
    }),
    visionTool({ defaultApiVersion: apiVersion }),
  ],
})
