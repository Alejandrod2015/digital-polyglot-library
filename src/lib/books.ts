// /src/lib/books.ts
import { resolvePublicMediaUrl } from "@/lib/publicMedia";
import { getCatalogBookMeta } from "@/lib/catalog";

/**
 * Metadatos de un libro por slug. Lee directo del catálogo Studio (Prisma).
 * Se usa en /api/claim/[token]/route.ts y en /lib/email.ts.
 */
export async function getBookMeta(slug: string) {
  const meta = await getCatalogBookMeta(slug);
  if (!meta) {
    return {
      title: slug,
      cover: "/covers/default.jpg",
      description: "",
    };
  }
  return {
    title: meta.title,
    cover: resolvePublicMediaUrl(meta.cover) ?? meta.cover,
    description: meta.description,
  };
}

/** Solo el título — útil para emails. */
export async function getBookTitle(slug: string): Promise<string> {
  const meta = await getCatalogBookMeta(slug);
  return meta?.title ?? slug;
}
