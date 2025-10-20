// /sanity.config.ts
// @ts-nocheck
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";

import { schema } from "./src/sanity/schemaTypes";
import { storyTemplate } from "./src/sanity/templates/storyTemplate";
import { structure } from "./src/sanity/structure"; // ✅ Importa tu estructura personalizada

const projectId = "9u7ilulp";
const dataset = "production";
const apiVersion = "2025-10-05";

// Normaliza: array o { types }
const types = Array.isArray(schema) ? schema : schema?.types ?? [];

export default defineConfig({
  name: "digital-polyglot-studio",
  title: "Digital Polyglot",
  basePath: "/studio",
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
    // ✅ Usa la estructura desde tu archivo `src/sanity/structure.ts`
    structureTool({
      title: "Content Structure",
      structure,
    }),

    // 🔍 Herramienta de consultas GROQ
    visionTool({ apiVersion }),
  ],
});
