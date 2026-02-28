import StoryBackLink from "@/components/StoryBackLink";

type Props = {
  children: React.ReactNode;
  params: Promise<{ bookSlug: string }>;
};

export default async function StoryLayout({ children, params }: Props) {
  const { bookSlug } = await params;

  return (
    <div className="flex flex-col min-h-full bg-[#0D1B2A] text-foreground">
      {/* Botón de volver (desktop) */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-4xl px-6 pt-6">
          <StoryBackLink bookSlug={bookSlug} />
        </div>
      </div>

      {/* Contenido principal sin overflow ni altura fija */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
