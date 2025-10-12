// /src/sanity/templates/storyTemplate.ts
import { sanityClient } from "../lib/sanityClient";
import { groq } from "next-sanity";

export const storyTemplate = {
  id: "story-from-book",
  title: "New Story for this Book",
  schemaType: "story",
  parameters: [{ name: "bookId", title: "Book ID", type: "string" }],

  // hereda los metadatos del libro
  value: async (params: { bookId?: string } = {}) => {
    if (!params.bookId) {
      return { published: false };
    }

    // obtenemos el libro con los campos que interesan
    const query = groq`*[_type == "book" && _id == $id][0]{
      language,
      region,
      level,
      topic,
      formality
    }`;
    const bookData = await sanityClient.fetch(query, { id: params.bookId });

    // según el idioma, asignamos la región al campo correcto
    const regionMap: Record<string, string> = {
      spanish: "region_es",
      english: "region_en",
      german: "region_de",
      french: "region_fr",
      italian: "region_it",
      portuguese: "region_pt",
    };

    const regionField = regionMap[bookData?.language ?? ""] ?? null;

    return {
      book: { _type: "reference", _ref: params.bookId },
      published: false,
      language: bookData?.language || null,
      [regionField ?? "region_es"]: bookData?.region || null, // coloca la región en el campo correspondiente
      level: bookData?.level || null,
      topic: bookData?.topic || null,
      formality: bookData?.formality || "neutral",
    };
  },
} as const;
