// /src/sanity/schemaTypes/index.ts
import { type SchemaTypeDefinition } from "sanity";
import { book } from "./book";
import { story } from "./story";
import { storyScheduler } from "./storyScheduler";

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [book, story, storyScheduler],
};
