import type { Book } from "@/types/books";
import { colloquialgermanstories } from "./colloquial-german-stories";
import { shortstoriesinperuvianspanish } from "./short-stories-in-peruvian-spanish";
import { shortstoriesincolombianspanish } from "./short-stories-in-colombian-spanish";

export const books: Record<string, Book> = {
  [colloquialgermanstories.id]: colloquialgermanstories,
  [shortstoriesinperuvianspanish.id]: shortstoriesinperuvianspanish,
  [shortstoriesincolombianspanish.id]: shortstoriesincolombianspanish,
};
