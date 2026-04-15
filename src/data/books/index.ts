import type { Book } from "@/types/books";
import { colombianspanishstoriesforbeginners } from "./colombian-spanish-stories-for-beginners";
import { shortstoriesinargentinianspanishforbeginners } from "./short-stories-in-argentinian-spanish-for-beginners";
import { shortstoriesincolombianspanish } from "./short-stories-in-colombian-spanish";
import { spanishshortstorieson20mexicanwonders } from "./spanish-short-stories-on-20-mexican-wonders";

export const books: Record<string, Book> = {
  [colombianspanishstoriesforbeginners.id]: colombianspanishstoriesforbeginners,
  [shortstoriesinargentinianspanishforbeginners.id]: shortstoriesinargentinianspanishforbeginners,
  [shortstoriesincolombianspanish.id]: shortstoriesincolombianspanish,
  [spanishshortstorieson20mexicanwonders.id]: spanishshortstorieson20mexicanwonders,
};
