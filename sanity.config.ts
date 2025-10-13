// sanity.config.ts
// @ts-nocheck
import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'

import { schema } from './src/sanity/schemaTypes'
import { structure } from './src/sanity/structure'
import { storyTemplate } from './src/sanity/templates/storyTemplate'

const projectId = '9u7ilulp'
const dataset = 'production'
const apiVersion = '2025-10-05'

// Normaliza: array o { types }
const types = Array.isArray(schema) ? schema : schema?.types ?? []

export default defineConfig({
  name: 'digital-polyglot-studio',
  title: 'Digital Polyglot',
  basePath: '/studio',
  projectId,
  dataset,

  schema: {
    types,
    templates: (prev) => [
      ...(Array.isArray(prev) ? prev : []),
      storyTemplate,
    ],
  },

  plugins: [
    structureTool({
      title: 'Content Structure',
      structure,
    }),
    // En v4 la opción es `apiVersion`
    visionTool({ apiVersion }),
  ],
})
