// GENERADO por scripts/genBooksDump.ts desde la BD del catálogo.
import type { Book } from "@/types/books";
import { colombianspanishstoriesforbeginners } from "./colombian-spanish-stories-for-beginners";
import { italianshortstoriesfrommysteriousvenice } from "./italian-short-stories-from-mysterious-venice";
import { shortstoriesinargentinianspanish } from "./short-stories-in-argentinian-spanish";
import { shortstoriesinargentinianspanishforbeginners } from "./short-stories-in-argentinian-spanish-for-beginners";
import { shortstoriesincolombianspanish } from "./short-stories-in-colombian-spanish";
import { shortstoriesinmexicanspanish } from "./short-stories-in-mexican-spanish";
import { spanishshortstorieson20mexicanwonders } from "./spanish-short-stories-on-20-mexican-wonders";

export const books: Record<string, Book> = {
  [colombianspanishstoriesforbeginners.id]: colombianspanishstoriesforbeginners,
  [italianshortstoriesfrommysteriousvenice.id]: italianshortstoriesfrommysteriousvenice,
  [shortstoriesinargentinianspanish.id]: shortstoriesinargentinianspanish,
  [shortstoriesinargentinianspanishforbeginners.id]: shortstoriesinargentinianspanishforbeginners,
  [shortstoriesincolombianspanish.id]: shortstoriesincolombianspanish,
  [shortstoriesinmexicanspanish.id]: shortstoriesinmexicanspanish,
  [spanishshortstorieson20mexicanwonders.id]: spanishshortstorieson20mexicanwonders,
};
