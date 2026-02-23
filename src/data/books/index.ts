import type { Book } from "@/types/books";
import { colloquialgermanstories } from "./colloquial-german-stories";
import { colombianspanishstoriesforbeginners } from "./colombian-spanish-stories-for-beginners";
import { shortstoriesincolombianspanish } from "./short-stories-in-colombian-spanish";
import { spanishshortstorieson20mexicanwonders } from "./spanish-short-stories-on-20-mexican-wonders";

export const books: Record<string, Book> = {
  [colloquialgermanstories.id]: colloquialgermanstories,
  [colombianspanishstoriesforbeginners.id]: colombianspanishstoriesforbeginners,
  [shortstoriesincolombianspanish.id]: shortstoriesincolombianspanish,
  [spanishshortstorieson20mexicanwonders.id]: spanishshortstorieson20mexicanwonders,
};
