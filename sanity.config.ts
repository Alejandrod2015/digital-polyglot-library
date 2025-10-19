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
    // DESPUÉS
structureTool({
  title: 'Content Structure',
  structure: (S) =>
    S.list()
      .title('Content')
      .items([
        S.listItem()
          .title('📚 Books → Stories')
          .schemaType('book')
          .child(
            S.documentTypeList('book')
              .title('Books')
              .child((bookId: string) =>
                S.documentList()
                  .title('Stories in this Book')
                  .filter('_type == "story" && references($bookId)')
                  .params({ bookId })
                  .initialValueTemplates([
                    S.initialValueTemplateItem('story-from-book', { bookId }),
                  ])
              )
          ),
        S.divider(),
        S.listItem()
          .title('📚 All Books')
          .schemaType('book')
          .child(S.documentTypeList('book').title('All Books')),
        S.listItem()
          .title('📘 Published Books')
          .schemaType('book')
          .child(
            S.documentList()
              .title('Published Books')
              .filter('_type == "book" && published == true')
          ),
        S.listItem()
          .title('📝 Published Stories')
          .schemaType('story')
          .child(
            S.documentList()
              .title('Published Stories')
              .filter('_type == "story" && published == true')
          ),
        S.listItem()
          .title('📄 All Stories')
          .schemaType('story')
          .child(S.documentTypeList('story').title('All Stories')),
        S.divider(),
        S.listItem()
          .title('⚙️ Marketing Settings')
          .child(
            S.document()
              .schemaType('marketingSettings')
              .documentId('marketingSettings')
              .title('Marketing Settings')
          ),
      ]),
}),

    // En v4 la opción es `apiVersion`
    visionTool({ apiVersion }),
  ],
})
