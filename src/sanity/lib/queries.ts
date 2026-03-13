// /src/sanity/lib/queries.ts
import { client } from "./client";
import { groq } from "next-sanity";

/**
 * 🧠 Trae historias publicadas de un libro específico
 * - Hereda metadatos del libro (idioma, región, nivel, enfoque, tema)
 * - Garantiza orden cronológico estable
 */
export async function getStoriesByBookId(bookId: string) {
  const query = groq`*[
    _type == "story" &&
    book->_id == $bookId &&
    published == true
  ]{
    _id,
    title,
    slug,
    text,
    vocabRaw,
    theme,

    // 🧩 Herencia de metadatos desde el libro
    "language": coalesce(language, book->language),
    "variant": coalesce(variant, book->variant),
    "region": coalesce(
      region_es,
      region_en,
      region_fr,
      region_it,
      region_pt,
      region_de,
      book->region_es,
      book->region_en,
      book->region_fr,
      book->region_it,
      book->region_pt,
      book->region_de
    ),
    "level": coalesce(level, book->level),
    "cefrLevel": coalesce(cefrLevel, book->cefrLevel),
    "focus": coalesce(focus, book->focus),
    "topic": coalesce(topic, book->topic),

    // 📖 Información básica del libro
    "book": {
      "id": book->_id,
      "title": book->title,
      "slug": book->slug.current,
      "cover": book->cover.asset->url
    }
  ] | order(_createdAt asc)`;

  return await client.fetch(query, { bookId });
}
