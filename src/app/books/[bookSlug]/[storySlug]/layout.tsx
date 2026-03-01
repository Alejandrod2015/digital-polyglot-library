import StoryBackLink from "@/components/StoryBackLink";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";

type Props = {
  children: React.ReactNode;
  params: Promise<{ bookSlug: string }>;
};

export default async function StoryLayout({ children, params }: Props) {
  const { bookSlug } = await params;

  return (
    <div className="flex flex-col min-h-full text-foreground">
      {/* Botón de volver (mobile + desktop) */}
      <div className="block">
        <div className="mx-auto max-w-4xl px-4 pt-4 md:px-6 md:pt-6">
          <Suspense
            fallback={
              <div
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-300/80"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back</span>
              </div>
            }
          >
            <StoryBackLink bookSlug={bookSlug} />
          </Suspense>
        </div>
      </div>

      {/* Contenido principal sin overflow ni altura fija */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
