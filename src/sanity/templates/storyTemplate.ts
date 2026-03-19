// /src/sanity/templates/storyTemplate.ts
import { client } from "../lib/client";
import { groq } from "next-sanity";

export const storyTemplate = {
  id: "story-from-book",
  title: "New Story for this Book",
  schemaType: "story",
  parameters: [
    { name: "bookId", title: "Book ID", type: "string" },
    { name: "sourceBookId", title: "Source Book ID", type: "string" },
  ],

  // hereda los metadatos del libro
  value: async (params: { bookId?: string; sourceBookId?: string } = {}) => {
    if (!params.bookId) {
      return { published: false };
    }

    const sourceBookId = params.sourceBookId || params.bookId;
    const storyBookRef = sourceBookId;

    // obtenemos el libro con los campos que interesan
    const query = groq`coalesce(
      *[_type == "book" && _id == $sourceId][0]{
        _id,
        language,
        region,
        level,
        topic,
        cefrLevel
      },
      *[_type == "book" && _id == $publishedId][0]{
        _id,
        language,
        region,
        level,
        topic,
        cefrLevel
      }
    )`;
    const bookData = await client.fetch(query, {
      sourceId: sourceBookId,
      publishedId: params.bookId,
    });

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
    const resolvedBookRef =
      typeof bookData?._id === "string" && bookData._id.length > 0 ? bookData._id : storyBookRef;

    return {
      book: { _type: "reference", _ref: resolvedBookRef, _weak: true },
      published: false,
      language: bookData?.language || null,
      [regionField ?? "region_es"]: bookData?.region || null, // coloca la región en el campo correspondiente
      level: bookData?.level || null,
      cefrLevel: bookData?.cefrLevel || null,
      topic: bookData?.topic || null,
    };
  },
} as const;
