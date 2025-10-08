import type { Book } from "@/types/books";
import { colloquialgermanstories } from "./colloquial-german-stories";
import { shortstoriesinperuvianspanish } from "./short-stories-in-peruvian-spanish";

export const books: Record<string, Book> = {
  [colloquialgermanstories.id]: colloquialgermanstories,
  [shortstoriesinperuvianspanish.id]: shortstoriesinperuvianspanish,
};
