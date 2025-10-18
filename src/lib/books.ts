// /src/lib/books.ts
import { client as sanityClient } from "@/sanity/lib/client";

/**
 * Obtiene los metadatos de un libro desde Sanity por su slug.
 * Se usa tanto en /api/claim/[token]/route.ts como en /lib/email.ts.
 */
export async function getBookMeta(slug: string) {
  try {
    const query = `*[_type == "book" && slug.current == $slug][0]{
      title,
      "cover": cover.asset->url,
      description
    }`;

    const book = await sanityClient.fetch<{
      title?: string;
      cover?: string;
      description?: string;
    } | null>(query, { slug });

    if (!book) {
      console.warn(`⚠️ Libro no encontrado en Sanity: ${slug}`);
      return {
        title: slug,
        cover: "/covers/default.jpg",
        description: "",
      };
    }

    // 🔧 Asegura que el cover sea una URL válida y no una cadena vacía
        const validCover =
    book.cover
        ? book.cover.startsWith("http")
        ? book.cover
        : `https://cdn.sanity.io${book.cover}`
        : "/covers/default.jpg";

    return {
      title: book.title ?? slug,
      cover: validCover,
      description: book.description ?? "",
    };
  } catch (err) {
    console.error(`💥 Error obteniendo libro desde Sanity (${slug}):`, err);
    return {
      title: slug,
      cover: "/covers/default.jpg",
      description: "",
    };
  }
}

/**
 * Devuelve solo el título (por eficiencia), útil para emails.
 */
export async function getBookTitle(slug: string): Promise<string> {
  try {
    const query = `*[_type == "book" && slug.current == $slug][0]{ title }`;
    const book = await sanityClient.fetch<{ title?: string } | null>(query, { slug });
    return book?.title ?? slug;
  } catch (err) {
    console.error(`⚠️ Error obteniendo título desde Sanity (${slug}):`, err);
    return slug;
  }
}
