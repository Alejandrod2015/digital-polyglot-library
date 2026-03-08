// /src/sanity/schemaTypes/index.ts
import { type SchemaTypeDefinition } from "sanity";
import { book } from "./book";
import { story } from "./story";
import { standaloneStory } from "./standaloneStory";
import { storyScheduler } from "./storyScheduler";

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [book, story, standaloneStory, storyScheduler],
};
