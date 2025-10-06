import { type SchemaTypeDefinition } from 'sanity';
import { book } from './book';
import { story } from './story';

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [book, story],
};
