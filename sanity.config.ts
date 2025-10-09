'use client'

/**
 * Configuración del Sanity Studio.
 * Funciona tanto en desarrollo (Next.js) como en Sanity Cloud.
 */

import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'

import { schema } from './src/sanity/schemaTypes'
import { structure } from './src/sanity/structure'

const projectId = '9u7ilulp'
const dataset = 'production'
const apiVersion = '2025-10-05'

export default defineConfig({
  basePath: '/studio',
  name: 'digital-polyglot-studio',
  title: 'Digital Polyglot',
  projectId,
  dataset,
  schema,
  plugins: [
    structureTool({ structure }),
    visionTool({ defaultApiVersion: apiVersion }),
  ],
})
