import type { Book } from "@digital-polyglot/domain";
import { books as webBooks } from "../../../../src/data/books";

export const fullMobileCatalog: Book[] = Object.values(webBooks);
