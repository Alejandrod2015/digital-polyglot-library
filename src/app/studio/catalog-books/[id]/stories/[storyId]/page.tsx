import StudioShell from "@/components/studio/StudioShell";
import CatalogStoryEditorClient from "@/components/studio/CatalogStoryEditorClient";
import { requireStudioUser } from "@/lib/requireStudioUser";

type PageProps = { params: Promise<{ id: string; storyId: string }> };

export default async function CatalogStoryEditorPage({ params }: PageProps) {
  const { id, storyId } = await params;
  await requireStudioUser(`/studio/catalog-books/${id}/stories/${storyId}`);

  const isNew = storyId === "new";
  return (
    <StudioShell
      title={isNew ? "Nueva historia" : "Editar historia"}
      description={
        isNew
          ? "Nueva historia dentro de este libro."
          : "Editor de historia del catálogo. Escribe directo a CatalogStory en Studio."
      }
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Catálogo de libros", href: "/studio/catalog-books" },
        { label: id, href: `/studio/catalog-books/${id}` },
        { label: isNew ? "Nueva historia" : storyId },
      ]}
    >
      <CatalogStoryEditorClient bookId={id} storyId={storyId} />
    </StudioShell>
  );
}
