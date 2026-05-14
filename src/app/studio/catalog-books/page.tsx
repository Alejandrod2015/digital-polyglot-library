import StudioShell from "@/components/studio/StudioShell";
import CatalogBooksPageClient from "@/components/studio/CatalogBooksPageClient";
import { requireStudioUser } from "@/lib/requireStudioUser";

export default async function CatalogBooksPage() {
  await requireStudioUser("/studio/catalog-books");

  return (
    <StudioShell
      title="Catálogo de libros"
      description="Libros agrupados con historias adentro. Editor nativo, escribe directo a Prisma (CatalogBook + CatalogStory)."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Catálogo de libros" },
      ]}
    >
      <CatalogBooksPageClient />
    </StudioShell>
  );
}
