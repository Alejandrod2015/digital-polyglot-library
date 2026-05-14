import StudioShell from "@/components/studio/StudioShell";
import CatalogBookEditorClient from "@/components/studio/CatalogBookEditorClient";
import { requireStudioUser } from "@/lib/requireStudioUser";

type PageProps = { params: Promise<{ id: string }> };

export default async function CatalogBookEditorPage({ params }: PageProps) {
  const { id } = await params;
  await requireStudioUser(`/studio/catalog-books/${id}`);

  const isNew = id === "new";
  return (
    <StudioShell
      title={isNew ? "Nuevo libro" : "Editar libro"}
      description={
        isNew
          ? "Crea un libro nuevo. Después de guardar podrás agregar historias adentro."
          : "Editor del libro y de sus historias. Escribe directo al catálogo de Studio."
      }
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Catálogo de libros", href: "/studio/catalog-books" },
        { label: isNew ? "Nuevo" : id },
      ]}
    >
      <CatalogBookEditorClient id={id} />
    </StudioShell>
  );
}
