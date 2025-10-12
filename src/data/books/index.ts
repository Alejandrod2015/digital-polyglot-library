import type { Book } from "@/types/books";
import { colloquialgermanstories } from "./colloquial-german-stories";
import { shortstoriesincolombianspanish } from "./short-stories-in-colombian-spanish";

export const books: Record<string, Book> = {
  [colloquialgermanstories.id]: colloquialgermanstories,
  [shortstoriesincolombianspanish.id]: shortstoriesincolombianspanish,
};
