import { type SchemaTypeDefinition } from 'sanity';
import { book } from './book';
import { story } from './story';
import { marketingSettings } from './marketingSettings';

export const schema: { types: SchemaTypeDefinition[] } = {
  types: [book, story, marketingSettings],
};
