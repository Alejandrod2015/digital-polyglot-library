// src/lib/queries.ts
import { sanityClient } from "./sanityClient";
import { groq } from "next-sanity";

// 🧠 Consulta GROQ para traer historias de un libro específico
export async function getStoriesByBookId(bookId: string) {
  const query = groq`*[_type == "story" && book->_id == $bookId && published == true]{
    _id,
    title,
    slug,
    text,
    vocabRaw,
    isFree,
    level,
    theme,
    "bookTitle": book->title
  } | order(_createdAt asc)`;

  return await sanityClient.fetch(query, { bookId });
}
