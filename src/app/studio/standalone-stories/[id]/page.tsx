import StudioShell from "@/components/studio/StudioShell";
import StandaloneStoryEditorClient from "@/components/studio/StandaloneStoryEditorClient";
import { requireStudioUser } from "@/lib/requireStudioUser";

type PageProps = { params: Promise<{ id: string }> };

export default async function StandaloneStoryEditorPage({ params }: PageProps) {
  const { id } = await params;
  await requireStudioUser(`/studio/standalone-stories/${id}`);

  const isNew = id === "new";
  return (
    <StudioShell
      title={isNew ? "Nueva historia" : "Editar historia"}
      description={
        isNew
          ? "Crea una nueva historia suelta. Después de guardar, podrás editar el resto de los campos."
          : "Editor del documento StandaloneStory. Guardado va directo a Studio (Prisma)."
      }
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Standalone stories", href: "/studio/standalone-stories" },
        { label: isNew ? "Nueva" : id },
      ]}
    >
      <StandaloneStoryEditorClient id={id} />
    </StudioShell>
  );
}
